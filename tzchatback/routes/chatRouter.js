const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용

const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware');

const router = express.Router();

// ✅ Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/chat');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

/**
 * ✅ [1] 채팅방 목록 조회
 */
router.get('/chatrooms', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const chatRooms = await ChatRoom.find({ participants: myId })
      .populate('participants', 'username nickname')
      .populate({
        path: 'messages',
        options: { sort: { createdAt: -1 }, limit: 1 }
      })
      .sort({ updatedAt: -1 });

    res.json(chatRooms);
  } catch (err) {
    console.error('❌ 채팅방 목록 오류:', err);
    res.status(500).json({ message: '채팅방 불러오기 실패' });
  }
});

/**
 * ✅ [2] 채팅방 메시지 조회
 */
router.get('/chatrooms/:id', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { id } = req.params;

    const chatRoom = await ChatRoom.findById(id)
      .populate('participants', 'username nickname')
      .populate({
        path: 'messages',
        populate: { path: 'sender', select: 'nickname' }
      });

    if (!chatRoom || !chatRoom.participants.some(p => p.equals(myId))) {
      return res.status(403).json({ message: '접근 권한 없음' });
    }

    res.json({
      myId,
      participants: chatRoom.participants,
      messages: chatRoom.messages
    });
  } catch (err) {
    console.error('❌ 메시지 조회 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ [3] 메시지 전송 (텍스트/이미지)
 */
router.post('/chatrooms/:id/message', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { id } = req.params;
    const { content, type } = req.body;

    if (type !== 'image' && (!content || !content.trim())) {
      return res.status(400).json({ message: '메시지 내용이 비어 있습니다' });
    }

    const chatRoom = await ChatRoom.findById(id);
    if (!chatRoom || !chatRoom.participants.some(p => p.equals(myId))) {
      return res.status(403).json({ message: '채팅방 접근 권한 없음' });
    }

    const messageData = {
      chatRoom: id,
      sender: myId,
      type: type || 'text'
    };

    if (type === 'image') {
      messageData.imageUrl = content;
    } else {
      messageData.content = content;
    }

    let message = new Message(messageData);
    await message.save();

    chatRoom.messages.push(message._id);
    await chatRoom.save();

    message = await message.populate('sender', 'nickname');
    res.json(message);
  } catch (err) {
    console.error('❌ 메시지 전송 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ [4] 채팅방 생성 or 조회
 */
router.post('/chatrooms', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { userId } = req.body;

    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [myId, userId], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        participants: [myId, userId],
        messages: []
      });
      await chatRoom.save();
    }

    res.json(chatRoom);
  } catch (err) {
    console.error('❌ 채팅방 생성 오류:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ✅ [5] 이미지 업로드 (압축 적용 & 원본 삭제)
 */
router.post('/chatrooms/upload-image', requireLogin, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: '파일이 존재하지 않습니다.' });
    }

    const originalPath = file.path;
    const compressedPath = path.join(file.destination, 'compressed-' + file.filename);

    // ✅ 이미지 압축 (최대 1024px, JPEG, 품질 70)
    await sharp(originalPath)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(compressedPath);

    // ✅ 원본 삭제
    fs.unlinkSync(originalPath);

    const imageUrl = `/uploads/chat/${path.basename(compressedPath)}`;
    console.log('✅ 압축 이미지 저장 완료:', imageUrl);

    res.json({ imageUrl });
  } catch (err) {
    console.error('❌ 이미지 업로드 오류:', err);
    res.status(500).json({ message: '이미지 업로드 실패' });
  }
});

module.exports = router;
