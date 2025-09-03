// middlewares/authMiddleware.js
// ------------------------------------------------------
// 로그인 보호 미들웨어 (세션 → JWT 하이브리드)
// - 기존 API 유지: module.exports = requireLogin
// - 작동 순서:
//   1) 세션(req.session.user._id)이 있으면 통과 (하위 호환)
//   2) 없으면 JWT(Bearer 헤더 > httpOnly 쿠키 순) 검증
//   3) 성공 시 req.auth 및 req.session.user 최소객체 설정(요청 범위)
// - 실패 시 401 반환
// - 로그 규격: [AUTH][REQ]/[AUTH][OK]/[AUTH][ERR]
// ------------------------------------------------------

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

/** Authorization/Cookie에서 JWT 추출 */
function extractJwt(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  // 2) Cookie: tzchat.jwt=<token>
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader && cookieHeader.includes(`${JWT_COOKIE_NAME}=`)) {
    try {
      const pair = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${JWT_COOKIE_NAME}=`));
      if (pair) return decodeURIComponent(pair.split('=')[1]);
    } catch (e) {
      console.log('[AUTH][ERR]', { step: 'cookie-parse', message: e?.message });
    }
  }

  return null;
}

/** 세션/JWT 하이브리드 로그인 보호 */
function requireLogin(req, res, next) {
  const path = req.originalUrl || req.path || '';
  console.log('[AUTH][REQ]', { path, hasSession: !!(req.session && req.session.user && req.session.user._id) });

  // 1) 세션 우선(하위 호환)
  const sid = req.session?.user?._id ? String(req.session.user._id) : '';
  if (sid) {
    req.auth = { userId: sid, via: 'session' };
    console.log('[AUTH][OK]', { via: 'session', userId: sid, path });
    return next();
  }

  // 2) JWT 시도
  const token = extractJwt(req);
  if (!token) {
    console.log('[AUTH][ERR]', { step: 'extract', code: 'NO_TOKEN', path });
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.sub ? String(decoded.sub) : '';
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'decode', code: 'NO_SUB', path });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    // 요청 범위에서 하위 호환을 위해 req.session.user 최소 객체 주입
    // (실제 세션 저장은 하지 않음; 다른 라우터가 req.session.user를 참조해도 동작)
    if (!req.session) req.session = {}; // express-session이 없는 경우 방어
    if (!req.session.user) req.session.user = { _id: userId };

    req.auth = { userId, via: 'jwt', tokenPresent: true };
    console.log('[AUTH][OK]', { via: 'jwt', userId, path });
    return next();
  } catch (err) {
    console.log('[AUTH][ERR]', {
      step: 'verify',
      code: err?.name,
      message: err?.message,
      path
    });
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
}

module.exports = requireLogin;
