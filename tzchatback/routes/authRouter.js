// routes/authRouter.js
// ------------------------------------------------------
// 인증 및 계정 관련 라우터
// - 회원가입, 로그인/로그아웃, 내 정보(/me), 비밀번호 변경, 탈퇴/취소
// - 세션/쿠키 동작 안정화를 위해 regenerate → save 순서 보장
// - 로그 최대화(요청 RAW, 파싱값, 세션ID, 쿠키/남은시간 등)
// ------------------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');                 // ✅ 이미지 압축용 (현재 파일에서는 직접 사용 X)
const bcrypt = require('bcrypt');               // ✅ 비밀번호 해시/검증용
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 참조 중 (현재 파일에서 직접 사용 X)
const ChatRoom = require('../models/ChatRoom');           // ✅ 참조 중 (현재 파일에서 직접 사용 X)
const Message = require('../models/Message');             // ✅ 참조 중 (현재 파일에서 직접 사용 X)
const requireLogin = require('../middlewares/authMiddleware'); // ✅ 공용 미들웨어
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

/** 유틸: 민감정보 마스킹 */
function maskPassword(obj) {
  const copy = { ...obj };
  if (copy.password) copy.password = '(hidden)';
  if (copy.current) copy.current = '(hidden)';
  if (copy.next) copy.next = '(hidden)';
  return copy;
}

/** 유틸: 안전 트림 */
function s(v) {
  return (v || '').toString().trim();
}

// ======================================================
// 회원가입
// ======================================================
/**
 * ✅ 회원가입 API (로그인 불필요)
 * - region1, region2 저장 추가
 * - birthyear 숫자 변환
 * - 중복/필수값 검증 & 상세 로그
 */
router.post('/signup', async (req, res) => {
  // 원본 body 로깅(패스워드 마스킹)
  console.log('🧾 [회원가입 요청 RAW]', maskPassword(req.body || {}));

  // body 구조 분해 (지역 포함)
  let { username, password, nickname, gender, birthyear, region1, region2 } = req.body || {};

  try {
    // 문자열 안전 처리
    username = s(username);
    nickname = s(nickname);
    gender   = s(gender);
    region1  = s(region1);
    region2  = s(region2);

    // 출생년도 숫자 변환
    const birthYearNum = birthyear ? parseInt(String(birthyear), 10) : undefined;

    console.log('🔎 [회원가입 파싱 값]', {
      username, nickname, gender, birthYearNum, region1, region2
    });

    // 필수값 검증
    if (!username || !password || !nickname || !gender || !birthYearNum || !region1 || !region2) {
      console.warn('⛔ [회원가입 실패] 필수 항목 누락');
      return res.status(400).json({ ok: false, message: '필수 항목 누락' });
    }

    // 아이디/닉네임 중복
    const [userExists, nicknameExists] = await Promise.all([
      User.findOne({ username }).lean(),
      User.findOne({ nickname }).lean(),
    ]);
    if (userExists) {
      console.warn('⛔ [회원가입 실패] 아이디 중복:', username);
      return res.status(409).json({ ok: false, message: '아이디 중복' });
    }
    if (nicknameExists) {
      console.warn('⛔ [회원가입 실패] 닉네임 중복:', nickname);
      return res.status(409).json({ ok: false, message: '닉네임 중복' });
    }

    // 비밀번호 해시
    const hashed = await bcrypt.hash(String(password), 10);

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

    return res.status(201).json({ ok: true, message: '회원가입 성공' });
  } catch (err) {
    console.error('❌ [회원가입 오류]', err);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 로그인 / 로그아웃
// ======================================================
/**
 * ✅ 로그인 API (로그인 불필요)
 * - 세션 재발급(req.session.regenerate) → 저장(req.session.save) 완료 후 응답
 *   → 응답 헤더에 Set-Cookie가 안정적으로 실림
 * - 응답은 { ok: true, message: '로그인 성공', nickname } 유지
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const safeUsername = s(username);

  try {
    console.log('[로그인 시도]', {
      username: safeUsername,
      ua: req.get('user-agent'),
      origin: req.get('origin') || '(none)',
      cookie: req.headers.cookie ? '(present)' : '(none)',
    });

    const user = await User.findOne({ username: safeUsername });
    if (!user) {
      console.warn('[로그인 실패] 아이디 없음:', safeUsername);
      return res.status(401).json({ ok: false, message: '아이디 없음' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), String(user.password));
    if (!isMatch) {
      console.warn('[로그인 실패] 비밀번호 틀림:', safeUsername);
      return res.status(401).json({ ok: false, message: '비밀번호 틀림' });
    }

    // 마지막 로그인 시간 업데이트(베스트-에포트)
    user.last_login = new Date();
    await user.save().catch((e) => {
      console.warn('[로그인] last_login 저장 경고:', e?.message);
    });

    // ★★★ 핵심: 세션 재발급 → 사용자 세션 주입 → 저장 → 응답
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('[로그인 오류] session.regenerate 실패:', regenErr);
        return res.status(500).json({ ok: false, message: '세션 오류' });
      }

      // 세션에 최소 정보만 저장 (민감/대용량 금지)
      req.session.user = { _id: user._id, nickname: user.nickname };

      // (선택) 방어적 헤더: 캐시 금지 (중복 로그인 관련 혼동 방지)
      res.setHeader('Cache-Control', 'no-store');

      // 저장 완료 후에만 응답 → Set-Cookie 확정
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[로그인 오류] session.save 실패:', saveErr);
          return res.status(500).json({ ok: false, message: '세션 저장 오류' });
        }

        console.log('[로그인 성공]', {
          sessionID: req.sessionID,
          user: user.username,
          cookieSetHint: 'Set-Cookie는 브라우저 개발자도구/네트워크 탭에서 확인',
        });

        // 응답 본문은 프론트에서 분기하기 쉽게 ok/메시지 포함
        return res.status(200).json({ ok: true, message: '로그인 성공', nickname: user.nickname });
      });
    });
  } catch (err) {
    console.error('[로그인 오류] 예외:', err);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

/**
 * ✅ 로그아웃 API (로그인 필요)
 * - 세션 파괴 + 쿠키 정리
 * - main.js에서 쿠키 이름을 'tzchat.sid'로 설정했으므로 동일하게 정리
 * - SameSite=None + Secure 모드에서 클라이언트/프록시 환경에 따라
 *   clearCookie 시 옵션을 맞춰주는 편이 안전
 */
router.post('/logout', requireLogin, (req, res) => {
  const userId = req.session?.user?._id;
  console.log('[로그아웃 요청]', { userId, sessionID: req.sessionID });

  req.session.destroy((err) => {
    if (err) {
      console.error('[로그아웃 오류] session.destroy 실패:', err);
      return res.status(500).json({ ok: false, message: '로그아웃 실패' });
    }
    try {
      // main.js 세션 설정과 일치하도록 쿠키 이름/옵션 지정
      res.clearCookie('tzchat.sid', {
        path: '/',
        // SameSite=None + Secure 환경에서 일부 브라우저/프록시가 옵션 불일치 시 쿠키를 안 지우는 경우가 있어 일치 권장
        sameSite: 'none',
        secure: true,
        httpOnly: true,
      });
    } catch (e) {
      console.warn('[로그아웃] clearCookie 중 경고:', e?.message);
    }
    console.log('[로그아웃 완료]', { userId });
    return res.json({ ok: true, message: '로그아웃 완료' });
  });
});

// ======================================================
// 내 정보(/me) & 공개 유저 목록 & 내 친구 ID 목록
// ======================================================
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
      return res.status(404).json({ ok: false, message: '유저 없음' });
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

    return res.json({ ok: true, user: modifiedUser, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd('[LOAD] GET /api/me');
    console.error('[me 조회 오류]', err);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

/**
 * ✅ 전체 유저 리스트 (공개 API)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({})
      .select('username nickname birthyear gender region1 region2 preference');
    return res.json({ ok: true, users });
  } catch (err) {
    console.error('❌ 전체 유저 목록 조회 실패:', err);
    return res.status(500).json({ ok: false, message: '유저 조회 실패' });
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
      return res.status(404).json({ ok: false, message: '사용자 없음' });
    }

    console.log('[친구 목록 조회]', myId);
    return res.json({ ok: true, friendIds: me.friendlist });
  } catch (err) {
    console.error('❌ 친구목록 조회 실패:', err);
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 비밀번호 변경 & 계정 탈퇴/취소
// ======================================================
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


// 🕒 유예기간 (14일)
const DELETION_GRACE_DAYS = 14;

/**
 * [1] 탈퇴 신청 (로그인 필요)
 */
router.post('/account/delete-request', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const now = new Date();
    const due = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(userId, {
      status: 'pendingDeletion',
      deletionRequestedAt: now,
      deletionDueAt: due
    }, { new: true });

    console.log(`[탈퇴신청] user=${userId}, dueAt=${due.toISOString()}`);
    req.session.destroy(() => {}); // 세션 종료(응답은 유지)

    return res.json({ ok: true, message: '탈퇴가 신청되었습니다. ' + DELETION_GRACE_DAYS + '일 후 영구 삭제됩니다.' });
  } catch (err) {
    console.error('[탈퇴신청 오류]', err);
    return res.status(500).json({ ok: false, error: '탈퇴 신청 실패' });
  }
});

/**
 * [2] 탈퇴 취소 (유예기간 내, 로그인 필요)
 */
router.post('/account/undo-delete', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user || user.status !== 'pendingDeletion') {
      return res.status(400).json({ ok: false, error: '탈퇴 신청 상태가 아닙니다.' });
    }

    if (user.deletionDueAt < new Date()) {
      return res.status(400).json({ ok: false, error: '이미 삭제 예정일이 지났습니다.' });
    }

    user.status = 'active';
    user.deletionRequestedAt = null;
    user.deletionDueAt = null;
    await user.save();

    console.log(`[탈퇴취소] user=${userId}`);
    return res.json({ ok: true, message: '탈퇴가 취소되었습니다.' });
  } catch (err) {
    console.error('[탈퇴취소 오류]', err);
    return res.status(500).json({ ok: false, error: '탈퇴 취소 실패' });
  }
});

module.exports = router;
