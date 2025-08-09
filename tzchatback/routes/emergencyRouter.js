const express = require('express');
const User = require('../models/User');
const requireLogin = require('../middlewares/authMiddleware'); // 🔐 로그인 확인 미들웨어
const router = express.Router();

/**
 * 🔴 Emergency 상태 ON
 */
router.put('/emergencyon', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const now = new Date();

    await User.findByIdAndUpdate(userId, {
      $set: {
        'emergency.isActive': true,
        'emergency.activatedAt': now
      }
    });

    const remainingSeconds = 60; // 1시간 → 테스트용 60초

    console.log(`[🔴 EMERGENCY ON] 유저: ${userId}, 시간: ${now}`);
    res.json({
      message: 'Emergency 상태 ON',
      activatedAt: now,
      remainingSeconds
    });
  } catch (error) {
    console.error('❌ Emergency 상태 ON 실패:', error);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🟢 Emergency 상태 OFF
 */
router.put('/emergencyoff', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;

    await User.findByIdAndUpdate(userId, {
      $set: {
        'emergency.isActive': false,
        'emergency.activatedAt': null
      }
    });

    console.log(`[🟢 EMERGENCY OFF] 유저: ${userId}`);
    res.json({ message: 'Emergency 상태 OFF' });
  } catch (err) {
    console.error('❌ Emergency 상태 OFF 실패:', err);
    res.status(500).json({ message: 'Emergency 상태 OFF 실패' });
  }
});

/**
 * ✅ 추가: 프론트 호환용 (GET /api/emergencyusers)
 * - 기본 지역 조건 없이 최근 1시간 내 활성 사용자 전체 조회
 */
router.get('/emergencyusers', requireLogin, async (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;

    const users = await User.find({
      'emergency.isActive': true,
      'emergency.activatedAt': { $gte: new Date(oneHourAgo) }
    }).select('-password').lean();

    const enrichedUsers = enrichEmergencyUsers(users, now);
    console.log(`[📡 Emergency 사용자 조회] ${enrichedUsers.length}명`);
    res.json({ users: enrichedUsers });
  } catch (err) {
    console.error('❌ Emergency 사용자 조회 실패:', err);
    res.status(500).json({ message: 'Emergency 사용자 조회 실패' });
  }
});

/**
 * 📡 [POST] 지역 조건 기반 Emergency 사용자 필터링
 * POST /api/search/emergencyusers
 */
router.post('/search/emergencyusers', requireLogin, async (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const { regions } = req.body;

    console.log('📥 [POST] /search/emergencyusers - 조건:', regions);

    let baseCondition = {
      'emergency.isActive': true,
      'emergency.activatedAt': { $gte: new Date(oneHourAgo) }
    };

    if (!regions || regions.length === 0 || regions.some(r => r.region1 === '전체')) {
      const allUsers = await User.find(baseCondition).select('-password').lean();
      const enriched = enrichEmergencyUsers(allUsers, now);
      return res.json({ users: enriched });
    }

    const orConditions = regions.map(({ region1, region2 }) => {
      if (region2 === '전체') return { region1 };
      return { region1, region2 };
    });

    const users = await User.find({
      ...baseCondition,
      $or: orConditions
    }).select('-password').lean();

    const enrichedUsers = enrichEmergencyUsers(users, now);
    console.log(`[📡 Emergency 사용자 필터링 완료] ${enrichedUsers.length}명`);
    res.json({ users: enrichedUsers });
  } catch (err) {
    console.error('❌ Emergency 사용자 필터링 실패:', err);
    res.status(500).json({ message: 'Emergency 사용자 필터링 실패' });
  }
});

// ⏱️ remainingSeconds 계산기
function enrichEmergencyUsers(userList, now) {
  return userList.map(user => {
    let remainingSeconds = 0;
    if (user.emergency?.activatedAt) {
      const activatedAt = new Date(user.emergency.activatedAt).getTime();
      const elapsed = Math.floor((now - activatedAt) / 1000);
      remainingSeconds = Math.max(0, 3600 - elapsed);
    }

    return {
      ...user,
      emergency: {
        ...user.emergency,
        remainingSeconds
      }
    };
  });
}

module.exports = router;
