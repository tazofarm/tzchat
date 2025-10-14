// routes/chat/chatRouter.js
// base: /api
// -------------------------------------------------------------
// 💬 채팅 라우터 (JWT 기반 인증 전환)
// - 리스트: 마지막 메시지 + 내 미읽음(unreadCount) 동봉
// - 메시지 전송: lastMessage/updatedAt 즉시 갱신 (+ 소켓 전파 + 🔔푸시 발송)
// - 읽음 처리: 상대가 보낸 미읽음 → readBy에 내 ID 추가 (+ 소켓 전파)
// - 총 미읽음: TopMenu ⓝ 용 집계 API
// - 이미지 업로드: 정적 경로(/uploads)와 확장자/콘텐츠 타입 일치 보장
// - ✅ 응답 시 미디어 URL을 "백엔드 절대경로"로 정규화하여 반환(혼합콘텐츠 방지)
// - ✅ 업로드 저장 경로: /uploads/chat/YYYY/MM/DD/<roomId>/<uuid>.(jpg|png|webp|gif)
// - 🗑️ 삭제: 참여자 본인만 삭제 가능(메시지 포함 하드 삭제)
// -------------------------------------------------------------
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); // (현 파일에선 직접 사용 X, 기존 유지)

// models/index.js 가 모든 모델을 export 한다는 가정
const {
  // chat
  ChatRoom, Message,
  // payment
  Entitlement, PaymentTransaction, RefundRequest, Subscription,
  // social
  FriendRequest, Report,
  // system
  AdminLog, AppConfig, Notice,
  // user
  DeletionRequest, DeviceToken, User,
  // legal
  Terms, UserAgreement,
} = require('@/models');

// 🔐 JWT 기반 인증 미들웨어 (req.user 설정 가정)
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('@/config/emergency');

const router = express.Router();
// 전역 보호: 로그인 후 탈퇴 유예 계정 차단
router.use(requireLogin, blockIfPendingDeletion);

// ✅ 푸시 발송 모듈
const { sendPushToUser } = require('@/push/sender');

// 작은 헬퍼: 안전 로그
const log = (...args) => console.log('[chatRouter]', ...args);

// 공통: 내 사용자 ID 획득 (JWT 우선, 세션은 백업)
function getMyId(req) {
  return req?.user?._id || req?.session?.user?._id || null;
}

// 표준 emit 헬퍼/Socket.IO 가져오기
const getEmit = (req) => {
  try { return req.app.get('emit'); } catch { return null; }
};
const getIO = (req) => {
  try { return req.app.get('io'); } catch { return null; }
};

/* ===========================================
 * 업로드 디렉터리 보장 + 경로 유틸
 * =========================================== */
// ⚠️ 경로 수정: routes/chat 기준으로 두 단계 상위가 프로젝트 루트
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const CHAT_ROOT = path.join(UPLOAD_ROOT, 'chat');

function ensureDirSync(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('[upload] 디렉터리 생성 실패:', dir, e);
  }
}
ensureDirSync(UPLOAD_ROOT);
ensureDirSync(CHAT_ROOT);

// 날짜/방 기준 동적 경로
function getChatDest(req) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const roomId = String(req.params.id || req.body.roomId || 'misc'); // roomId가 없으면 'misc'로
  const dest = path.join(CHAT_ROOT, yyyy, mm, dd, roomId);
  ensureDirSync(dest);
  return { dest, yyyy, mm, dd, roomId };
}

// UUID 유사 ID 생성 (hex 32자리)
function genId() {
  return crypto.randomBytes(16).toString('hex');
}

/* ===========================================
 * ✅ URL 정규화 유틸 (혼합콘텐츠 방지 강화)
 * =========================================== */
function stripTrailingSlashes(u) { return (u || '').replace(/\/+$/, ''); }
function firstHeaderVal(h) { return (h || '').split(',')[0].trim(); }
function parseForwarded(forwarded) {
  const out = {};
  if (!forwarded) return out;
  const first = firstHeaderVal(forwarded);
  for (const part of first.split(';')) {
    const [k, v] = part.split('=').map(s => (s || '').trim());
    if (!k || !v) continue;
    out[k.toLowerCase()] = v.replace(/^"|"$/g, '');
  }
  return out;
}

/** 프록시/HTTPS 안전한 퍼블릭 베이스 URL 계산 */
function getPublicBaseUrl(req) {
  // .env 우선순위
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.FILE_BASE_URL ||
    process.env.API_BASE_URL ||
    '';
  if (envBase) return stripTrailingSlashes(envBase);

  const fwd = parseForwarded(req.headers['forwarded']);
  let proto =
    (fwd.proto) ||
    firstHeaderVal(req.headers['x-forwarded-proto']) ||
    req.protocol ||
    'https';
  let host =
    (fwd.host) ||
    firstHeaderVal(req.headers['x-forwarded-host']) ||
    req.get('host') ||
    '';

  const xfPort = firstHeaderVal(req.headers['x-forwarded-port']);
  if (xfPort && host && !/:\d+$/.test(host)) host = `${host}:${xfPort}`;

  const bareHost = host.replace(/:\d+$/, '');
  if (/^tzchat\.tazocode\.com$/i.test(bareHost)) {
    proto = 'https';
  } else {
    if (!/^https?$/i.test(proto)) proto = 'https';
  }

  if (!host) {
    host = 'tzchat.tazocode.com';
    proto = 'https';
  }

  return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * 업로드/미디어 URL을 절대 URL로 정규화.
 * - 절대 URL이더라도 경로가 /uploads/ 로 시작하면 현재 오리진으로 "강제 교정"
 *   (과거 http://localhost:2000/uploads/... → https://tzchat.tazocode.com/uploads/...)
 * - 상대경로는 현재 오리진을 붙여 절대화
 * - 외부 URL(업로드 경로 아님)은 그대로 유지
 */
function toAbsoluteMediaUrl(u, req) {
  if (!u) return u;
  const base = getPublicBaseUrl(req);

  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      if (url.pathname.startsWith('/uploads/')) {
        const absBase = new URL(base);
        url.protocol = absBase.protocol; // 보통 https
        url.host     = absBase.host;
        return url.toString();
      }
      return u; // 외부 리소스
    } catch {
      // 파싱 실패 → 아래 상대 경로 처리로 폴백
    }
  }

  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${base}${rel}`;
}

/** 사용자 객체(참가자)의 사진 관련 필드들을 절대 URL로 정규화 */
function normalizeUserPhotos(user, req) {
  if (!user || typeof user !== 'object') return user;
  const out = { ...user };

  // profile.mainUrl
  if (out.profile && typeof out.profile === 'object') {
    if (out.profile.mainUrl) out.profile.mainUrl = toAbsoluteMediaUrl(out.profile.mainUrl, req);
  }

  // profilePhotoUrl, photoUrl
  if (out.profilePhotoUrl) out.profilePhotoUrl = toAbsoluteMediaUrl(out.profilePhotoUrl, req);
  if (out.photoUrl) out.photoUrl = toAbsoluteMediaUrl(out.photoUrl, req);

  // photos[].url / photos[].src
  if (Array.isArray(out.photos)) {
    out.photos = out.photos.map(p => {
      if (!p || typeof p !== 'object') return p;
      const np = { ...p };
      if (np.url) np.url = toAbsoluteMediaUrl(np.url, req);
      if (np.src) np.src = toAbsoluteMediaUrl(np.src, req);
      return np;
    });
  }
  return out;
}

/* ===========================================
 * Multer 설정 (이미지 업로드)
 * =========================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { dest } = getChatDest(req);
      cb(null, dest);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const id = genId();
    cb(null, `${id}${ext || ''}`);
  }
});
const fileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('이미지 파일만 업로드할 수 있습니다.'), false);
  }
  cb(null, true);
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/* ===========================================
 * [1] 채팅방 목록 조회
 * =========================================== */
router.get('/chatrooms', requireLogin, async (req, res) => {
  console.time('[GET]/chatrooms');
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'GET', params: req.params, userId: getMyId(req) });

  try {
    const myId = getMyId(req);
    if (!myId) {
      console.warn('[AUTH][ERR]', { step: 'getMyId', message: 'no auth user' });
      console.timeEnd('[GET]/chatrooms');
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'find', criteria: { participants: myObjId } });

    const rooms = await ChatRoom.find({ participants: myObjId })
      .select('_id participants lastMessage updatedAt createdAt')
      .populate('participants', 'nickname gender profilePhotoUrl photoUrl profile.mainUrl photos.url photos.isMain')
      .sort({ updatedAt: -1 })
      .lean();

    if (!rooms.length) {
      console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: 2 });
      console.timeEnd('[GET]/chatrooms');
      return res.json([]);
    }

    const roomIds = rooms.map(r => r._id);

    // 마지막 메시지 + 미읽음 수 집계
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
                    { $ne: ['$sender', myObjId] },
                    { $not: [{ $in: [myObjId, { $ifNull: ['$readBy', []] }] }] }
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

    const result = rooms.map(r => {
      const extra = byRoomId.get(String(r._id));
      const lastDoc = extra?.last;

      // participants 사진 필드 절대경로 정규화 (혼합콘텐츠 방지)
      const normalizedParticipants = Array.isArray(r.participants)
        ? r.participants.map(p => normalizeUserPhotos(p, req))
        : r.participants;

      const lastMessage = lastDoc
        ? {
            _id: lastDoc._id,
            content: lastDoc.content || '',
            imageUrl: toAbsoluteMediaUrl(lastDoc.imageUrl || '', req),
            sender: lastDoc.sender,
            createdAt: lastDoc.createdAt
          }
        : (r.lastMessage
            ? {
                ...r.lastMessage,
                imageUrl: toAbsoluteMediaUrl(r.lastMessage.imageUrl || '', req)
              }
            : null);

      return {
        _id: r._id,
        participants: normalizedParticipants,
        lastMessage,
        unreadCount: extra?.unreadCount || 0,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt
      };
    });

    console.timeEnd('[GET]/chatrooms');
    const bodyStr = JSON.stringify(result || []);
    console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: bodyStr.length });
    return res.json(result);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message, name: err?.name, stack: err?.stack?.split('\n')[0] });
    console.timeEnd('[GET]/chatrooms');
    return res.status(500).json({ message: '채팅방 불러오기 실패' });
  }
});

/* ===========================================
 * [1-1] 총 미읽음 합계 (TopMenu ⓝ)
 * =========================================== */
router.get('/chatrooms/unread-total', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'GET', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ total: 0 });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'find.distinct', criteria: { participants: myObjId }, field: '_id' });

    const roomIds = await ChatRoom.find({ participants: myObjId }).distinct('_id');
    if (!roomIds.length) return res.json({ total: 0 });

    console.log('[DB][QRY]', { model: 'Message', op: 'countDocuments',
      criteria: { chatRoom: { $in: roomIds }, sender: { $ne: myObjId }, readBy: { $ne: myObjId } } });

    const total = await Message.countDocuments({
      chatRoom: { $in: roomIds },
      sender: { $ne: myObjId },
      readBy: { $ne: myObjId }
    });

    console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: JSON.stringify({ total }).length });
    return res.json({ total });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '합계 계산 실패' });
  }
});

/* ===========================================
 * [2] 채팅방 메시지 조회
 * =========================================== */
router.get('/chatrooms/:id', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'GET', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id } = req.params;

    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findById', criteria: id });
    const chatRoom = await ChatRoom.findById(id)
      .populate('participants', 'nickname gender profilePhotoUrl photoUrl profile.mainUrl photos.url photos.isMain')
      .lean();

    const isMember = chatRoom?.participants?.some(p => String(p._id || p) === String(myId));
    if (!chatRoom || !isMember) {
      return res.status(403).json({ message: '접근 권한 없음' });
    }

    const normalizedParticipants = Array.isArray(chatRoom.participants)
      ? chatRoom.participants.map(p => normalizeUserPhotos(p, req))
      : chatRoom.participants;

    console.log('[DB][QRY]', { model: 'Message', op: 'find', criteria: { chatRoom: id }, sort: { createdAt: 1 } });
    let messages = await Message.find({ chatRoom: id })
      .sort({ createdAt: 1 })
      .populate('sender', 'nickname')
      .lean();

    messages = messages.map(m => ({
      ...m,
      imageUrl: toAbsoluteMediaUrl(m.imageUrl || '', req)
    }));

    return res.json({
      myId: String(myObjId),
      participants: normalizedParticipants,
      messages
    });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [3] 메시지 전송 (텍스트/이미지)
 * =========================================== */
router.post('/chatrooms/:id/message', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'POST', params: req.params, bodyKeys: Object.keys(req.body || {}), userId: getMyId(req) });
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

    const messageData = {
      chatRoom: id,
      sender: myObjId,
      type: type || 'text',
      readBy: [myObjId],
      content: '',
      imageUrl: ''
    };

    if (type === 'image') {
      messageData.imageUrl = content; // 기대값: "/uploads/..." 또는 절대URL(교정 대상)
    } else {
      messageData.content = content;
    }

    console.log('[DB][QRY]', { model: 'Message', op: 'create', criteria: { ...messageData, content: undefined, imageUrl: undefined } });
    let message = await Message.create(messageData);

    chatRoom.messages.push(message._id);

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

    console.log('[DB][QRY]', { model: 'Message', op: 'findById.populate(sender)', criteria: message._id });
    message = await Message.findById(message._id).populate('sender', 'nickname').lean();

    // 응답 시 이미지 URL 절대화(혼합콘텐츠 방지 포함)
    message.imageUrl = toAbsoluteMediaUrl(message.imageUrl || '', req);

    const emit = getEmit(req);
    if (emit && typeof emit.chatMessageNew === 'function') {
      await emit.chatMessageNew(String(chatRoom._id), message);
    } else {
      const io = getIO(req);
      if (io && Array.isArray(chatRoom.participants)) {
        chatRoom.participants.forEach((uid) => {
          const roomName = `user:${String(uid)}`;
          io.to(roomName).emit('chatrooms:badge', { changedRoomId: String(chatRoom._id) });
          io.to(roomName).emit('chatrooms:updated', {
            changedRoomId: String(chatRoom._id),
            lastMessage: {
              _id: message?._id,
              content: message?.content || '',
              imageUrl: message?.imageUrl || '',
              sender: message?.sender || null,
              createdAt: message?.createdAt || new Date(),
            }
          });
        });
      }
    }

    // 🔔 FCM 푸시 발송
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
    }

    console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: JSON.stringify(message || {}).length });
    return res.json(message);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [3-1] 읽음 처리 API
 * =========================================== */
router.put('/chatrooms/:id/read', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'PUT', params: req.params, userId: getMyId(req) });
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
      sender: { $ne: myObjId },
      readBy: { $ne: myObjId },
    };

    console.log('[DB][QRY]', { model: 'Message', op: 'find', criteria: filter, fields: ['_id'] });
    const targets = await Message.find(filter, { _id: 1 }).lean();
    const ids = targets.map(t => t._id);

    if (!ids.length) {
      console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: JSON.stringify({ updatedMessageIds: [] }).length });
      return res.json({ updatedMessageIds: [] });
    }

    console.log('[DB][QRY]', { model: 'Message', op: 'updateMany', criteria: { _id: { $in: ids } }, update: { $addToSet: { readBy: myObjId } } });
    await Message.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { readBy: myObjId } }
    );

    const emit = getEmit(req);
    if (emit && typeof emit.chatMessagesRead === 'function') {
      await emit.chatMessagesRead(String(roomId), String(myId), ids.map(String));
    } else {
      const io = getIO(req);
      if (io) {
        io.to(`user:${String(myId)}`).emit('chatrooms:badge', { changedRoomId: String(roomId) });
      }
    }

    console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: JSON.stringify({ updatedMessageIds: ids }).length });
    return res.json({ updatedMessageIds: ids });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '읽음 처리 실패' });
  }
});

/* ===========================================
 * [4] 채팅방 생성 or 조회 (2인 DM)
 * =========================================== */
router.post('/chatrooms', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'POST', body: req.body, userId: getMyId(req) });
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

    console.log('[API][RES]', { path: req.baseUrl + req.path, status: 200, ms: 0, size: JSON.stringify(chatRoom || {}).length });
    return res.json(chatRoom);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [5] 이미지 업로드 (압축 + 확장자/타입 정합성 보장)
 * =========================================== */
router.post('/chatrooms/:id/upload-image', requireLogin, upload.single('image'), async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'POST', file: req?.file?.originalname || null, roomId: req.params?.id, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { id: roomId } = req.params;
    if (!roomId) return res.status(400).json({ message: 'roomId가 필요합니다.' });

    // 방 멤버 검증
    const room = await ChatRoom.findById(roomId).select('_id participants');
    const isMember = room?.participants?.some(p => String(p) === String(myId));
    if (!room || !isMember) {
      return res.status(403).json({ message: '채팅방 접근 권한 없음' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ message: '파일이 존재하지 않습니다.' });

    const originalPath = file.path; // 이미 동적 경로 내부에 저장됨
    const origExt = (path.extname(file.originalname) || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    const { yyyy, mm, dd } = getChatDest(req); // 동일 날짜 폴더 계산용 (이미 생성됨)
    const destDir = path.dirname(originalPath); // multer가 만든 실제 경로
    const idPart = genId();

    // 대상 확장자/포맷 결정
    let targetFormat = 'jpeg';
    if (mime.includes('png') || origExt === '.png') targetFormat = 'png';
    if (mime.includes('webp') || origExt === '.webp') targetFormat = 'webp';
    const isGif = mime.includes('gif') || origExt === '.gif';

    let finalFilename;
    let finalAbsPath;

    if (isGif) {
      // GIF는 변환 없이 보존
      finalFilename = `${idPart}.gif`;
      finalAbsPath = path.join(destDir, finalFilename);
      fs.copyFileSync(originalPath, finalAbsPath);
      fs.unlinkSync(originalPath);
    } else {
      // 정적 이미지: 리사이즈 + 포맷 유지
      const ext = targetFormat === 'jpeg' ? '.jpg' : `.${targetFormat}`;
      finalFilename = `${idPart}${ext}`;
      finalAbsPath = path.join(destDir, finalFilename);

      let pipeline = sharp(originalPath).resize({ width: 1024, withoutEnlargement: true }).rotate();
      if (targetFormat === 'jpeg') pipeline = pipeline.jpeg({ quality: 70, mozjpeg: true });
      if (targetFormat === 'png')  pipeline = pipeline.png({ compressionLevel: 8 });
      if (targetFormat === 'webp') pipeline = pipeline.webp({ quality: 75 });

      await pipeline.toFile(finalAbsPath);
      fs.unlinkSync(originalPath);
    }

    // 상대경로: /uploads/chat/YYYY/MM/DD/<roomId>/<filename>
    const relativePath = `/uploads/chat/${yyyy}/${mm}/${dd}/${roomId}/${finalFilename}`;
    // 응답: 절대경로(혼합콘텐츠 방지 규칙 적용)
    const imageUrl = toAbsoluteMediaUrl(relativePath, req);

    log('✅ [upload-image] 저장 완료:', relativePath, '⇒ 응답:', imageUrl, '| mime=', mime);

    return res.json({ imageUrl, relativePath });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '이미지 업로드 실패' });
  }
});

/* ===========================================
 * [6] 채팅방 삭제 (하드 삭제: 메시지 포함)
 *  - DELETE /api/chatrooms/:id
 *  - 참여자 본인만 삭제 가능
 *  - 관련 메시지 Message 모두 삭제 후 ChatRoom 삭제
 *  - 소켓으로 배지/목록 갱신, 선택적으로 'deleted' 이벤트 송신
 * =========================================== */
router.delete('/chatrooms/:id', requireLogin, async (req, res) => {
  console.log('[API][REQ]', { path: req.baseUrl + req.path, method: 'DELETE', params: req.params, userId: getMyId(req) });
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id: roomId } = req.params;

    // 방 확인 + 참여자 검증
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'findById', criteria: roomId });
    const room = await ChatRoom.findById(roomId).select('_id participants');
    if (!room) return res.status(404).json({ message: '채팅방이 존재하지 않습니다.' });

    const isParticipant = (room.participants || []).some(p => String(p) === String(myId));
    if (!isParticipant) return res.status(403).json({ message: '삭제 권한이 없습니다.' });

    // 메시지 삭제
    console.log('[DB][QRY]', { model: 'Message', op: 'deleteMany', criteria: { chatRoom: roomId } });
    await Message.deleteMany({ chatRoom: roomId });

    // 채팅방 삭제
    console.log('[DB][QRY]', { model: 'ChatRoom', op: 'deleteOne', criteria: { _id: roomId } });
    await ChatRoom.deleteOne({ _id: roomId });

    // 소켓 전파
    const io = getIO(req);
    if (io) {
      (room.participants || []).forEach((uid) => {
        const ch = `user:${String(uid)}`;
        io.to(ch).emit('chatrooms:badge', { changedRoomId: String(roomId) });
        io.to(ch).emit('chatrooms:updated', { deletedRoomId: String(roomId) });
        io.to(ch).emit('chatrooms:deleted', { roomId: String(roomId) }); // (선택) 클라이언트에서 사용 시
      });
    }

    console.log('🗑️ [DELETE]/chatrooms OK:', roomId, 'by', String(myId));
    return res.json({ message: '채팅방 삭제 완료', roomId });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '채팅방 삭제 실패' });
  }
});

module.exports = router;
