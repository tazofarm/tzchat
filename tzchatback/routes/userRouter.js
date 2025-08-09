const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const FriendRequest = require('../models/friendRequest');
const requireLogin = require('../middlewares/authMiddleware'); // 🔐 로그인 확인 미들웨어
const router = express.Router();

/**
 * 🔧 닉네임 업데이트 API (로그인 필요)
 */
router.put('/update-nickname', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { nickname } = req.body;

    console.log('📨 닉네임 업데이트 요청:', { userId, nickname });

    if (!nickname || nickname.trim() === '') {
      console.warn('⚠️ 닉네임이 비어 있습니다.');
      return res.status(400).json({ success: false, message: '닉네임이 비어있습니다.' });
    }

    const trimmedNickname = nickname.trim();
    const existing = await User.findOne({ nickname: trimmedNickname });
    if (existing) {
      console.warn('⚠️ 닉네임 중복:', trimmedNickname);
      return res.status(409).json({ success: false, message: '중복된 닉네임입니다.' });
    }

    await User.findByIdAndUpdate(userId, { nickname: trimmedNickname });
    console.log('✅ 닉네임 업데이트 완료:', trimmedNickname);
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ 닉네임 업데이트 실패:', err);
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

/**
 * 🔧 지역 정보 업데이트 API (로그인 필요)
 */
router.patch('/user/region', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { region1, region2 } = req.body;

    console.log('📨 지역 업데이트 요청:', { userId, region1, region2 });

    if (!region1 || !region2) {
      console.warn('⚠️ 요청 값 부족');
      return res.status(400).json({ message: '잘못된 요청: region1, region2가 필요합니다.' });
    }

    await User.findByIdAndUpdate(userId, { region1, region2 });
    console.log('✅ 지역 정보 업데이트 완료');
    res.json({ message: '지역 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('❌ 지역 정보 업데이트 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🔧 자기소개 업데이트 (로그인 필요)
 */
router.put('/update-selfintro', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const newIntro = req.body.selfintro;

    console.log(`[PUT] /update-selfintro 호출됨, userId: ${userId}, selfintro: ${newIntro}`);

    const user = await User.findByIdAndUpdate(userId, { selfintro: newIntro }, { new: true });

    if (!user) {
      console.warn(`❗ 사용자 없음: ${userId}`);
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('✅ 자기소개 업데이트 완료');
    res.json({ success: true, selfintro: user.selfintro });
  } catch (error) {
    console.error(`[에러] selfintro 업데이트 실패:`, error);
    res.status(500).json({ message: '서버 에러' });
  }
});

/**
 * 🔧 특징(내 정보) 업데이트 (로그인 필요)
 */
router.patch('/user/preference', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { preference } = req.body;

    console.log(`[PATCH] /user/preference 호출됨`, { userId, preference });

    if (!preference) {
      console.warn('⚠️ preference 값이 없습니다.');
      return res.status(400).json({ message: '값이 부족합니다.' });
    }

    const user = await User.findByIdAndUpdate(userId, { preference }, { new: true });

    if (!user) {
      console.warn(`❗ 사용자 없음: ${userId}`);
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('✅ preference 업데이트 완료');
    res.json({ success: true, preference: user.preference });
  } catch (err) {
    console.error('[에러] preference 업데이트 실패:', err);
    res.status(500).json({ message: '서버 에러' });
  }
});

module.exports = router;
