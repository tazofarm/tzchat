const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ 비밀번호 해시/검증용
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

// ✅ 공통 인증 미들웨어(OPTIONS 통과 + Bearer/X-Auth-Token/쿠키/쿼리 지원)
const requireLogin = require('../middlewares/authMiddleware');

const router = express.Router();

/* -----------------------------------------------------------
 * 공통: 내 사용자 ID 추출 (JWT 우선, 세션 백업)
 *  - authMiddleware가 req.user / req.session.user 를 맞춰줍니다.
 * ---------------------------------------------------------*/
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  if (jwtId) return String(jwtId);
  if (sessId) return String(sessId);
  return null;
}

/**
 * 🔧 닉네임 업데이트 API (로그인 필요)
 */
router.put('/update-nickname', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  console.log('[API][REQ]', { path: '/update-nickname', method: 'PUT', params: req.params, userId });

  try {
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'getMyId', message: 'Unauthorized' });
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    const { nickname } = req.body || {};
    console.log('[API][REQ]', { path: '/update-nickname', body: { nickname } });

    if (!nickname || String(nickname).trim() === '') {
      console.warn('[API][ERR]', { path: '/update-nickname', message: '닉네임이 비어있습니다.' });
      return res.status(400).json({ success: false, message: '닉네임이 비어있습니다.' });
    }

    const trimmedNickname = String(nickname).trim();

    // ✅ 본인 제외 중복 검사
    console.log('[DB][QRY]', { model: 'User', op: 'findOne', criteria: { nickname: trimmedNickname } });
    const existing = await User.findOne({ nickname: trimmedNickname }).select('_id').lean();
    if (existing && String(existing._id) !== String(userId)) {
      console.warn('[API][ERR]', { path: '/update-nickname', message: '중복된 닉네임입니다.' });
      return res.status(409).json({ success: false, message: '중복된 닉네임입니다.' });
    }

    console.log('[DB][QRY]', { model: 'User', op: 'findByIdAndUpdate', criteria: { _id: userId }, update: { nickname: trimmedNickname } });
    await User.findByIdAndUpdate(userId, { nickname: trimmedNickname });
    console.log('[API][RES]', { path: '/update-nickname', status: 200 });
    return res.json({ success: true });
  } catch (err) {
    console.error('[API][ERR]', { path: '/update-nickname', message: err?.message, name: err?.name });
    return res.status(500).json({ success: false, message: '서버 오류' });
  }
});

/**
 * 🔧 지역 정보 업데이트 API (로그인 필요)
 */
router.patch('/user/region', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  console.log('[API][REQ]', { path: '/user/region', method: 'PATCH', params: req.params, userId });

  try {
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'getMyId', message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const { region1, region2 } = req.body || {};
    console.log('[API][REQ]', { path: '/user/region', body: { region1, region2 } });

    if (!region1 || !region2) {
      console.warn('[API][ERR]', { path: '/user/region', message: '잘못된 요청: region1, region2가 필요합니다.' });
      return res.status(400).json({ message: '잘못된 요청: region1, region2가 필요합니다.' });
    }

    console.log('[DB][QRY]', { model: 'User', op: 'findByIdAndUpdate', criteria: { _id: userId }, update: { region1, region2 } });
    await User.findByIdAndUpdate(userId, { region1, region2 });
    console.log('[API][RES]', { path: '/user/region', status: 200 });
    res.json({ message: '지역 정보가 업데이트되었습니다.' });
  } catch (err) {
    console.error('[API][ERR]', { path: '/user/region', message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🔧 자기소개 업데이트 (로그인 필요)
 */
router.put('/update-selfintro', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  console.log('[API][REQ]', { path: '/update-selfintro', method: 'PUT', params: req.params, userId });

  try {
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'getMyId', message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const newIntro = (req.body || {}).selfintro;
    console.log('[API][REQ]', { path: '/update-selfintro', bodyKeys: Object.keys(req.body || {}) });

    console.log('[DB][QRY]', { model: 'User', op: 'findByIdAndUpdate', criteria: { _id: userId }, update: { selfintro: newIntro }, options: { new: true } });
    const user = await User.findByIdAndUpdate(userId, { selfintro: newIntro }, { new: true });

    if (!user) {
      console.warn('[API][ERR]', { path: '/update-selfintro', message: '사용자 없음', userId });
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('[API][RES]', { path: '/update-selfintro', status: 200 });
    res.json({ success: true, selfintro: user.selfintro });
  } catch (error) {
    console.error('[API][ERR]', { path: '/update-selfintro', message: error?.message, name: error?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

/**
 * 🔧 특징(내 정보) 업데이트 (로그인 필요)
 */
router.patch('/user/preference', requireLogin, async (req, res) => {
  const userId = getMyId(req);
  console.log('[API][REQ]', { path: '/user/preference', method: 'PATCH', params: req.params, userId });

  try {
    if (!userId) {
      console.log('[AUTH][ERR]', { step: 'getMyId', message: 'Unauthorized' });
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const { preference } = req.body || {};
    console.log('[API][REQ]', { path: '/user/preference', body: { preference } });

    if (typeof preference === 'undefined' || preference === null) {
      console.warn('[API][ERR]', { path: '/user/preference', message: '값이 부족합니다.' });
      return res.status(400).json({ message: '값이 부족합니다.' });
    }

    console.log('[DB][QRY]', { model: 'User', op: 'findByIdAndUpdate', criteria: { _id: userId }, update: { preference }, options: { new: true } });
    const user = await User.findByIdAndUpdate(userId, { preference }, { new: true });

    if (!user) {
      console.warn('[API][ERR]', { path: '/user/preference', message: '사용자 없음', userId });
      return res.status(404).json({ message: '사용자 없음' });
    }

    console.log('[API][RES]', { path: '/user/preference', status: 200 });
    res.json({ success: true, preference: user.preference });
  } catch (err) {
    console.error('[API][ERR]', { path: '/user/preference', message: err?.message, name: err?.name });
    res.status(500).json({ message: '서버 에러' });
  }
});

module.exports = router;
