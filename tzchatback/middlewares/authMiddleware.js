// 로그인한 사용자만 통과
function requireLogin(req, res, next) {
  if (!req.session.user) {
    console.log('[로그인 체크 실패] 로그인 안 된 상태에서 접근 시도:', req.originalUrl);
    return res.status(401).json({ message: '로그인이 필요합니다.' });
  }
  console.log('[로그인 체크 통과] 사용자 ID:', req.session.user._id);
  next();
}

module.exports = requireLogin;