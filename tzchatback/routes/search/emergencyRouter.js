// routes/search/emergencyRouter.js
// base: /api
// -------------------------------------------------------------
// 🚨 Emergency 라우터
// - index.js 에서 app.use('/api', ...) 로 마운트되므로 내부 경로에 '/api' 금지
// - 로그 경로는 항상 req.baseUrl + req.path 로 동적 출력
// -------------------------------------------------------------
const express = require('express');

// models/index.js 가 모든 모델을 export 한다는 가정
const { User } = require('@/models');

const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('@/config/emergency');

const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');


const router = express.Router();




// ================================
// 🔐 인증 유틸 (JWT/세션 병행 지원)
// ================================
function getAuthUserId(req) {
  const jwtId  = req?.user?._id || req?.user?.sub || null;
  const sessId = req?.session?.user?._id || null;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || null;
}

// 경로 문자열 헬퍼
const p = (req) => (req.baseUrl || '') + (req.path || '');

// ✅ 공용 인증 미들웨어: JWT 또는 세션 중 하나만 있어도 통과
function ensureAuth(req, res, next) {
  const userId = getAuthUserId(req);
  if (userId) {
    console.log('[AUTH][REQ]', { path: p(req), userId });
    return next();
  }
  console.warn('[AUTH][ERR]', { path: p(req), step: 'ensureAuth', code: 'NO_LOGIN' });
  return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
}

// 🧹 만료 동기화 미들웨어(활성 중 만료되었으면 자동 OFF)
async function syncEmergencyExpiration(req, _res, next) {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return next();

    console.log('[API][REQ]', { path: p(req) + '::syncEmergencyExpiration', method: req.method, userId });

    const me = await User.findById(userId).select('emergency').lean();
    if (!me?.emergency?.isActive) return next();

    const remaining = computeRemaining(me.emergency.activatedAt);
    if (remaining <= 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
      });
      console.log('🧹[SYNC][AUTO_OFF]', { userId });
    }
    return next();
  } catch (err) {
    console.error('[API][ERR]', { path: p(req) + '::syncEmergencyExpiration', message: err?.message });
    return next();
  }
}

// 라우터 전역 미들웨어
router.use(ensureAuth, blockIfPendingDeletion, syncEmergencyExpiration);

/** 🔴 ON */
router.put('/emergencyon', async (req, res) => {
  const label = `[API] ${req.method} ${p(req)}`;
  console.time(label);
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: p(req), method: 'PUT', userId });

  try {
    const now = new Date();
    const user = await User.findById(userId).select('emergency').lean();
    if (!user) {
      console.timeEnd(label);
      console.warn('[API][RES]', { path: p(req), status: 404 });
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const wasActive = user.emergency?.isActive === true;
    const prevActivatedAt = user.emergency?.activatedAt || null;

    let useActivatedAt = prevActivatedAt;
    let remaining = computeRemaining(prevActivatedAt);

    if (!wasActive || remaining <= 0) {
      useActivatedAt = now;                    // 새 시작
      remaining = EMERGENCY_DURATION_SECONDS;  // full duration
    }

    await User.findByIdAndUpdate(userId, {
      $set: { 'emergency.isActive': true, 'emergency.activatedAt': useActivatedAt }
    });

    console.log('[API][EMERGENCY_ON]', {
      path: p(req),
      userId,
      activatedAt: useActivatedAt,
      remaining,
      duration: EMERGENCY_DURATION_SECONDS
    });

    console.timeEnd(label);
    console.log('[API][RES]', { path: p(req), status: 200 });
    return res.json({
      message: 'Emergency 상태 ON',
      activatedAt: useActivatedAt,
      remainingSeconds: remaining,
      durationSeconds: EMERGENCY_DURATION_SECONDS,
    });
  } catch (error) {
    console.timeEnd(label);
    console.error('[API][ERR]', { path: p(req), message: error?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** 🟢 OFF */
router.put('/emergencyoff', async (req, res) => {
  const label = `[API] ${req.method} ${p(req)}`;
  console.time(label);
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: p(req), method: 'PUT', userId });

  try {
    await User.findByIdAndUpdate(userId, {
      $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
    });

    console.log('[API][EMERGENCY_OFF]', { path: p(req), userId });
    console.timeEnd(label);
    console.log('[API][RES]', { path: p(req), status: 200 });
    return res.json({ message: 'Emergency 상태 OFF' });
  } catch (err) {
    console.timeEnd(label);
    console.error('[API][ERR]', { path: p(req), message: err?.message });
    return res.status(500).json({ message: 'Emergency 상태 OFF 실패' });
  }
});

/** ✅ 리스트 */
router.get('/emergencyusers', async (req, res) => {
  const label = `[LOAD] ${req.method} ${p(req)}`;
  console.time(label);
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: p(req), method: 'GET', userId });

  try {
    const windowAgo = new Date(Date.now() - EMERGENCY_DURATION_SECONDS * 1000);

    const users = await User.find({
      'emergency.isActive': true,
      'emergency.activatedAt': { $gte: windowAgo }
    }).select('-password').lean();

    const enriched = (users || []).map(u => ({
      ...u,
      emergency: {
        ...(u.emergency || {}),
        remainingSeconds: computeRemaining(u?.emergency?.activatedAt),
      }
    }));

    console.log('[API][EMERGENCY_LIST]', { path: p(req), count: enriched.length, duration: EMERGENCY_DURATION_SECONDS });
    console.timeEnd(label);
    console.log('[API][RES]', { path: p(req), status: 200 });
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd(label);
    console.error('[API][ERR]', { path: p(req), message: err?.message });
    return res.status(500).json({ message: 'Emergency 사용자 조회 실패' });
  }
});

/** 📡 조건 검색 */
router.post('/search/emergencyusers', async (req, res) => {
  const label = `[LOAD] ${req.method} ${p(req)}`;
  console.time(label);
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: p(req), method: 'POST', userId, bodyKeys: Object.keys(req.body || {}) });

  try {
    const { regions } = req.body || {};
    const windowAgo = new Date(Date.now() - EMERGENCY_DURATION_SECONDS * 1000);

    const baseCondition = {
      'emergency.isActive': true,
      'emergency.activatedAt': { $gte: windowAgo }
    };

    const useAll = !regions || regions.length === 0 || regions.some(r => r.region1 === '전체');

    const orConditions = useAll ? [] : regions.map(({ region1, region2 }) => {
      return (region2 === '전체') ? { region1 } : { region1, region2 };
    });

    const query = useAll ? baseCondition : { ...baseCondition, $or: orConditions };

    console.log('[DB][QRY]', { model: 'User', op: 'find', criteria: query });

    const users = await User.find(query).select('-password').lean();

    const enriched = (users || []).map(u => ({
      ...u,
      emergency: {
        ...(u.emergency || {}),
        remainingSeconds: computeRemaining(u?.emergency?.activatedAt),
      }
    }));

    console.log('[API][EMERGENCY_FILTER]', { path: p(req), count: enriched.length, duration: EMERGENCY_DURATION_SECONDS });
    console.timeEnd(label);
    console.log('[API][RES]', { path: p(req), status: 200 });
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS });
  } catch (err) {
    console.timeEnd(label);
    console.error('[API][ERR]', { path: p(req), message: err?.message });
    return res.status(500).json({ message: 'Emergency 사용자 필터링 실패' });
  }
});

module.exports = router;
