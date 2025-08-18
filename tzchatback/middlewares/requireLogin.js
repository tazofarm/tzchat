// middlewares/requireLogin.js
// 세션에 로그인 정보가 있는지 확인 (없으면 401)
module.exports = function requireLogin(req, res, next) {
  try {
    if (!req.session || !req.session.user?._id) {
      console.warn('[AUTH] requireLogin -> 401 (no session.user)', {
        path: req.originalUrl, ip: req.ip, ua: req.headers['user-agent'],
      });
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    }
    next();
  } catch (err) {
    console.error('[AUTH] requireLogin ERROR', err);
    res.status(500).json({ ok: false, error: '서버 오류' });
  }
};
