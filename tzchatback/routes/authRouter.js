const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ 비밀번호 해시/검증용
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 추가
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware'); // ✅ 공용 미들웨어 사용
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

/**
 * ✅ 회원가입 API (로그인 불필요)
 * - region1, region2 저장 추가
 * - birthyear 숫자 변환
 * - 중복/필수값 검증 & 상세 로그
 */
router.post('/signup', async (req, res) => {
  // 원본 body 로깅(패스워드 마스킹)
  const rawBody = { ...req.body };
  if (rawBody.password) rawBody.password = '(hidden)';
  console.log('🧾 [회원가입 요청 RAW]', rawBody);

  // body 구조 분해 (지역 포함)
  let { username, password, nickname, gender, birthyear, region1, region2 } = req.body;

  try {
    // 문자열 안전 처리
    username = (username || '').trim();
    nickname = (nickname || '').trim();
    gender   = (gender   || '').trim();
    region1  = (region1  || '').trim();
    region2  = (region2  || '').trim();

    // 출생년도 숫자 변환
    const birthYearNum = birthyear ? parseInt(birthyear, 10) : undefined;

    console.log('🔎 [회원가입 파싱 값]', {
      username, nickname, gender, birthYearNum, region1, region2
    });

    // 필수값 검증
    if (!username || !password || !nickname || !gender || !birthYearNum || !region1 || !region2) {
      console.warn('⛔ [회원가입 실패] 필수 항목 누락');
      return res.status(400).json({ message: '필수 항목 누락' });
    }

    // 아이디 중복
    const userExists = await User.findOne({ username });
    if (userExists) {
      console.warn('⛔ [회원가입 실패] 아이디 중복:', username);
      return res.status(409).json({ message: '아이디 중복' });
    }

    // 닉네임 중복
    const nicknameExists = await User.findOne({ nickname });
    if (nicknameExists) {
      console.warn('⛔ [회원가입 실패] 닉네임 중복:', nickname);
      return res.status(409).json({ message: '닉네임 중복' });
    }

    // 비밀번호 해시
    const hashed = await bcrypt.hash(password, 10);

    // ✅ 사용자 생성 (region1/region2 포함 저장)
    const user = new User({
      username,
      password: hashed,
      nickname,
      gender,
      birthyear: birthYearNum,
      region1,                 // ✅ 저장
      region2,                 // ✅ 저장
      last_login: null
    });

    await user.save();

    console.log('✅ [회원가입 성공]', {
      username: user.username,
      region1: user.region1,
      region2: user.region2,
      _id: user._id.toString()
    });

    return res.status(201).json({ message: '회원가입 성공' });
  } catch (err) {
    console.error('❌ [회원가입 오류]', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그인 API (로그인 불필요)
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('[로그인 시도]', username);

    const user = await User.findOne({ username });
    if (!user) {
      console.warn('[로그인 실패] 아이디 없음:', username);
      return res.status(401).json({ message: '아이디 없음' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('[로그인 실패] 비밀번호 틀림:', username);
      return res.status(401).json({ message: '비밀번호 틀림' });
    }

    req.session.user = { _id: user._id };
    user.last_login = new Date();
    await user.save();

    console.log('[로그인 성공]', username);
    res.json({ message: '로그인 성공', nickname: user.nickname });
  } catch (err) {
    console.error('[로그인 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 로그아웃 API (로그인 필요)
 */
router.post('/logout', requireLogin, (req, res) => {
  const userId = req.session.user._id;
  req.session.destroy(err => {
    if (err) {
      console.error('[로그아웃 오류]', err);
      return res.status(500).send('로그아웃 실패');
    }
    res.clearCookie('connect.sid');
    console.log('[로그아웃 완료]', userId);
    res.send('로그아웃 완료');
  });
});

/**
 * ✅ 로그인한 유저의 정보 반환 (친구/차단 목록 포함, 로그인 필요)
 * - emergency.remainingSeconds 계산을 computeRemaining()로 통일
 * - 남은 시간이 0이면 서버 상태를 OFF로 동기화
 */
router.get('/me', requireLogin, async (req, res) => {
  console.time('[LOAD] GET /api/me');
  const userId = req.session.user._id;

  try {
    const user = await User.findById(userId)
      .populate('friendlist', 'username nickname birthyear gender')
      .populate('blocklist', 'username nickname birthyear gender')
      .lean();

    if (!user) {
      console.warn('[me 조회 실패] 유저 없음:', userId);
      console.timeEnd('[LOAD] GET /api/me');
      return res.status(404).json({ message: '유저 없음' });
    }

    const remaining = computeRemaining(user?.emergency?.activatedAt);

    let isActive = user?.emergency?.isActive === true;
    let activatedAt = user?.emergency?.activatedAt || null;

    if (isActive && remaining <= 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
      });
      isActive = false;
      activatedAt = null;
      console.log(`🧹[ME] 만료 감지 → 자동 OFF (user=${userId})`);
    }

    const modifiedUser = {
      ...user,
      emergency: {
        ...(user.emergency || {}),
        isActive,
        activatedAt,
        remainingSeconds: isActive ? computeRemaining(activatedAt) : 0,
      },
    };

    console.log(`[ME] duration=${EMERGENCY_DURATION_SECONDS}s, remaining=${modifiedUser.emergency.remainingSeconds}s, user=${user.username}`);
    console.timeEnd('[LOAD] GET /api/me');

    res.json({ user: modifiedUser, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd('[LOAD] GET /api/me');
    console.error('[me 조회 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 전체 유저 리스트 (공개 API)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({})
      .select('username nickname birthyear gender region1 region2 preference');
    res.json({ users });
  } catch (err) {
    console.error('❌ 전체 유저 목록 조회 실패:', err);
    res.status(500).json({ message: '유저 조회 실패' });
  }
});

/**
 * ✅ 로그인한 사용자의 친구 ID 목록 반환 (로그인 필요)
 */
router.get('/my-friends', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;

    const me = await User.findById(myId).select('friendlist');
    if (!me) {
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('[친구 목록 조회]', myId);
    res.json({ friendIds: me.friendlist });
  } catch (err) {
    console.error('❌ 친구목록 조회 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ 비밀번호 변경 (로그인 필요)
 * PUT /api/update-password
 * body: { current: string, next: string }
 */
router.put('/update-password', requireLogin, async (req, res) => {
  const userId = req.session.user._id;
  const { current, next } = req.body || {};

  // 1) 입력값 1차 검증
  if (!current || !next) {
    return res.status(400).json({ ok: false, message: '현재/새 비밀번호를 모두 입력해 주세요.' });
  }
  if (String(next).length < 4) {
    return res.status(400).json({ ok: false, message: '새 비밀번호는 4자 이상을 권장합니다.' });
  }

  try {
    console.info('[accountRouter] password change requested by', userId);

    // 2) 유저 조회 (스키마에 select:false면 +password 필요)
    const user = await User.findById(userId).select('+password');
    if (!user) {
      console.warn('[accountRouter] user not found:', userId);
      return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
    }

    // 3) 기존 비밀번호 일치 확인
    const isMatch = await bcrypt.compare(String(current), String(user.password));
    if (!isMatch) {
      console.warn('[accountRouter] wrong current password for', userId);
      return res.status(400).json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' });
    }

    // 4) 동일 비밀번호 재사용 방지
    const isReuse = await bcrypt.compare(String(next), String(user.password));
    if (isReuse) {
      return res.status(400).json({ ok: false, message: '이전과 다른 새 비밀번호를 사용해 주세요.' });
    }

    // 5) 새 비밀번호 해시 후 저장
    const saltRounds = 10;
    const hash = await bcrypt.hash(String(next), saltRounds);
    user.password = hash;

    await user.save();

    console.info('[accountRouter] password changed for', userId);
    return res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('[accountRouter] update-password error:', err);
    return res.status(500).json({ ok: false, message: '서버 오류로 비밀번호 변경에 실패했습니다.' });
  }
});

module.exports = router;
