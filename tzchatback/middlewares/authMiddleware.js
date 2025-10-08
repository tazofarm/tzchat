// /middlewares/authMiddleware.js
// ------------------------------------------------------------
// 인증 + 사용자 로드 미들웨어
// - 세션/JWT로 userId 식별 → DB 조회 → req.user 주입
// - 공통 컨텍스트: req._uid, req.auth.userId
// ------------------------------------------------------------
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';
let User;
(() => {
  try {
    const models = require('@/models');
    if (models?.User) { User = models.User; return; }
  } catch {}
  const candidates = [
    '../models/user/User', '../models/user/user',
    '../models/User/User', '../models/User/user',
    '../models/User', '../models/user',
  ];
  for (const p of candidates) {
    try {
      const mod = require(p);
      User = mod?.User || mod?.default || mod;
      if (User) return;
    } catch {}
  }
  throw new Error('[authMiddleware] User 모델을 찾을 수 없습니다.');
})();

function extractJwtFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader && cookieHeader.includes(`${JWT_COOKIE_NAME}=`)) {
    try {
      const target = cookieHeader
        .split(';').map(v => v.trim())
        .find(v => v.startsWith(`${JWT_COOKIE_NAME}=`));
      if (target) return decodeURIComponent(target.split('=')[1]);
    } catch {}
  }
  return null;
}
function pickUserId(decoded) {
  return String(decoded?.sub || decoded?.userId || decoded?.id || decoded?._id || '') || '';
}

module.exports = async function authMiddleware(req, res, next) {
  try {
    // 1) 세션 → userId
    let userId = req.session?.user?._id ? String(req.session.user._id) : '';

    // 2) JWT (세션 없을 때)
    if (!userId) {
      const token = extractJwtFromReq(req);
      if (!token) {
        return res.status(401).json({ ok: false, code: 'no_token', error: '로그인이 필요합니다.' });
      }
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch (e) {
        const code = e?.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid';
        return res.status(401).json({ ok: false, code, error: '토큰이 유효하지 않습니다.' });
      }
      userId = pickUserId(decoded);
      if (!userId) {
        return res.status(401).json({ ok: false, code: 'token_no_subject', error: '토큰이 유효하지 않습니다.' });
      }
      // (선택) 세션 보조 주입
      if (req.session) {
        req.session.user = req.session.user || {};
        req.session.user._id = req.session.user._id || userId;
      }
      req.auth = Object.assign({}, req.auth, { userId, via: 'jwt' });
    } else {
      req.auth = Object.assign({}, req.auth, { userId, via: 'session' });
    }

    // 3) 사용자 로드
    const me = await User.findById(userId).lean
      ? await User.findById(userId).select('_id username nickname role roles permissions isAdmin isMaster email').lean()
      : await User.findById(userId).select('_id username nickname role roles permissions isAdmin isMaster email');
    if (!me) {
      return res.status(404).json({ ok: false, error: '사용자를 찾을 수 없습니다.' });
    }

    // 4) 컨텍스트 주입
    req._uid = String(me._id);
    req.user = me;

    return next();
  } catch (err) {
    console.error('[AUTH][ERR]', { step: 'authMiddleware.catch', name: err?.name, message: err?.message, path: req.originalUrl });
    return res.status(500).json({ ok: false, error: '서버 오류' });
  }
};
