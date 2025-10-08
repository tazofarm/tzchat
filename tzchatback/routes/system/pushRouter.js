// /routes/system/pushRouter.js
// base: /api/push
// -------------------------------------------------------------
// ✅ 디바이스 토큰 등록/삭제 API (세션 + JWT 병행 인증)
// - 내부 경로에 /api 사용 금지 (index.js에서 /api/push 로 마운트)
// - 로그/타이머 라벨은 req.baseUrl + req.path 로 일관 출력
// - 민감정보(토큰)는 마스킹
// -------------------------------------------------------------
const express = require('express');

const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
// 전역 가드: 로그인 + 탈퇴대기 차단
router.use(requireLogin, blockIfPendingDeletion);

// models/index.js 가 모든 모델을 export 한다는 가정
const { DeviceToken } = require('@/models');

// ================================
// 🔐 로그인 사용자 ID 헬퍼 (JWT 우선, 세션 백업)
// ================================
function getMyId(req) {
  return (req?.user?._id && String(req.user._id))
      || (req?.session?.user?._id && String(req.session.user._id))
      || null;
}

// 유틸: 토큰 마스킹
function maskToken(token = '') {
  if (!token) return '';
  if (token.length <= 12) return token.slice(0, 4) + '***';
  return token.slice(0, 12) + '...';
}

// ✅ 공통 요청/응답 로깅 미들웨어(선택)
router.use((req, res, next) => {
  const started = Date.now();
  console.log('[API][REQ]', {
    path: req.baseUrl + req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    userId: getMyId(req),
  });

  const _json = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - started;
    const status = res.statusCode;
    const size = typeof body === 'string' ? body.length : Buffer.byteLength(JSON.stringify(body || {}));
    console.log('[API][RES]', { path: req.baseUrl + req.path, status, ms, size });
    return _json(body);
  };
  next();
});

/**
 * ✅ 토큰 등록 (upsert)
 * - 인증: 전역 requireLogin 사용
 * - 요청 바디: { token, platform, appVersion? }
 */
router.post('/register', async (req, res) => {
  const userId = getMyId(req);
  const { token, platform, appVersion } = req.body || {};
  const label = `[API] POST ${req.baseUrl}${req.path}`;

  if (!userId) {
    return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
  }

  console.time(label);
  console.log('[PUSH][REQ]', {
    path: req.baseUrl + req.path,
    userId,
    platform,
    appVersion,
    token: maskToken(token),
  });

  try {
    if (!token || !platform) {
      console.warn('[PUSH][HTTP]', { path: req.baseUrl + req.path, status: 400, reason: 'token, platform 필수' });
      console.timeEnd(label);
      return res.status(400).json({ ok: false, error: 'token, platform 필수' });
    }

    // upsert
    await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId,
        platform,
        appVersion: appVersion || '',
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log('[PUSH][REG]', { userId, platform, token: maskToken(token) });
    console.timeEnd(label);
    return res.json({ ok: true });
  } catch (err) {
    console.timeEnd(label);
    console.error('[API][ERR]', {
      path: req.baseUrl + req.path,
      message: err?.message,
      name: err?.name,
    });
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

/**
 * ✅ 토큰 해제
 * - 인증: 전역 requireLogin 사용
 * - 요청 바디: { token }
 */
router.post('/unregister', async (req, res) => {
  const userId = getMyId(req);
  const { token } = req.body || {};
  const label = `[API] POST ${req.baseUrl}${req.path}`;

  if (!userId) {
    return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
  }

  console.time(label);
  console.log('[PUSH][REQ]', { path: req.baseUrl + req.path, userId, token: maskToken(token) });

  try {
    if (!token) {
      console.warn('[PUSH][HTTP]', { path: req.baseUrl + req.path, status: 400, reason: 'token 필수' });
      console.timeEnd(label);
      return res.status(400).json({ ok: false, error: 'token 필수' });
    }

    const { deletedCount } = await DeviceToken.deleteOne({ token });

    console.log('[PUSH][UNREG]', { userId, token: maskToken(token), deletedCount });
    console.timeEnd(label);
    return res.json({ ok: true });
  } catch (err) {
    console.timeEnd(label);
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name });
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

module.exports = router;
