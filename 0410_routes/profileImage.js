// routes/profileImage.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../0500_models/User'); // User 모델을 불러옵니다.

// 저장 경로 및 파일명
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// 업로드 요청 처리
router.post('/upload', upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.body.userId;
    const imagePath = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(userId, { profileImage: imagePath });
    res.redirect('/a005'); // 업로드 후 프로필 페이지로
  } catch (err) {
    console.error(err);
    res.status(500).send('이미지 업로드 실패');
  }
});

module.exports = router;