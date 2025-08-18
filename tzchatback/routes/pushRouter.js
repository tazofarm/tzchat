// /server/routes/pushRouter.js
// -------------------------------------------------------------
// ✅ 디바이스 토큰 등록/삭제 API
// - 프론트(네이티브/웹/PWA)에서 토큰 발급 후 여기로 전달
// -------------------------------------------------------------
const express = require('express');
const router = express.Router();
const requireLogin = require('../middlewares/authMiddleware'); // 세션 기반 (기존 유지)
const DeviceToken = require('../models/DeviceToken');

router.post('/register', requireLogin, async (req, res) => {
  try {
    const { token, platform, appVersion } = req.body;
    if (!token || !platform) {
      console.warn('[push/register] 잘못된 요청:', req.body);
      return res.status(400).json({ ok: false, error: 'token, platform 필수' });
    }

    // upsert: 동일 토큰 있으면 업데이트, 없으면 생성
    const saved = await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId: req.session.user._id,
        platform,
        appVersion: appVersion || '',
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('[push/register] 저장 완료:', {
      userId: req.session.user._id,
      platform,
      token: token.slice(0, 12) + '...'
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[push/register] 오류:', err);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

router.post('/unregister', requireLogin, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'token 필수' });

    await DeviceToken.deleteOne({ token });
    console.log('[push/unregister] 삭제 완료:', token.slice(0, 12) + '...');
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/unregister] 오류:', err);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

module.exports = router;
