const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용(현재 라우터에선 직접 사용 X, 유지)
const bcrypt = require('bcrypt'); // ✅ [추가] 비밀번호 해시/검증용 (현재 라우터에선 직접 사용 X, 유지)
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 유지(현재 파일에선 직접 사용 X)
const ChatRoom = require('../models/ChatRoom');           // ✅ 유지(현재 파일에선 직접 사용 X)
const Message = require('../models/Message');             // ✅ 유지(현재 파일에선 직접 사용 X)
const requireLogin = require('../middlewares/authMiddleware');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

// ================================
// 🔐 인증 유틸 (JWT/세션 병행 지원)
// ================================
function getAuthUserId(req) {
  // JWT 미들웨어(main.js)에서 채워주는 req.user 우선
  const jwtId = req?.user?._id || req?.user?.sub || null;
  const sessId = req?.session?.user?._id || null;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || null;
}

// ✅ 공용 인증 미들웨어: JWT 또는 세션 중 하나만 있어도 통과
function ensureAuth(req, res, next) {
  const userId = getAuthUserId(req);
  if (userId) {
    // [AUTH][REQ] 로그 (민감정보 마스킹)
    console.log('[AUTH][REQ]', { path: req.path, userId });
    return next();
  }
  console.log('[AUTH][ERR]', { step: 'ensureAuth', code: 'NO_LOGIN', message: '로그인이 필요합니다.' });
  return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
}

// 🧹 만료 동기화 미들웨어(기존 유지, userId 접근 로직만 통합)
async function syncEmergencyExpiration(req, res, next) {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return next();

    console.log('[API][REQ]', { path: '/syncEmergencyExpiration', method: req.method, userId });

    const me = await User.findById(userId).select('emergency').lean();
    if (!me?.emergency?.isActive) return next();

    const remaining = computeRemaining(me.emergency.activatedAt);
    if (remaining <= 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
      });
      console.log('🧹[SYNC]', { action: 'AUTO_OFF', userId });
    }
    return next();
  } catch (err) {
    console.log('[API][ERR]', { path: '/syncEmergencyExpiration', message: err.message });
    return next();
  }
}

// ⚠️ 기존 requireLogin 유지하되, JWT 사용자도 통과되도록 ensureAuth로 대체
//    (requireLogin이 세션에만 의존한다면, ensureAuth가 이를 포괄)
router.use(ensureAuth, syncEmergencyExpiration);

/** 🔴 ON */
router.put('/emergencyon', async (req, res) => {
  console.time('[API] PUT /api/emergencyon');
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: '/api/emergencyon', method: 'PUT', userId });

  try {
    const now = new Date();
    const user = await User.findById(userId).select('emergency').lean();

    if (!user) {
      console.timeEnd('[API] PUT /api/emergencyon');
      console.log('[API][RES]', { path: '/api/emergencyon', status: 404, ms: null });
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const wasActive = user.emergency?.isActive === true;
    const prevActivatedAt = user.emergency?.activatedAt || null;

    let useActivatedAt = prevActivatedAt;
    let remaining = computeRemaining(prevActivatedAt);

    if (!wasActive || remaining <= 0) {
      useActivatedAt = now;                    // 새 시작
      remaining = EMERGENCY_DURATION_SECONDS;  // full duration
    } // 이미 ON이면 유지

    await User.findByIdAndUpdate(userId, {
      $set: { 'emergency.isActive': true, 'emergency.activatedAt': useActivatedAt }
    });

    console.log('[API]', {
      tag: 'EMERGENCY_ON',
      userId,
      activatedAt: useActivatedAt,
      remaining,
      duration: EMERGENCY_DURATION_SECONDS
    });

    console.timeEnd('[API] PUT /api/emergencyon');
    console.log('[API][RES]', { path: '/api/emergencyon', status: 200 });
    return res.json({
      message: 'Emergency 상태 ON',
      activatedAt: useActivatedAt,
      remainingSeconds: remaining,
      durationSeconds: EMERGENCY_DURATION_SECONDS, // 🔎 디버그용
    });
  } catch (error) {
    console.timeEnd('[API] PUT /api/emergencyon');
    console.log('[API][ERR]', { path: '/api/emergencyon', message: error.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** 🟢 OFF */
router.put('/emergencyoff', async (req, res) => {
  console.time('[API] PUT /api/emergencyoff');
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: '/api/emergencyoff', method: 'PUT', userId });

  try {
    await User.findByIdAndUpdate(userId, {
      $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
    });

    console.log('[API]', { tag: 'EMERGENCY_OFF', userId });
    console.timeEnd('[API] PUT /api/emergencyoff');
    console.log('[API][RES]', { path: '/api/emergencyoff', status: 200 });
    return res.json({ message: 'Emergency 상태 OFF' });
  } catch (err) {
    console.timeEnd('[API] PUT /api/emergencyoff');
    console.log('[API][ERR]', { path: '/api/emergencyoff', message: err.message });
    return res.status(500).json({ message: 'Emergency 상태 OFF 실패' });
  }
});

/** ✅ 리스트 */
router.get('/emergencyusers', async (req, res) => {
  console.time('[LOAD] GET /api/emergencyusers');
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: '/api/emergencyusers', method: 'GET', userId });

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

    console.log('[API]', { tag: 'EMERGENCY_LIST', count: enriched.length, duration: EMERGENCY_DURATION_SECONDS });
    console.timeEnd('[LOAD] GET /api/emergencyusers');
    console.log('[API][RES]', { path: '/api/emergencyusers', status: 200 });
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS }); // 🔎 디버그용
  } catch (err) {
    console.timeEnd('[LOAD] GET /api/emergencyusers');
    console.log('[API][ERR]', { path: '/api/emergencyusers', message: err.message });
    return res.status(500).json({ message: 'Emergency 사용자 조회 실패' });
  }
});

/** 📡 조건 검색 */
router.post('/search/emergencyusers', async (req, res) => {
  console.time('[LOAD] POST /api/search/emergencyusers');
  const userId = getAuthUserId(req);
  console.log('[API][REQ]', { path: '/api/search/emergencyusers', method: 'POST', userId, bodyKeys: Object.keys(req.body || {}) });

  try {
    const { regions } = req.body;
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

    console.log('[API]', { tag: 'EMERGENCY_FILTER', count: enriched.length, duration: EMERGENCY_DURATION_SECONDS });
    console.timeEnd('[LOAD] POST /api/search/emergencyusers');
    console.log('[API][RES]', { path: '/api/search/emergencyusers', status: 200 });
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS }); // 🔎 디버그용
  } catch (err) {
    console.timeEnd('[LOAD] POST /api/search/emergencyusers');
    console.log('[API][ERR]', { path: '/api/search/emergencyusers', message: err.message });
    return res.status(500).json({ message: 'Emergency 사용자 필터링 실패' });
  }
});

module.exports = router;
