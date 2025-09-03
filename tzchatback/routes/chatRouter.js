// routes/chatRouter.js
// -------------------------------------------------------------
// 💬 채팅 라우터 (JWT 기반 인증 전환)
// - 리스트: 마지막 메시지 + 내 미읽음(unreadCount) 동봉
// - 메시지 전송: lastMessage/updatedAt 즉시 갱신 (+ 소켓 전파 + 🔔푸시 발송)
// - 읽음 처리: 상대가 보낸 미읽음 → readBy에 내 ID 추가 (+ 소켓 전파)
// - 총 미읽음: TopMenu ⓝ 용 집계 API
// -------------------------------------------------------------
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // 이미지 압축
const mongoose = require('mongoose');

const bcrypt = require('bcrypt'); // (현 파일에선 직접 사용 X, 기존 유지)
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');

// 🔐 JWT 기반 인증 미들웨어 (req.user 설정 가정)
// - 기존 경로/이름 유지
const requireLogin = require('../middlewares/authMiddleware');

const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');

const router = express.Router();

// ✅ 푸시 발송 모듈
const { sendPushToUser } = require('../push/sender');

// 작은 헬퍼: 안전 로그
const log = (...args) => console.log('[chatRouter]', ...args);

// 공통: 내 사용자 ID 획득 (JWT 우선, 세션은 백업)
// - 점진 전환기 동안의 호환성 확보(세션 제거 시 이 로직만 수정)
function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

// 작은 헬퍼: 소켓 가져오기(옵션)
const getIO = (req) => {
  try {
    return req.app.get('io');
  } catch {
    return null;
  }
};

/* ===========================================
 * Multer 설정 (이미지 업로드)
 * =========================================== */
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

/* ===========================================
 * [1] 채팅방 목록 조회
 * - 내 참여방만 조회
 * - 각 방의 마지막 메시지 + 내 미읽음(unreadCount) 포함
 * - 정렬: updatedAt DESC
 * - 응답 루트: 배열([])  ← 프론트와 약속
 * =========================================== */
router.get('/chatrooms', requireLogin, async (req, res) => {
  console.time('[GET]/chatrooms');
  console.log('[API][REQ]', { path: '/api/chatrooms', method: 'GET', params: req.params, userId: getMyId(req) });

  try {
    const myId = getMyId(req);
    if (!myId) {
      console.warn('[AUTH][ERR]', { step: 'getMyId', message: 'no auth user' });
      console.timeEnd('[GET]/chatrooms');
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'find', criteria: { participants: myObjId } });

    // 1) 내가 속한 방들 최신순 (participants는 username/nickname만)
    const rooms = await ChatRoom.find({ participants: myObjId })
      .select('_id participants lastMessage updatedAt createdAt')
      .populate('participants', 'username nickname')
      .sort({ updatedAt: -1 })
      .lean();

    if (!rooms.length) {
      console.log('[API][RES]', { path: '/api/chatrooms', status: 200, ms: 0, size: 2 });
      console.timeEnd('[GET]/chatrooms');
      return res.json([]);
    }

    const roomIds = rooms.map(r => r._id);

    // 2) 방별 마지막 메시지 + 미읽음 수 집계
    const pipeline = [
      { $match: { chatRoom: { $in: roomIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$chatRoom',
          last: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sender', myObjId] }, // 보낸이가 내가 아님
                    { $not: [{ $in: [myObjId, { $ifNull: ['$readBy', []] }] }] } // readBy null-safe
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ];

    console.log('[DB][QRY]', { model: 'Message', op: 'aggregate', criteria: pipeline });
    const agg = await Message.aggregate(pipeline);
    const byRoomId = new Map(agg.map(x => [String(x._id), x]));

    // 3) 응답 데이터 구성
    const result = rooms.map(r => {
      const extra = byRoomId.get(String(r._id));
      const lastDoc = extra?.last;
      const lastMessage = lastDoc
        ? {
            _id: lastDoc._id,
            content: lastDoc.content || '',
            imageUrl: lastDoc.imageUrl || '',
            sender: lastDoc.sender,
            createdAt: lastDoc.createdAt
          }
        : (r.lastMessage || null);

      return {
        _id: r._id,
        participants: r.participants,
        lastMessage,
        unreadCount: extra?.unreadCount || 0,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt
      };
    });

    console.timeEnd('[GET]/chatrooms');
    const bodyStr = JSON.stringify(result || []);
    console.log('[API][RES]', { path: '/api/chatrooms', status: 200, ms: 0, size: bodyStr.length });
    return res.json(result);
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms', message: err?.message, name: err?.name, stack: err?.stack?.split('\n')[0] });
    console.timeEnd('[GET]/chatrooms');
    return res.status(500).json({ message: '채팅방 불러오기 실패' });
  }
});

/* ===========================================
 * [1-1] 총 미읽음 합계 (TopMenu ⓝ)
 * - 내 모든 방의 미읽음 메시지 총합 반환
 * =========================================== */
router.get('/chatrooms/unread-total', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms/unread-total', method: 'GET', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ total: 0 });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'find.distinct', criteria: { participants: myObjId }, field: '_id' });

    const roomIds = await ChatRoom.find({ participants: myObjId }).distinct('_id');
    if (!roomIds.length) return res.json({ total: 0 });

    console.log('[DB][QRY]', {
      model: 'Message',
      op: 'countDocuments',
      criteria: { chatRoom: { $in: roomIds }, sender: { $ne: myObjId }, readBy: { $ne: myObjId } }
    });

    const total = await Message.countDocuments({
      chatRoom: { $in: roomIds },
      sender: { $ne: myObjId },
      readBy: { $ne: myObjId }
    });

    console.log('[API][RES]', { path: '/api/chatrooms/unread-total', status: 200, ms: 0, size: JSON.stringify({ total }).length });
    return res.json({ total });
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms/unread-total', message: err?.message });
    return res.status(500).json({ message: '합계 계산 실패' });
  }
});

/* ===========================================
 * [2] 채팅방 메시지 조회
 * - 권한 체크
 * - messages.sender populate(닉네임)
 * - 프론트 편의를 위해 myId 포함
 * =========================================== */
router.get('/chatrooms/:id', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms/:id', method: 'GET', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id } = req.params;

    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findById', criteria: id });
    const chatRoom = await ChatRoom.findById(id)
      .populate('participants', 'username nickname')
      .lean();

    const isMember = chatRoom?.participants?.some(p => String(p._id || p) === String(myId));
    if (!chatRoom || !isMember) {
      return res.status(403).json({ message: '접근 권한 없음' });
    }

    console.log('[DB][QRY]', { model: 'Message', op: 'find', criteria: { chatRoom: id }, sort: { createdAt: 1 } });
    const messages = await Message.find({ chatRoom: id })
      .sort({ createdAt: 1 })
      .populate('sender', 'nickname')
      .lean();

    return res.json({
      myId: String(myObjId),
      participants: chatRoom.participants,
      messages
    });
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms/:id', message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [3] 메시지 전송 (텍스트/이미지)
 * - 권한 체크
 * - 저장 시 보낸 본인은 이미 읽은 것으로 간주(readBy에 myId)
 * - ChatRoom.lastMessage & updatedAt 즉시 갱신
 * - sender populate 후 반환
 * - 소켓 전파: 상대에게 chatrooms:updated (+ 호환 chatMessage)
 * - 🔔 푸시 전송: 상대 참가자들에게 FCM
 * =========================================== */
router.post('/chatrooms/:id/message', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms/:id/message', method: 'POST', params: req.params, bodyKeys: Object.keys(req.body || {}), userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id } = req.params;
    const { content, type } = req.body;

    if (type !== 'image' && (!content || !content.trim())) {
      return res.status(400).json({ message: '메시지 내용이 비어 있습니다' });
    }

    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findById', criteria: id });
    const chatRoom = await ChatRoom.findById(id);
    const isMember = chatRoom?.participants?.some(p => String(p) === String(myId));
    if (!chatRoom || !isMember) {
      return res.status(403).json({ message: '채팅방 접근 권한 없음' });
    }

    // 메시지 생성 데이터
    const messageData = {
      chatRoom: id,
      sender: myObjId,
      type: type || 'text',
      readBy: [myObjId], // ✅ 보낸 본인은 기본 읽음
      content: '',
      imageUrl: ''
    };

    if (type === 'image') {
      messageData.imageUrl = content;
    } else {
      messageData.content = content;
    }

    console.log('[DB][QRY]', { model: 'Message', op: 'create', criteria: { ...messageData, content: undefined, imageUrl: undefined } });
    let message = await Message.create(messageData);

    // 방에 메시지 연결 (기존 유지)
    chatRoom.messages.push(message._id);

    // ✅ lastMessage/updatedAt 갱신
    if (typeof chatRoom.setLastMessageAndTouch === 'function') {
      chatRoom.setLastMessageAndTouch({
        content: message.content || '',
        imageUrl: message.imageUrl || '',
        sender: message.sender,
        createdAt: message.createdAt
      });
    } else {
      chatRoom.lastMessage = {
        content: message.content || '',
        imageUrl: message.imageUrl || '',
        sender: message.sender,
        createdAt: message.createdAt
      };
      chatRoom.updatedAt = new Date();
    }
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'save', criteria: { _id: chatRoom?._id } });
    await chatRoom.save();

    // 응답용 populate
    console.log('[DB][QRY]', { model: 'Message', op: 'findById.populate(sender)', criteria: message._id });
    message = await Message.findById(message._id).populate('sender', 'nickname');

    // 🔔 소켓 전파(옵션): 상대/본인 개인룸에 chatrooms:updated + (호환)chatMessage
    const io = getIO(req);
    if (io && Array.isArray(chatRoom.participants)) {
      chatRoom.participants.forEach((uid) => {
        const roomName = String(uid);
        console.log('[SOCKET][MSG]', { roomId: roomName, from: myId, type: 'chatrooms:updated' });
        io.to(roomName).emit('chatrooms:updated', {
          chatRoomId: String(chatRoom._id),
          at: Date.now()
        });
        console.log('[SOCKET][MSG]', { roomId: roomName, from: myId, type: 'chatMessage' });
        io.to(roomName).emit('chatMessage', {
          chatRoomId: String(chatRoom._id),
          messageId: String(message._id)
        });
      });
    }

    // =======================================================
    // 🔔 FCM 푸시 발송
    // =======================================================
    try {
      const me = await User.findById(myId, { nickname: 1 }).lean();
      const myNick = me?.nickname || '상대방';
      const preview = (message.content && message.content.trim())
        ? message.content
        : (message.imageUrl ? '📷 사진' : '새 메시지');

      const targetUserIds = (chatRoom.participants || [])
        .map(String)
        .filter(uid => uid !== String(myId));

      if (targetUserIds.length) {
        log('[push] 대상 사용자:', targetUserIds);
        for (const uid of targetUserIds) {
          await sendPushToUser(uid, {
            title: '새 메시지',
            body: `${myNick}: ${preview}`,
            type: 'chat',
            roomId: String(chatRoom._id),
            fromUserId: String(myId),
          });
        }
        log('[push] ✅ 푸시 발송 완료');
      } else {
        log('[push] 대상 사용자 없음(1:1 방이 아닌가?)');
      }
    } catch (pushErr) {
      console.error('[PUSH][ERR]', { step: 'sendPushToUser', message: pushErr?.message });
      // 푸시 실패해도 메시지 전송은 성공으로 간주
    }

    console.log('[API][RES]', { path: '/api/chatrooms/:id/message', status: 200, ms: 0, size: JSON.stringify(message || {}).length });
    return res.json(message);
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms/:id/message', message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [3-1] 읽음 처리 API
 * PUT /chatrooms/:id/read
 * - 조건:
 *   1) 해당 방
 *   2) 보낸 사람이 "나"가 아님
 *   3) readBy에 아직 내 ID가 없음
 * - 효과: readBy에 내 ID 추가(일괄)
 * - 응답: { updatedMessageIds: [ ... ] }
 * - 소켓 전파: 내 뱃지 갱신(chatrooms:badge)
 * =========================================== */
router.put('/chatrooms/:id/read', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms/:id/read', method: 'PUT', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id: roomId } = req.params;

    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findById', criteria: roomId });
    const room = await ChatRoom.findById(roomId).select('_id participants');
    const isMember = room?.participants?.some(p => String(p) === String(myId));
    if (!room || !isMember) {
      return res.status(403).json({ message: '채팅방 접근 권한 없음' });
    }

    const filter = {
      chatRoom: roomId,
      sender: { $ne: myObjId }, // 내가 보낸 메시지는 제외
      readBy: { $ne: myObjId }, // 아직 내가 안읽은 것
    };

    console.log('[DB][QRY]', { model: 'Message', op: 'find', criteria: filter, fields: ['_id'] });
    const targets = await Message.find(filter, { _id: 1 }).lean();
    const ids = targets.map(t => t._id);

    if (!ids.length) {
      console.log('[API][RES]', { path: '/api/chatrooms/:id/read', status: 200, ms: 0, size: JSON.stringify({ updatedMessageIds: [] }).length });
      return res.json({ updatedMessageIds: [] });
    }

    console.log('[DB][QRY]', { model: 'Message', op: 'updateMany', criteria: { _id: { $in: ids } }, update: { $addToSet: { readBy: myObjId } } });
    const upd = await Message.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { readBy: myObjId } }
    );

    // 🔔 소켓 전파(옵션): 본인에게 뱃지 갱신 이벤트
    const io = getIO(req);
    if (io) {
      console.log('[SOCKET][MSG]', { roomId: String(myId), from: myId, type: 'chatrooms:badge' });
      io.to(String(myId)).emit('chatrooms:badge', {
        chatRoomId: String(roomId),
        at: Date.now()
      });
    }

    console.log('[API][RES]', { path: '/api/chatrooms/:id/read', status: 200, ms: 0, size: JSON.stringify({ updatedMessageIds: ids }).length });
    return res.json({ updatedMessageIds: ids });
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms/:id/read', message: err?.message });
    return res.status(500).json({ message: '읽음 처리 실패' });
  }
});

/* ===========================================
 * [4] 채팅방 생성 or 조회 (2인 DM)
 * - 두 사람의 방이 없으면 생성
 * - 생성 시 updatedAt 갱신은 pre('save') 훅에서 처리
 * =========================================== */
router.post('/chatrooms', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms', method: 'POST', body: req.body, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { userId } = req.body;

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const otherObjId = new mongoose.Types.ObjectId(String(userId));

    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findOne', criteria: { participants: { $all: [myObjId, otherObjId], $size: 2 } } });
    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [myObjId, otherObjId], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        participants: [myObjId, otherObjId],
        messages: []
      });
      console.log('[DB][QRY]', { model: 'ChatRoom', op: 'save', criteria: { participants: [String(myObjId), String(otherObjId)] } });
      await chatRoom.save();
      log('[POST /chatrooms] ✅ created room=', chatRoom._id.toString());
    } else {
      log('[POST /chatrooms] found room=', chatRoom._id.toString());
    }

    console.log('[API][RES]', { path: '/api/chatrooms', status: 200, ms: 0, size: JSON.stringify(chatRoom || {}).length });
    return res.json(chatRoom);
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms', message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [5] 이미지 업로드 (압축 적용 & 원본 삭제)
 * - 업로드 → 1024px 리사이즈/품질 70% → 원본 삭제 → 경로 반환
 * =========================================== */
router.post('/chatrooms/upload-image', requireLogin, upload.single('image'), async (req, res) => {
  console.log('[API][REQ]', { path: '/api/chatrooms/upload-image', method: 'POST', file: req?.file?.originalname || null, userId: getMyId(req) });
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: '파일이 존재하지 않습니다.' });
    }

    const originalPath = file.path;
    const compressedPath = path.join(file.destination, 'compressed-' + file.filename);

    await sharp(originalPath)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(compressedPath);

    // 원본 삭제
    fs.unlinkSync(originalPath);

    const imageUrl = `/uploads/chat/${path.basename(compressedPath)}`;
    log('✅ [upload-image] 압축 이미지 저장 완료:', imageUrl);

    console.log('[API][RES]', { path: '/api/chatrooms/upload-image', status: 200, ms: 0, size: JSON.stringify({ imageUrl }).length });
    return res.json({ imageUrl });
  } catch (err) {
    console.error('[API][ERR]', { path: '/api/chatrooms/upload-image', message: err?.message });
    return res.status(500).json({ message: '이미지 업로드 실패' });
  }
});

module.exports = router;
