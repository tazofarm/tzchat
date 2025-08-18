const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ [추가] 비밀번호 해시/검증용 (아래에서 사용함)
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 추가
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');
const router = express.Router();


// 🧹 만료 동기화 미들웨어(기존 유지)
async function syncEmergencyExpiration(req, res, next) {
  try {
    const userId = req?.session?.user?._id;
    if (!userId) return next();

    const me = await User.findById(userId).select('emergency').lean();
    if (!me?.emergency?.isActive) return next();

    const remaining = computeRemaining(me.emergency.activatedAt);
    if (remaining <= 0) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
      });
      console.log(`🧹[SYNC] 만료 감지 → 자동 OFF (user=${userId})`);
    }
    return next();
  } catch (err) {
    console.error('❌ [SYNC] 만료 동기화 실패:', err);
    return next();
  }
}

router.use(requireLogin, syncEmergencyExpiration);

/** 🔴 ON */
router.put('/emergencyon', async (req, res) => {
  console.time('[API] PUT /api/emergencyon');
  try {
    const userId = req.session.user._id;
    const now = new Date();
    const user = await User.findById(userId).select('emergency').lean();

    if (!user) {
      console.timeEnd('[API] PUT /api/emergencyon');
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

    console.log(`[🔴 EMERGENCY ON] user=${userId}, activatedAt=${useActivatedAt}, remaining=${remaining}s, duration=${EMERGENCY_DURATION_SECONDS}s`);
    console.timeEnd('[API] PUT /api/emergencyon');
    return res.json({
      message: 'Emergency 상태 ON',
      activatedAt: useActivatedAt,
      remainingSeconds: remaining,
      durationSeconds: EMERGENCY_DURATION_SECONDS, // 🔎 디버그용
    });
  } catch (error) {
    console.timeEnd('[API] PUT /api/emergencyon');
    console.error('❌ Emergency 상태 ON 실패:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** 🟢 OFF */
router.put('/emergencyoff', async (req, res) => {
  console.time('[API] PUT /api/emergencyoff');
  try {
    const userId = req.session.user._id;

    await User.findByIdAndUpdate(userId, {
      $set: { 'emergency.isActive': false, 'emergency.activatedAt': null }
    });

    console.log(`[🟢 EMERGENCY OFF] user=${userId}`);
    console.timeEnd('[API] PUT /api/emergencyoff');
    return res.json({ message: 'Emergency 상태 OFF' });
  } catch (err) {
    console.timeEnd('[API] PUT /api/emergencyoff');
    console.error('❌ Emergency 상태 OFF 실패:', err);
    return res.status(500).json({ message: 'Emergency 상태 OFF 실패' });
  }
});

/** ✅ 리스트 */
router.get('/emergencyusers', async (req, res) => {
  console.time('[LOAD] GET /api/emergencyusers');
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

    console.log(`[📡 Emergency 사용자 조회] count=${enriched.length}, duration=${EMERGENCY_DURATION_SECONDS}s`);
    console.timeEnd('[LOAD] GET /api/emergencyusers');
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS }); // 🔎 디버그용
  } catch (err) {
    console.timeEnd('[LOAD] GET /api/emergencyusers');
    console.error('❌ Emergency 사용자 조회 실패:', err);
    return res.status(500).json({ message: 'Emergency 사용자 조회 실패' });
  }
});

/** 📡 조건 검색 */
router.post('/search/emergencyusers', async (req, res) => {
  console.time('[LOAD] POST /api/search/emergencyusers');
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

    const users = await User.find(query).select('-password').lean();

    const enriched = (users || []).map(u => ({
      ...u,
      emergency: {
        ...(u.emergency || {}),
        remainingSeconds: computeRemaining(u?.emergency?.activatedAt),
      }
    }));

    console.log(`[📡 Emergency 사용자 필터링 완료] count=${enriched.length}, duration=${EMERGENCY_DURATION_SECONDS}s`);
    console.timeEnd('[LOAD] POST /api/search/emergencyusers');
    return res.json({ users: enriched, durationSeconds: EMERGENCY_DURATION_SECONDS }); // 🔎 디버그용
  } catch (err) {
    console.timeEnd('[LOAD] POST /api/search/emergencyusers');
    console.error('❌ Emergency 사용자 필터링 실패:', err);
    return res.status(500).json({ message: 'Emergency 사용자 필터링 실패' });
  }
});

module.exports = router;