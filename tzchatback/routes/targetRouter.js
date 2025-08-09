const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const FriendRequest = require('../models/friendRequest');
const requireLogin = require('../middlewares/authMiddleware');
const router = express.Router();

/**
 * 🔧 검색 나이 업데이트
 */
router.patch('/search/year', requireLogin, async (req, res) => {
  const userId = req.session.user._id;
  let { year1, year2 } = req.body;

  console.log('📥 [PATCH] /search/year', { userId, year1, year2 });

  const parsedYear1 = (year1 === '' || year1 === '전체') ? null : year1;
  const parsedYear2 = (year2 === '' || year2 === '전체') ? null : year2;

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        search_birthyear1: parsedYear1,
        search_birthyear2: parsedYear2,
      },
      { new: true }
    );

    if (!updated) {
      console.warn('❗ 사용자 없음:', userId);
      return res.status(404).json({ success: false, error: '사용자 없음' });
    }

    console.log('✅ 검색 나이 업데이트 완료:', {
      search_birthyear1: parsedYear1,
      search_birthyear2: parsedYear2,
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 검색 나이 업데이트 실패:', err);
    res.status(500).json({ success: false, error: '검색 나이 업데이트 실패' });
  }
});

/**
 * 🔎 검색 지역 (기존 단일값 저장용)
 */
router.patch('/search/region', requireLogin, async (req, res) => {
  const userId = req.session.user._id;
  const { region1, region2 } = req.body;

  console.log('📥 [PATCH] /search/region', { userId, region1, region2 });

  if (!region1 || !region2) {
    console.warn('⚠️ 지역 정보 부족');
    return res.status(400).json({ success: false, error: '지역 정보가 필요합니다.' });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_region1: region1, search_region2: region2 },
      { new: true }
    );

    if (!updated) {
      console.warn('❗ 사용자 없음:', userId);
      return res.status(404).json({ success: false, error: '사용자 없음' });
    }

    console.log('✅ 검색 지역 업데이트 완료:', { region1, region2 });
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 검색 지역 업데이트 실패:', err);
    res.status(500).json({ success: false, error: '검색 지역 업데이트 실패' });
  }
});

/**
 * 🔎 검색 특징 업데이트
 */
router.patch('/search/preference', requireLogin, async (req, res) => {
  const userId = req.session.user._id;
  const { preference } = req.body;

  console.log('📥 [PATCH] /search/preference', { userId, preference });

  if (!preference) {
    console.warn('⚠️ preference 값 누락');
    return res.status(400).json({ success: false, error: 'preference 값이 필요합니다.' });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_preference: preference },
      { new: true }
    );

    if (!updated) {
      console.warn('❗ 사용자 없음:', userId);
      return res.status(404).json({ success: false, error: '사용자 없음' });
    }

    console.log('✅ 검색 특징 업데이트 완료:', preference);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 검색 특징 업데이트 실패:', err);
    res.status(500).json({ success: false, error: '검색 특징 업데이트 실패' });
  }
});

/**
 * ✅✅ 다중 지역 조건으로 사용자 검색
 */
router.post('/search/users', requireLogin, async (req, res) => {
  try {
    const { regions } = req.body;

    console.log('📥 [POST] /search/users - 검색 조건:', regions);

    if (!regions || regions.length === 0 || regions.some(r => r.region1 === '전체')) {
      const allUsers = await User.find({});
      console.log(`🔍 전체 사용자 조회: ${allUsers.length}명`);
      return res.json(allUsers);
    }

    const orConditions = regions.map(({ region1, region2 }) => {
      if (region2 === '전체') return { region1 };
      return { region1, region2 };
    });

    const users = await User.find({ $or: orConditions });
    console.log(`🔍 조건 일치 사용자 수: ${users.length}명`);
    res.json(users);
  } catch (err) {
    console.error('❌ [검색 사용자 조회 오류]', err);
    res.status(500).json({ success: false, error: '사용자 검색 실패' });
  }
});

/**
 * 🆕 다중 검색 지역 저장
 */
router.patch('/search/regions', requireLogin, async (req, res) => {
  const userId = req.session.user._id;
  const { regions } = req.body;

  console.log('📥 [PATCH] /search/regions', { userId, regions });

  if (!Array.isArray(regions)) {
    return res.status(400).json({ success: false, error: 'regions는 배열이어야 합니다.' });
  }

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { search_regions: regions },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: '사용자 없음' });
    }

    console.log('✅ 다중 검색 지역 저장 완료');
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ 다중 지역 저장 실패:', err);
    res.status(500).json({ success: false, error: '서버 오류' });
  }
});

module.exports = router;
