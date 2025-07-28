const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Friend = require('../models/Friend');
const router = express.Router();



// nickname update
router.put('/update-nickname', async (req, res) => {
  try {
    const userId = req.session.user._id
    const { nickname } = req.body

    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({ success: false, message: '닉네임이 비었습니다.' })
    }

    const existing = await User.findOne({ nickname })
    if (existing) {
      return res.status(409).json({ success: false, message: '중복된 닉네임입니다.' })
    }

    await User.findByIdAndUpdate(userId, { nickname })
    return res.json({ success: true })
  } catch (err) {
    console.error('닉네임 업데이트 실패:', err)
    return res.status(500).json({ success: false, message: '서버 오류' })
  }
})



// region 업데이트
router.patch('/user/region', async (req, res) => {
  try {
    const userId = req.session.user?._id
    const { region1, region2 } = req.body

    if (!userId || !region1 || !region2) {
      return res.status(400).json({ message: '잘못된 요청' })
    }

    await User.findByIdAndUpdate(userId, { region1, region2 })
    res.json({ message: '지역 정보가 업데이트되었습니다.' })
  } catch (err) {
    console.error('지역 정보 업데이트 실패:', err)
    res.status(500).json({ message: '서버 오류' })
  }


})


module.exports = router;
