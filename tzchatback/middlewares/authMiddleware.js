// middlewares/authMiddleware.js
// ------------------------------------------------------
// 로그인 여부 확인 미들웨어(requireLogin)
// - 세션/쿠키 유무를 상세 로그로 남겨 401 원인 파악에 도움
// - CORS 프리플라이트(OPTIONS)는 통과시켜야 함
// - 예외 상황(req.session 미정의)도 안전 처리
// ------------------------------------------------------

/**
 * 로그인한 사용자만 통과.
 * - 성공: next()
 * - 실패: 401 { ok:false, message:'로그인이 필요합니다.' }
 */
function requireLogin(req, res, next) {
  // 1) CORS 사전요청은 항상 통과 (중간에서 401 막지 않도록)
  if (req.method === 'OPTIONS') {
    // 프리플라이트는 인증 검사 대상 아님
    return res.sendStatus(204);
  }

  // 2) 디버그용 진단 정보 수집
  const cookieHeader = req.headers.cookie || null;
  const hasCookieHeader = !!cookieHeader;
  const sidFromCookieParser = req.cookies ? req.cookies['tzchat.sid'] : undefined; // cookie-parser 사용 시
  const xfProto = req.headers['x-forwarded-proto'] || '(none)';
  const info = {
    path: req.originalUrl,
    method: req.method,
    sessionID: req.sessionID || '(no sessionID)',
    hasSessionObject: !!req.session,
    hasSessionUser: !!(req.session && req.session.user),
    hasCookieHeader,
    sidCookieExists: typeof sidFromCookieParser !== 'undefined',
    xForwardedProto: xfProto,
  };

  // 3) 세션/유저 체크
  if (!req.session || !req.session.user) {
    console.warn('[AUTH][FAIL] requireLogin: no session user', info);
    return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
  }

  // 4) 통과 로그(필요 시 더 조용히 하려면 level 낮추기)
  console.log('[AUTH][PASS] requireLogin', {
    path: req.originalUrl,
    method: req.method,
    sessionID: req.sessionID,
    userId: req.session.user._id,
  });

  return next();
}

module.exports = requireLogin;
