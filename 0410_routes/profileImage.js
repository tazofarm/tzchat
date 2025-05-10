const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const User = require('../0500_models/User'); // User 모델을 불러옵니다.

// 📁 임시 저장 폴더 생성
const tempDir = path.join(__dirname, '..', 'temp_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 📷 multer: 임시 파일로 저장
const upload = multer({ dest: tempDir });

// 📤 업로드 요청 처리
router.post('/upload', upload.single('profileImage'), async (req, res) => {
  try {
    const userId = Array.isArray(req.body.userId) ? req.body.userId[0] : req.body.userId;

    // ✅ 파일이 존재하지 않으면 오류 발생
    if (!req.file || !req.file.path) {
      throw new Error('파일이 업로드되지 않았습니다.');
    }

    const userDir = path.join(__dirname, '..', '0200_public', 'uploads', 'profile', userId);

    // 사용자 전용 폴더 없으면 생성
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const outputPath = path.join(userDir, 'profile.jpg');

    // 기존 파일이 있으면 삭제
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // 🔧 이미지 압축 & 저장
    await sharp(req.file.path)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);

    // DB에 저장될 경로
    const imagePath = `/uploads/profile/${userId}/profile.jpg`;
    await User.findByIdAndUpdate(userId, { profileImage: imagePath });

    res.redirect('/a005'); // 업로드 후 프로필 페이지로
  } catch (err) {
    console.error('이미지 업로드 실패:', err);
    res.status(500).send('이미지 업로드 실패');
  }
});

// 🗑️ 삭제 요청 처리
router.post('/delete', async (req, res) => {
  try {
    const userId = Array.isArray(req.body.userId) ? req.body.userId[0] : req.body.userId;
    const filePath = path.join(__dirname, '..', '0200_public', 'uploads', 'profile', userId, 'profile.jpg');

    // 파일이 있으면 삭제
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 사용자 정보에서 성별 확인 후 기본 이미지 설정
    const user = await User.findById(userId);
    let defaultImage = '/images/default-profile.jpg';

    if (user.gender === '남자') {
      defaultImage = '/images/default_man.jpg';
    } else if (user.gender === '여자') {
      defaultImage = '/images/default_woman.jpg';
    }

    // DB에 성별에 맞는 기본 이미지 경로 설정
    await User.findByIdAndUpdate(userId, { profileImage: defaultImage });

    res.redirect('/a005');
  } catch (err) {
    console.error('이미지 삭제 실패:', err);
    res.status(500).send('이미지 삭제 실패');
  }
});

module.exports = router;