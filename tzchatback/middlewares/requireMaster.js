// middlewares/requireMaster.js
// 요청자 역할이 master인지 확인 (아니면 403)
// - ✅ 세션(user._id) 우선, 없으면 JWT(Bearer/쿠키 tzchat.jwt) 검증
// - 로그 태그: [AUTH] / 에러 상황 상세 기록
const User = require('../models/User'); // ✅ 우분투 대비: 파일명 소문자
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'tzchat.jwt';

/** 내부: Authorization/Cookie에서 JWT 추출 */
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

/** 내부: 세션 또는 JWT에서 사용자 ID 취득 */
function getUserIdFromReq(req) {
  const sid = req.session?.user?._id ? String(req.session.user._id) : '';
  if (sid) return { userId: sid, via: 'session' };

  const token = extractJwtFromReq(req);
  if (!token) return { userId: '', via: 'none' };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const sub = decoded?.sub ? String(decoded.sub) : '';
    if (!sub) return { userId: '', via: 'jwt_invalid' };
    return { userId: sub, via: 'jwt' };
  } catch (e) {
    console.log('[AUTH][ERR]', { step: 'jwt-verify', message: e?.message });
    return { userId: '', via: 'jwt_invalid' };
  }
}

module.exports = async function requireMaster(req, res, next) {
  const t0 = Date.now();
  try {
    const { userId, via } = getUserIdFromReq(req);

    // 1) 인증 확인
    if (!userId) {
      console.warn('[AUTH][ERR]', {
        step: 'requireMaster.auth',
        code: 401,
        via,
        path: req.originalUrl,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    }

    // 2) 사용자 조회 (비밀번호 제외)
    const me = await User.findById(userId).select('role nickname');
    if (!me) {
      console.warn('[AUTH][ERR]', {
        step: 'requireMaster.findUser',
        code: 404,
        uid: userId,
        path: req.originalUrl,
      });
      return res.status(404).json({ ok: false, error: '사용자를 찾을 수 없습니다.' });
    }

    // 3) 역할 검사
    if (me.role !== 'master') {
      console.warn('[AUTH][ERR]', {
        step: 'requireMaster.role',
        code: 403,
        uid: String(me._id),
        nickname: me.nickname,
        role: me.role,
        path: req.originalUrl,
      });
      return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    }

    // 4) 통과 (추적 로그 + 처리시간)
    console.log('[AUTH]', {
      step: 'requireMaster.ok',
      uid: String(me._id),
      nickname: me.nickname,
      role: me.role,
      via,
      path: req.originalUrl,
      ms: Date.now() - t0,
    });
    return next();
  } catch (err) {
    console.error('[AUTH][ERR]', {
      step: 'requireMaster.catch',
      name: err?.name,
      message: err?.message,
      path: req.originalUrl,
    });
    return res.status(500).json({ ok: false, error: '서버 오류' });
  }
};
