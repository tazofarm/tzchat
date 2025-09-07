// middlewares/authMiddleware.js
// ------------------------------------------------------
// 로그인 보호 미들웨어 (세션 ↔ JWT 하이브리드)
// - 순서:
//   0) CORS 프리플라이트(OPTIONS) → 무조건 통과
//   1) 세션(req.session.user._id) 존재 시 통과 (하위 호환)
//   2) JWT 추출/검증 (Authorization Bearer, X-Auth-Token, ?token)
//   3) 성공 시 req.auth, req.user, req.session.user(최소객체) 설정
// - 실패 시 401 JSON 반환
// - 로그: [AUTH][REQ]/[AUTH][OK]/[AUTH][ERR]
// ------------------------------------------------------

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

/** Authorization/Cookie/헤더/쿼리에서 JWT 추출 */
function extractJwt(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return { token: auth.slice(7).trim(), via: 'authorization' };
  }

  // 2) X-Auth-Token 헤더
  const xhdr = req.headers['x-auth-token'];
  if (xhdr && String(xhdr).trim()) {
    return { token: String(xhdr).trim(), via: 'x-auth-token' };
  }

  // 3) 쿼리스트링 ?token=...
  if (req.query && req.query.token) {
    return { token: String(req.query.token).trim(), via: 'query' };
  }

  // 4) Cookie: tzchat.jwt=<token>
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader && cookieHeader.includes(`${JWT_COOKIE_NAME}=`)) {
    try {
      const pair = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith(`${JWT_COOKIE_NAME}=`));
      if (pair) {
        return { token: decodeURIComponent(pair.split('=')[1]), via: 'cookie' };
      }
    } catch (e) {
      console.log('[AUTH][ERR]', { step: 'cookie-parse', message: e?.message });
    }
  }

  return { token: null, via: null };
}

/** 세션/JWT 하이브리드 로그인 보호 */
function requireLogin(req, res, next) {
  const path = req.originalUrl || req.path || '';
  const method = (req.method || '').toUpperCase();

  // 0) 프리플라이트는 무조건 통과 (CORS)
  if (method === 'OPTIONS') {
    console.log('[AUTH][REQ]', { path, method, note: 'CORS preflight pass-through' });
    return next();
  }

  console.log('[AUTH][REQ]', {
    path,
    method,
    hasSession: !!(req.session && req.session.user && req.session.user._id),
  });

  // 1) 세션 우선(하위 호환)
  const sid = req.session?.user?._id ? String(req.session.user._id) : '';
  if (sid) {
    // 일관성: req.user도 맞춰놓기
    if (!req.user) req.user = { _id: sid };
    req.auth = { userId: sid, via: 'session' };
    console.log('[AUTH][OK]', { via: 'session', userId: sid, path, method });
    return next();
  }

  // 2) JWT 시도
  const { token, via } = extractJwt(req);
  if (!token) {
    console.log('[AUTH][ERR]', { step: 'extract', code: 'NO_TOKEN', via, path, method });
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.sub ? String(decoded.sub) : '';
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'decode', code: 'NO_SUB', via, path, method });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    // 요청 범위에서 하위 호환을 위해 세션 최소 객체/req.user를 맞춰 둠
    if (!req.user) req.user = { _id: userId };
    if (!req.session) req.session = {}; // 이 줄은 express-session 미적용 시 방어
    if (!req.session.user) req.session.user = { _id: userId };

    req.auth = { userId, via: `jwt:${via}`, tokenPresent: true };
    console.log('[AUTH][OK]', { via: `jwt:${via}`, userId, path, method });
    return next();
  } catch (err) {
    console.log('[AUTH][ERR]', {
      step: 'verify',
      code: err?.name,
      message: err?.message,
      via,
      path,
      method,
    });
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
}

module.exports = requireLogin;
