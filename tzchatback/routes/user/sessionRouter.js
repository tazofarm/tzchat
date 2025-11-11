// routes/user/sessionRouter.js
// base: /api
// ------------------------------------------------------
// 세션/토큰 전담 라우터
// - 로그인 / 로그아웃
// - 하위호환: /userinfo
// - JWT httpOnly 쿠키 + JSON token 병행
// - 세션 재발급(regenerate) + save 보장
// ------------------------------------------------------

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('@/models');

const router = express.Router();

// ===== 환경값 =====
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 앱/웹 공통 만료
const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

// ===== 유틸: 안전 트림 =====
function s(v) { return (v || '').toString().trim(); }

// ===== 유틸: 관리자 판별 =====
function resolveRole(u) {
  if (!u) return '';
  if (u.role) return String(u.role);
  if (Array.isArray(u.roles)) {
    if (u.roles.includes('master')) return 'master';
    if (u.roles.includes('admin')) return 'admin';
    if (u.roles.length > 0) return String(u.roles[0]);
  }
  if (u.username === 'master') return 'master';
  return 'user';
}
function resolveIsAdmin(u) {
  if (!u) return false;
  if (u.isAdmin === true) return true;
  const role = resolveRole(u);
  if (role === 'master' || role === 'admin') return true;
  if (Array.isArray(u.roles) && (u.roles.includes('master') || u.roles.includes('admin'))) return true;
  if (u.username === 'master') return true;
  return false;
}

// ===== 유틸: JWT 발급 & 쿠키 설정 =====
function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), nickname: user.nickname || '' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}
function setJwtCookie(_req, res, token) {
  const isSecure = true;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: isSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  });
  console.log('[AUTH][COOKIE]', { name: COOKIE_NAME, set: true, httpOnly: true, sameSite: 'none', secure: isSecure });
}

// ===== 유틸: JWT 추출 & 검증 =====
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes(`${COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch (e) {
      console.log('[AUTH][DBG] 쿠키 파싱 실패:', e?.message);
    }
  }
  return null;
}

// ======================================================
// 로그인 / 로그아웃 (JWT + 세션 하위호환)
// ======================================================
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
    const user = await User.findOne({ username: safeUsername }).select('+password role roles username nickname');
    if (!user) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'NO_USER', username: safeUsername });
      return res.status(401).json({ ok: false, message: '아이디 없음' });
    }

    const hashed = String(user.password || '');
    if (!hashed) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'NO_PASSWORD_FIELD', username: safeUsername });
      return res.status(500).json({ ok: false, message: '계정 비밀번호 필드를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), hashed);
    if (!isMatch) {
      console.log('[AUTH][ERR]', { step: 'login', code: 'BAD_PASSWORD', username: safeUsername });
      return res.status(401).json({ ok: false, message: '비밀번호 틀림' });
    }

    // 로그인 시간 갱신(베스트 에포트)
    user.last_login = new Date();
    user.save().catch(() => {});

    const token = signToken(user);
    setJwtCookie(req, res, token);

    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.regenerate(err => (err ? reject(err) : resolve()));
      });
      req.session.user = { _id: user._id, nickname: user.nickname };
      // PASS 찌꺼기 제거(보조)
      delete req.session.passTxId;
      delete req.session.passIntent;

      await new Promise((resolve, reject) => {
        req.session.save(err => (err ? reject(err) : resolve()));
      });
      console.log('[AUTH][SESSION] regenerated + saved', { sid: req.sessionID, userId: String(user._id) });
    }

    const role = resolveRole(user);
    const roles = Array.isArray(user.roles) ? user.roles : (role ? [role] : []);
    const isAdmin = resolveIsAdmin(user);

    console.log('[API][RES] /login 200', { username: safeUsername, userId: String(user._id), role, isAdmin });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      message: '로그인 성공',
      nickname: user.nickname,
      username: user.username,
      role,
      roles,
      isAdmin,
      token
    });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'login', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

router.post('/logout', async (req, res) => {
  const userId = req.session?.user?._id || '(jwt-only)';
  console.log('[API][REQ] /logout', { userId });

  try {
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    });

    if (req.session) {
      // PASS 세션 찌꺼기 제거
      delete req.session.passTxId;
      delete req.session.passIntent;
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }

    console.log('[API][RES] /logout 200');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, message: '로그아웃 완료' });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'logout', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

// ======================================================
// 🔁 하위호환: /userinfo (세션/JWT 겸용 간단 응답)
// ======================================================
router.get('/userinfo', async (req, res) => {
  try {
    let via = null;
    let uid = null;
    let nickname = null;

    if (req.session?.user?._id) {
      via = 'session';
      uid = String(req.session.user._id);
      nickname = req.session.user.nickname || null;
    } else {
      const token = extractToken(req);
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          via = 'jwt';
          uid = String(decoded.sub || '');
          const u = await User.findById(uid).select('nickname');
          nickname = u?.nickname || null;
        } catch (e) {
          // ignore
        }
      }
    }

    if (!uid) {
      return res.json({ ok: true, loggedIn: false });
    }
    return res.json({ ok: true, loggedIn: true, via, userId: uid, nickname });
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'userinfo', message: err?.message });
    return res.status(500).json({ ok: false, message: '서버 오류' });
  }
});

module.exports = router;
