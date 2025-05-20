// middlewares/authMiddleware.js
module.exports = (req, res, next) => {
    if (req.session && req.session.user) {
        return next(); // 로그인 되어 있으면 다음 미들웨어로 진행
    }
    // 로그인하지 않은 경우
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
};