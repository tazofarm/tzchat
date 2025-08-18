// middlewares/requireMaster.js
// 요청자 역할이 master인지 확인 (아니면 403)
const User = require('../models/User'); // ✅ 우분투 대비: 파일명 소문자

module.exports = async function requireMaster(req, res, next) {
  const t0 = Date.now();
  try {
    // 1) 세션 확인
    const uid = req.session?.user?._id;
    if (!uid) {
      console.warn('[AUTH] requireMaster -> 401 (no session.user)', {
        path: req.originalUrl, ip: req.ip, ua: req.headers['user-agent'],
      });
      return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
    }

    // 2) 사용자 조회 (비밀번호 제외)
    const me = await User.findById(uid).select('role nickname');
    if (!me) {
      console.warn('[AUTH] requireMaster -> 404 (user not found)', { uid, path: req.originalUrl });
      return res.status(404).json({ ok: false, error: '사용자를 찾을 수 없습니다.' });
    }

    // 3) 역할 검사
    if (me.role !== 'master') {
      console.warn('[AUTH] requireMaster -> 403 (role not master)', {
        uid: String(me._id), nickname: me.nickname, role: me.role, path: req.originalUrl,
      });
      return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    }

    // 4) 통과 (추적 로그 + 처리시간)
    console.log('[AUTH] requireMaster OK', {
      uid: String(me._id), nickname: me.nickname, role: me.role,
      path: req.originalUrl, ms: Date.now() - t0,
    });
    return next();
  } catch (err) {
    console.error('[AUTH] requireMaster ERROR', err);
    return res.status(500).json({ ok: false, error: '서버 오류' });
  }
};
