// routers/chatRouter.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../0500_models/User'); // User 모델을 불러옵니다.
const ChatRoom = require('../0500_models/ChatRoom'); // ChatRoom 모델을 불러옵니다.
const Message = require('../0500_models/message'); // Message 모델 가져오기
const authMiddleware = require('../0430_middlewares/authMiddleware'); // authMiddleware 가져오

const { 
  // 컨트롤러 쓸때
} = require('../0420_controllers/userController');

const router = express.Router();


// routes/chatRoomRouter.js
router.post('/api/check-or-create-chatroom', async (req, res) => {
  const { username } = req.body; // 요청 본문에서 username 추출
  const userId = req.session.user._id; // 현재 로그인한 사용자 ID를 추출

  try {
      // 상대방 사용자 정보를 가져옴
      const user = await User.findOne({ username });
      if (!user) return res.status(400).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

      // 기존 채팅방이 있는지 확인
      let chatRoom = await ChatRoom.findOne({ 
          participants: { $all: [userId, user._id] } // 두 사용자가 모두 참여자인 채팅방
      });

      // 채팅방이 존재하지 않으면 새로 생성
      if (!chatRoom) {
          chatRoom = new ChatRoom({
              name: `${req.session.user.username}과 ${user.username}의 채팅방`,
              participants: [userId, user._id]
          });

          await chatRoom.save(); // 채팅방 저장
      }

      res.json({ success: true, chatRoomId: chatRoom._id }); // 존재하는 또는 새로 생성된 방의 ID를 반환
  } catch (error) {
      console.error('채팅방 생성 중 오류 발생:', error);
      res.status(500).json({ success: false, message: '채팅방 생성 중 오류 발생' });
  }
});


// routes/chatRoomRouter.js
router.get('/apichatrooms', async (req, res) => {
  const userId = req.session.user._id; // 현재 로그인한 사용자 ID

  try {
      const chatRooms = await ChatRoom.find({ participants: userId }).populate('participants', 'username nickname'); // 사용자 ID가 포함된 채팅방 찾기
      res.json(chatRooms);
  } catch (error) {
      console.error('채팅 방 목록을 가져오는 중 오류 발생:', error);
      res.status(500).json({ message: '채팅 방 목록을 가져오는 중 오류 발생' });
  }
});


// 특정 채팅방의 페이지 보여주기
router.get('/chat/:chatRoomId', async (req, res) => {
  const { chatRoomId } = req.params;

  // 사용자 세션 확인
  if (!req.session.user) {
      return res.status(401).send('로그인하지 않았습니다.');
  }

  try {
      const chatRoom = await ChatRoom.findById(chatRoomId).populate('participants', 'username nickname');
      if (!chatRoom || !chatRoom.participants) {
          return res.status(404).send('채팅방을 찾을 수 없습니다.');
      }

      // 템플릿 렌더링
      res.render('chatroom', { 
          chatRoom, // 채팅방 정보
          user: req.session.user // 사용자의 정보를 템플릿에 전달
      });
  } catch (error) {
      console.error('채팅방 정보 가져오는 중 오류 발생:', error);
      res.status(500).send('서버 오류 발생');
  }
});

router.post('/api/send-message', async (req, res) => {
  const { chatRoomId, message } = req.body;
  const userId = req.session.user._id; // 현재 로그인된 사용자 ID

  try {
      const newMessage = new Message({
          chatroom: chatRoomId, // chatroom 필드에 ID 추가
          user: userId,         // user 필드에 사용자 ID 추가
          message: message
      });

      await newMessage.save(); // 메시지 저장
      res.json({ success: true }); // 성공 응답
  } catch (error) {
      console.error('메시지 전송 중 오류 발생:', error);
      res.status(500).json({ success: false, message: '메시지 전송 중 오류 발생' });
  }
});

router.get('/api/chatroom/:chatRoomId/messages', async (req, res) => {
  const { chatRoomId } = req.params;

  try {
      const messages = await Message.find({ chatroom: chatRoomId })
          .populate('user', 'nickname username') // 적절한 데이터 필드명으로 변경
          .sort({ timestamp: 1 });

      res.json({ success: true, messages });
  } catch (error) {
      console.error('메시지를 불러오는 중 오류 발생:', error);
      res.status(500).json({ success: false, message: '메시지를 불러오는 중 오류 발생' });
  }
});


module.exports = router;