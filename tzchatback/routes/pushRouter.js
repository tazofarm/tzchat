// /server/routes/pushRouter.js
// -------------------------------------------------------------
// ✅ 디바이스 토큰 등록/삭제 API (세션 + JWT 병행 인증)
// - 프론트(네이티브/웹/PWA)에서 토큰 발급 후 여기로 전달
// - 기존 requireLogin(세션 전용) 대신 ensureAuth(JWT/세션 공용) 사용
// - 로그는 운영 분석 가능 수준으로 상세 기록(민감정보 마스킹)
// -------------------------------------------------------------
const express = require('express');
const router = express.Router();
const requireLogin = require('../middlewares/authMiddleware'); // (유지용 import, 현 라우터에서는 미사용)
const DeviceToken = require('../models/DeviceToken');

// ================================
// 🔐 인증 유틸 (JWT/세션 병행 지원)
// ================================
function getAuthUserId(req) {
  const jwtId = req?.user?._id || req?.user?.sub || null;     // main.js의 JWT 미들웨어가 세팅
  const sessId = req?.session?.user?._id || null;             // 기존 세션
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || null;
}

function ensureAuth(req, res, next) {
  const userId = getAuthUserId(req);
  if (userId) {
    console.log('[AUTH][REQ]', { path: req.path, method: req.method, userId });
    return next();
  }
  console.log('[AUTH][ERR]', { step: 'ensureAuth', code: 'NO_LOGIN', message: '로그인이 필요합니다.' });
  return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
}

// 유틸: 토큰 마스킹
function maskToken(token = '') {
  if (!token) return '';
  if (token.length <= 12) return token.slice(0, 4) + '***';
  return token.slice(0, 12) + '...';
}

/**
 * ✅ 토큰 등록
 * - upsert: 동일 토큰 있으면 업데이트, 없으면 생성
 * - 인증: 세션 또는 JWT
 */
router.post('/register', ensureAuth, async (req, res) => {
  console.time('[API] POST /api/push/register');
  const userId = getAuthUserId(req);
  const { token, platform, appVersion } = req.body || {};

  console.log('[API][REQ]', { path: '/api/push/register', method: 'POST', userId, platform, appVersion });

  try {
    if (!token || !platform) {
      console.warn('[API][HTTP]', { path: '/api/push/register', status: 400, reason: 'token, platform 필수' });
      console.timeEnd('[API] POST /api/push/register');
      return res.status(400).json({ ok: false, error: 'token, platform 필수' });
    }

    console.log('[DB][QRY]', {
      model: 'DeviceToken',
      op: 'findOneAndUpdate',
      criteria: { token: '(masked)' },
      note: 'upsert=true'
    });

    const saved = await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId,
        platform,
        appVersion: appVersion || '',
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('[PUSH][REG]', {
      userId,
      platform,
      token: maskToken(token),
      docId: saved?._id || null
    });

    console.timeEnd('[API] POST /api/push/register');
    console.log('[API][RES]', { path: '/api/push/register', status: 200 });
    return res.json({ ok: true });
  } catch (err) {
    console.timeEnd('[API] POST /api/push/register');
    console.log('[API][ERR]', {
      path: '/api/push/register',
      message: err?.message,
      name: err?.name
    });
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

/**
 * ✅ 토큰 해제
 * - 인증: 세션 또는 JWT
 */
router.post('/unregister', ensureAuth, async (req, res) => {
  console.time('[API] POST /api/push/unregister');
  const userId = getAuthUserId(req);
  const { token } = req.body || {};

  console.log('[API][REQ]', { path: '/api/push/unregister', method: 'POST', userId });

  try {
    if (!token) {
      console.warn('[API][HTTP]', { path: '/api/push/unregister', status: 400, reason: 'token 필수' });
      console.timeEnd('[API] POST /api/push/unregister');
      return res.status(400).json({ ok: false, error: 'token 필수' });
    }

    console.log('[DB][QRY]', { model: 'DeviceToken', op: 'deleteOne', criteria: { token: '(masked)' } });
    const { deletedCount } = await DeviceToken.deleteOne({ token });

    console.log('[PUSH][UNREG]', {
      userId,
      token: maskToken(token),
      deletedCount
    });

    console.timeEnd('[API] POST /api/push/unregister');
    console.log('[API][RES]', { path: '/api/push/unregister', status: 200 });
    return res.json({ ok: true });
  } catch (err) {
    console.timeEnd('[API] POST /api/push/unregister');
    console.log('[API][ERR]', { path: '/api/push/unregister', message: err?.message, name: err?.name });
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

module.exports = router;
