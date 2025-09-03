// middlewares/requireLogin.js
// ------------------------------------------------------------
// 하이브리드 인증 미들웨어 (세션 → JWT(Bearer/쿠키) 순서)
// - 기존 인터페이스 유지: downstream에서 req.session.user._id 사용 가능
// - JWT 성공 시 req._uid 설정 + req.session.user 최소 주입(하위호환)
// - 로그 규격: [AUTH] 태그 사용
// ------------------------------------------------------------
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

function extractJwtFromReq(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  // 2) Cookie: tzchat.jwt=<token>
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader && cookieHeader.includes(`${JWT_COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${JWT_COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch (e) {
      console.log('[AUTH][ERR]', { step: 'cookie-parse', message: e?.message });
    }
  }
  return null;
}

module.exports = function requireLogin(req, res, next) {
  try {
    // 1) 세션 우선 (기존 동작 그대로)
    if (req.session && req.session.user?._id) {
      req._uid = String(req.session.user._id);
      console.log('[AUTH][REQ]', {
        path: req.originalUrl,
        via: 'session',
        userId: req._uid,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      return next();
    }

    // 2) JWT 시도 (Bearer or 쿠키)
    const token = extractJwtFromReq(req);
    if (!token) {
      console.warn('[AUTH][ERR]', {
        step: 'extract',
        reason: 'no-session-and-no-token',
        path: req.originalUrl,
        ip: req.ip,
      });
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.warn('[AUTH][ERR]', {
        step: 'verify',
        message: e?.message,
        name: e?.name,
        path: req.originalUrl,
      });
      return res.status(401).json({ ok: false, error: '토큰이 유효하지 않습니다.' });
    }

    const userId = decoded?.sub ? String(decoded.sub) : '';
    if (!userId) {
      console.warn('[AUTH][ERR]', { step: 'decode', reason: 'no-sub', path: req.originalUrl });
      return res.status(401).json({ ok: false, error: '토큰이 유효하지 않습니다.' });
    }

    // 3) 하위호환: 세션 객체에 최소 사용자 정보 주입
    //    - 기존 라우터가 req.session.user._id를 참조하는 경우를 위해
    if (req.session) {
      req.session.user = req.session.user || {};
      if (!req.session.user._id) req.session.user._id = userId;
      if (!req.session.user.nickname && decoded.nickname) {
        req.session.user.nickname = decoded.nickname;
      }
    }

    // 4) 공통 사용자 ID 보조 필드
    req._uid = userId;

    console.log('[AUTH][REQ]', {
      path: req.originalUrl,
      via: 'jwt',
      userId,
      ip: req.ip,
      ua: req.headers['user-agent'],
      hasSessionObj: !!req.session,
    });

    return next();
  } catch (err) {
    console.error('[AUTH][ERR]', {
      step: 'unknown',
      name: err?.name,
      message: err?.message,
      path: req.originalUrl,
    });
    return res.status(500).json({ ok: false, error: '서버 오류' });
  }
};
