// routes/authRouter.js
// ------------------------------------------------------
// 인증 및 계정 관련 라우터 (JWT 전환)
// - 회원가입, 로그인/로그아웃, 내 정보(/me), 비밀번호 변경, 탈퇴/취소
// - ✅ 세션 하위 호환: 세션이 있으면 사용, 없으면 JWT 우선 사용
// - ✅ Web/App 동시 지원: httpOnly 쿠키 + JSON 응답 token 병행
// - 로그 최대화(요청 RAW, 파싱값, 토큰/쿠키 유무, 처리 경로)
// ------------------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');                 // (현 파일에서 직접 사용 X, 유지)
const bcrypt = require('bcrypt');               // 비밀번호 해시/검증
const jwt = require('jsonwebtoken');            // ✅ JWT
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // (직접 사용 X, 유지)
const ChatRoom = require('../models/ChatRoom');           // (직접 사용 X, 유지)
const Message = require('../models/Message');             // (직접 사용 X, 유지)
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

// ===== 환경값 =====
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 앱/웹 공통 만료
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// ===== 유틸: 민감정보 마스킹 =====
function maskPassword(obj) {
  const copy = { ...(obj || {}) };
  if (copy.password) copy.password = '(hidden)';
  if (copy.current) copy.current = '(hidden)';
  if (copy.next) copy.next = '(hidden)';
  return copy;
}

// ===== 유틸: 안전 트림 =====
function s(v) {
  return (v || '').toString().trim();
}

// ===== 유틸: JWT 발급 & 쿠키 설정 =====
function signToken(user) {
  // 최소 정보만 탑재 (sub=사용자ID)
  return jwt.sign(
    { sub: String(user._id), nickname: user.nickname || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setJwtCookie(req, res, token) {
  // NOTE: prod/https 환경 가정 — SameSite=None + Secure
  // 세션 시절과 동일하게 리버스 프록시 뒤에서 동작하므로 secure 권장
  // 앱(WebView) 호환 목적. (Capacitor/Android는 쿠키 미사용 가능성 → token도 JSON으로 반환)
  const isSecure = true; // 운영/원격-DEV 공통 HTTPS 프록시 뒤 가정
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: isSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일 (JWT_EXPIRES_IN과 맞춤)
  });
  console.log('[AUTH][COOKIE]', { name: COOKIE_NAME, set: true, httpOnly: true, sameSite: 'none', secure: isSecure });
}

// ===== 유틸: JWT 추출 & 검증 =====
function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  // 2) Cookie: tzchat.jwt=<token>
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes(`${COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch (e) {
      console.log('[AUTH][DBG] 쿠키 파싱 실패:', e?.message);
    }
  }
  return null;
}

async function authFromJwtOrSession(req, res, next) {
  try {
    // 0) 세션 하위 호환: 세션 기반 로그인 유지
    if (req.session?.user?._id) {
      req.auth = { userId: String(req.session.user._id), via: 'session' };
      console.log('[AUTH][OK] 세션 인증', { userId: req.auth.userId });
      return next();
    }

    // 1) JWT 시도
    const token = extractToken(req);
    if (!token) {
      console.log('[AUTH][ERR]', { step: 'extract', message: '토큰 없음' });
      return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.log('[AUTH][ERR]', { step: 'verify', message: e?.message });
      return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
    }

    if (!decoded?.sub) {
      console.log('[AUTH][ERR]', { step: 'decode', message: 'sub 누락' });
      return res.status(401).json({ ok: false, message: '토큰이 유효하지 않습니다.' });
    }

    req.auth = { userId: String(decoded.sub), via: 'jwt', token };
    console.log('[AUTH][OK] JWT 인증', { userId: req.auth.userId });
    return next();
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'unknown', message: err?.message });
    return res.status(401).json({ ok: false, message: '인증 실패' });
  }
}

// ======================================================
// 회원가입
// ======================================================
/**
 * ✅ 회원가입 API (로그인 불필요)
 * - region1, region2 저장 포함
 * - birthyear 숫자 변환
 * - 중복/필수값 검증 & 상세 로그
 */
router.post('/signup', async (req, res) => {
  console.log('[API][REQ] /signup', { body: maskPassword(req.body || {}) });

  let { username, password, nickname, gender, birthyear, region1, region2 } = req.body || {};
  try {
    username = s(username);
    nickname = s(nickname);
    gender   = s(gender);
    region1  = s(region1);
    region2  = s(region2);
    const birthYearNum = birthyear ? parseInt(String(birthyear), 10) : undefined;

    if (!username || !password || !nickname || !gender || !birthYearNum || !region1 || !region2) {
      console.log('[API][RES] /signup 400 필수누락');
      return res.status(400).json({ ok: false, message: '필수 항목 누락' });
    }

    const [userExists, nicknameExists] = await Promise.all([
      User.findOne({ username }).lean(),
      User.findOne({ nickname }).lean(),
    ]);
    if (userExists) {
      console.log('[AUTH][ERR]', { step: 'signup', code: 'DUP_USERNAME', username });
      return res.status(409).json({ ok: false, message: '아이디 중복' });
    }
    if (nicknameExists) {
      console.log('[AUTH][ERR]', { step: 'signup', code: 'DUP_NICKNAME', nickname });
      return res.status(409).json({ ok: false, message: '닉네임 중복' });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      username,
      password: hashed,
      nickname,
      gender,
      birthyear: birthYearNum,
      region1,
      region2,
      last_login: null
    });

    console.log('[API][RES] /signup 201', { userId: String(user._id), username });
    return res.status(201).json({ ok: true, message: '회원가입 성공' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'signup', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 로그인 / 로그아웃 (JWT)
// ======================================================
/**
 * ✅ 로그인
 * - 자격 증명 확인 → JWT 발급
 * - httpOnly 쿠키 설정 + JSON으로 token 반환 (앱 호환)
 * - (하위호환) 세션도 세팅 가능하지만 기본은 JWT 사용 권장
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const safeUsername = s(username);

  console.log('[API][REQ] /login', {
    username: safeUsername,
    ua: req.get('user-agent'),
    origin: req.get('origin') || '(none)',
    hasCookie: !!req.headers.cookie
  });

  try {
    const user = await User.findOne({ username: safeUsername });
    if (!user) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'NO_USER', username: safeUsername });
      return res.status(401).json({ ok: false, message: '아이디 없음' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), String(user.password));
    if (!isMatch) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'BAD_PASSWORD', username: safeUsername });
      return res.status(401).json({ ok: false, message: '비밀번호 틀림' });
    }

    // 로그인 시간 갱신(베스트 에포트)
    user.last_login = new Date();
    user.save().catch(() => {});

    const token = signToken(user);
    setJwtCookie(req, res, token); // 웹용 쿠키
    // (선택) 세션 하위 호환 — 다른 라우터가 아직 세션을 볼 수 있게
    if (req.session) {
      req.session.user = { _id: user._id, nickname: user.nickname };
    }

    console.log('[API][RES] /login 200', { username: safeUsername, userId: String(user._id) });
    return res.status(200).json({ ok: true, message: '로그인 성공', nickname: user.nickname, token });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'login', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

/**
 * ✅ 로그아웃
 * - JWT 쿠키 제거(클라이언트 저장 토큰은 클라에서 삭제 필요)
 * - 세션 하위 호환: 세션도 파기 시도
 */
router.post('/logout', async (req, res) => {
  const userId = req.session?.user?._id || '(jwt-only)';
  console.log('[API][REQ] /logout', { userId });

  try {
    // 쿠키 제거
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    });

    // 세션 하위 호환 파기
    if (req.session) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }

    console.log('[API][RES] /logout 200');
    return res.json({ ok: true, message: '로그아웃 완료' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'logout', message: err?.message });
    return res.status(500).json({ ok: false, message: '로그아웃 실패' });
  }
});

// ======================================================
// 내 정보(/me) & 공개 유저 목록 & 내 친구 ID 목록
// ======================================================
/**
 * ✅ /me
 * - JWT 또는 세션으로 인증
 * - emergency.remainingSeconds 계산 & 만료 시 자동 OFF
 */
router.get('/me', authFromJwtOrSession, async (req, res) => {
  console.time('[API][TIMING] GET /api/me');
  const userId = req.auth.userId;

  try {
    const user = await User.findById(userId)
      .populate('friendlist', 'username nickname birthyear gender')
      .populate('blocklist', 'username nickname birthyear gender')
      .lean();

    if (!user) {
      console.timeEnd('[API][TIMING] GET /api/me');
      console.log('[AUTH][ERR]', { step: 'me', code: 'NO_USER', userId });
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
      console.log('[AUTH][DBG]', { step: 'me', message: 'emergency auto-off' });
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

    console.timeEnd('[API][TIMING] GET /api/me');
    return res.json({ ok: true, user: modifiedUser, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd('[API][TIMING] GET /api/me');
    console.log('[AUTH][ERR]', { step: 'me', message: err?.message });
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
    console.log('[AUTH][ERR]', { step: 'listUsers', message: err?.message });
    return res.status(500).json({ ok: false, message: '유저 조회 실패' });
  }
});

/**
 * ✅ 내 친구 ID 목록 (로그인 필요)
 */
router.get('/my-friends', authFromJwtOrSession, async (req, res) => {
  try {
    const myId = req.auth.userId;
    const me = await User.findById(myId).select('friendlist');
    if (!me) return res.status(404).json({ ok: false, message: '사용자 없음' });

    console.log('[API][RES] /my-friends', { userId: myId, count: me.friendlist?.length || 0 });
    return res.json({ ok: true, friendIds: me.friendlist });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'myFriends', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 비밀번호 변경 & 계정 탈퇴/취소
// ======================================================
/**
 * ✅ 비밀번호 변경 (JWT/세션 인증)
 * PUT /api/update-password
 * body: { current: string, next: string }
 */
router.put('/update-password', authFromJwtOrSession, async (req, res) => {
  const userId = req.auth.userId;
  const { current, next } = req.body || {};

  if (!current || !next) {
    return res.status(400).json({ ok: false, message: '현재/새 비밀번호를 모두 입력해 주세요.' });
    }
  if (String(next).length < 4) {
    return res.status(400).json({ ok: false, message: '새 비밀번호는 4자 이상을 권장합니다.' });
  }

  try {
    console.log('[AUTH][REQ] update-password', { userId });

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ ok: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(String(current), String(user.password));
    if (!isMatch) {
      return res.status(400).json({ ok: false, message: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const isReuse = await bcrypt.compare(String(next), String(user.password));
    if (isReuse) {
      return res.status(400).json({ ok: false, message: '이전과 다른 새 비밀번호를 사용해 주세요.' });
    }

    user.password = await bcrypt.hash(String(next), 10);
    await user.save();

    console.log('[AUTH][RES] update-password OK', { userId });
    return res.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'updatePassword', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류로 비밀번호 변경에 실패했습니다.' });
  }
});

// 🕒 유예기간 (14일)
const DELETION_GRACE_DAYS = 14;

/**
 * [1] 탈퇴 신청 (JWT/세션 인증)
 */
router.post('/account/delete-request', authFromJwtOrSession, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const now = new Date();
    const due = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(userId, {
      status: 'pendingDeletion',
      deletionRequestedAt: now,
      deletionDueAt: due
    }, { new: true });

    // JWT는 서버 상태와 무관 — 클라에서 토큰 삭제 필요
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    });

    console.log('[AUTH][RES] delete-request OK', { userId, dueAt: due.toISOString() });
    return res.json({ ok: true, message: `탈퇴가 신청되었습니다. ${DELETION_GRACE_DAYS}일 후 영구 삭제됩니다.` });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'deleteRequest', message: err?.message });
    return res.status(500).json({ ok: false, error: '탈퇴 신청 실패' });
  }
});

/**
 * [2] 탈퇴 취소 (JWT/세션 인증)
 */
router.post('/account/undo-delete', authFromJwtOrSession, async (req, res) => {
  try {
    const userId = req.auth.userId;
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

    console.log('[AUTH][RES] undo-delete OK', { userId });
    return res.json({ ok: true, message: '탈퇴가 취소되었습니다.' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'undoDelete', message: err?.message });
    return res.status(500).json({ ok: false, error: '탈퇴 취소 실패' });
  }
});

module.exports = router;
