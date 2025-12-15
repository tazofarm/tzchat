// routes/chat/chatMessageRouter.js
// base: /api
// -------------------------------------------------------------
// 📨 채팅 메시지 라우터 (전송/읽음/이미지 업로드)
// - POST /chatrooms/:id/message       : 텍스트/이미지 전송(+ lastMessage 갱신, 소켓, 푸시)
// - PUT  /chatrooms/:id/read          : 읽음 처리(readBy 추가, 소켓)
// - POST /chatrooms/:id/upload-image  : 이미지 업로드(1024px 리사이즈, 확장자/타입 정합성)
// - ✅ 응답 시 이미지 URL 절대경로 정규화(혼합콘텐츠 방지)
// - ✅ DB에는 uploads 경로를 "상대경로(/uploads/...)"로만 저장 (localhost 절대URL 저장 방지)
// - 저장 경로: /uploads/chat/YYYY/MM/DD/<roomId>/<uuid>.(jpg|png|webp|gif)
// -------------------------------------------------------------
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const mongoose = require('mongoose');

const { ChatRoom, Message, User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');
const { sendPushToUser } = require('@/push/sender');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

// ===== 공통 헬퍼 =====
const log = (...args) => console.log('[chatMessageRouter]', ...args);
const getEmit = (req) => { try { return req.app.get('emit'); } catch { return null; } };
const getIO   = (req) => { try { return req.app.get('io'); }   catch { return null; } };
function getMyId(req) { return req?.user?._id || req?.session?.user?._id || null; }
function genId() { return crypto.randomBytes(16).toString('hex'); }

// ----- URL 정규화 유틸(roomsRouter와 동일 규칙) -----
function stripTrailingSlashes(u) { return (u || '').replace(/\/+$/, ''); }
function firstHeaderVal(h) { return (h || '').split(',')[0].trim(); }
function parseForwarded(forwarded) {
  const out = {}; if (!forwarded) return out;
  const first = firstHeaderVal(forwarded);
  for (const part of first.split(';')) {
    const [k, v] = part.split('=').map(s => (s || '').trim());
    if (k && v) out[k.toLowerCase()] = v.replace(/^"|"$/g, '');
  }
  return out;
}
function isLocalhostUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
function getPublicBaseUrl(req) {
  // 1) forwarded 기반 후보
  const fwd = parseForwarded(req.headers['forwarded']);
  let fProto = fwd.proto || firstHeaderVal(req.headers['x-forwarded-proto']) || '';
  let fHost  = fwd.host  || firstHeaderVal(req.headers['x-forwarded-host'])  || '';
  const xfPort = firstHeaderVal(req.headers['x-forwarded-port']);
  if (xfPort && fHost && !/:\d+$/.test(fHost)) fHost = `${fHost}:${xfPort}`;

  // 2) ENV 후보(있으면 쓰되, localhost면 무시하고 forwarded를 우선)
  const envBase = process.env.PUBLIC_BASE_URL || process.env.FILE_BASE_URL || process.env.API_BASE_URL || '';
  if (envBase) {
    const envIsLocal = isLocalhostUrl(envBase);
    const fBare = (fHost || '').replace(/:\d+$/, '');
    const fIsValidPublic = !!fHost && !/^localhost$|^127\.0\.0\.1$/i.test(fBare);

    // ENV가 localhost인데, 요청이 프록시를 통해 공인 도메인으로 들어오면 ENV를 무시
    if (!(envIsLocal && fIsValidPublic)) {
      return stripTrailingSlashes(envBase);
    }
  }

  // 3) forwarded/req 기반
  let proto = fProto || req.protocol || 'https';
  let host  = fHost  || req.get('host') || '';

  const bare = (host || '').replace(/:\d+$/, '');
  if (/^tzchat\.tazocode\.com$/i.test(bare)) proto = 'https';
  if (!/^https?$/i.test(proto)) proto = 'https';
  if (!host) { host = 'tzchat.tazocode.com'; proto = 'https'; }

  return `${proto}://${host}`.replace(/\/+$/, '');
}
function toAbsoluteMediaUrl(u, req) {
  if (!u) return u;
  const base = getPublicBaseUrl(req);

  // 절대 URL이면, uploads 경로는 베이스 도메인/프로토콜로 교체
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      if (url.pathname.startsWith('/uploads/')) {
        const absBase = new URL(base);
        url.protocol = absBase.protocol;
        url.host = absBase.host;
        return url.toString();
      }
      return u;
    } catch { /* fallthrough */ }
  }

  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${base}${rel}`;
}

// ✅ 이미지 메시지 저장값을 항상 상대경로(/uploads/...)로 정규화
function normalizeUploadPathForDb(input) {
  if (!input) return '';
  const s = String(input).trim();

  // 절대 URL이면 /uploads/... 부분만 떼서 저장
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      if (url.pathname.startsWith('/uploads/')) return url.pathname;
      return s; // uploads가 아니면 그대로 (원치 않으면 ''로 바꿔도 됨)
    } catch {
      // 실패 시 아래로
    }
  }

  // 상대경로 업로드
  if (s.startsWith('/uploads/')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  return s;
}

/* ===========================================
 * 업로드 경로 유틸
 * =========================================== */
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const CHAT_ROOT = path.join(UPLOAD_ROOT, 'chat');
function ensureDirSync(dir) { try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { console.error('[upload] mkdir failed:', dir, e); } }
ensureDirSync(UPLOAD_ROOT); ensureDirSync(CHAT_ROOT);

function getChatDest(req) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const roomId = String(req.params.id || req.body.roomId || 'misc');
  const dest = path.join(CHAT_ROOT, yyyy, mm, dd, roomId);
  ensureDirSync(dest);
  return { dest, yyyy, mm, dd, roomId };
}

/* ===========================================
 * Multer 설정
 * =========================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try { const { dest } = getChatDest(req); cb(null, dest); } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => { const ext = (path.extname(file.originalname) || '').toLowerCase(); cb(null, `${genId()}${ext || ''}`); }
});
const fileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) return cb(new Error('이미지 파일만 업로드할 수 있습니다.'), false);
  cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

/* ===========================================
 * [1] 메시지 전송 (텍스트/이미지)
 * =========================================== */
router.post('/chatrooms/:id/message', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id } = req.params;
    const { content, type } = req.body;

    if (type !== 'image' && (!content || !content.trim())) {
      return res.status(400).json({ message: '메시지 내용이 비어 있습니다' });
    }

    const chatRoom = await ChatRoom.findById(id);
    const isMember = chatRoom?.participants?.some(p => String(p) === String(myId));
    if (!chatRoom || !isMember) return res.status(403).json({ message: '채팅방 접근 권한 없음' });

    const messageData = {
      chatRoom: id, sender: myObjId, type: type || 'text',
      readBy: [myObjId], content: '', imageUrl: ''
    };

    if (type === 'image') {
      // ✅ DB에는 /uploads/... 상대경로만 저장
      messageData.imageUrl = normalizeUploadPathForDb(content);
    } else {
      messageData.content = content;
    }

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
    await chatRoom.save();

    message = await Message.findById(message._id).populate('sender', 'nickname').lean();

    // ✅ 응답/소켓에는 절대 URL로 정규화(https + 도메인 강제)
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

    // 푸시
    try {
      const me = await User.findById(myId, { nickname: 1 }).lean();
      const myNick = me?.nickname || '상대방';
      const preview = (message.content && message.content.trim())
        ? message.content
        : (message.imageUrl ? '📷 사진' : '새 메시지');

      const targetUserIds = (chatRoom.participants || [])
        .map(String)
        .filter(uid => uid !== String(myId));

      for (const uid of targetUserIds) {
        await sendPushToUser(uid, {
          title: '새 메시지',
          body: `${myNick}: ${preview}`,
          type: 'chat',
          roomId: String(chatRoom._id),
          fromUserId: String(myId),
        });
      }
    } catch (pushErr) {
      console.error('[PUSH][ERR]', pushErr?.message);
    }

    return res.json(message);
  } catch (err) {
    console.error('[chatMessageRouter][ERR]/message', err?.message);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [2] 읽음 처리
 * =========================================== */
router.put('/chatrooms/:id/read', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id: roomId } = req.params;

    const room = await ChatRoom.findById(roomId).select('_id participants');
    const isMember = room?.participants?.some(p => String(p) === String(myId));
    if (!room || !isMember) return res.status(403).json({ message: '채팅방 접근 권한 없음' });

    const filter = { chatRoom: roomId, sender: { $ne: myObjId }, readBy: { $ne: myObjId } };
    const targets = await Message.find(filter, { _id: 1 }).lean();
    const ids = targets.map(t => t._id);

    if (ids.length) {
      await Message.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: myObjId } });
    }

    const emit = getEmit(req);
    if (emit && typeof emit.chatMessagesRead === 'function') {
      await emit.chatMessagesRead(String(roomId), String(myId), ids.map(String));
    } else {
      const io = getIO(req);
      if (io) io.to(`user:${String(myId)}`).emit('chatrooms:badge', { changedRoomId: String(roomId) });
    }

    return res.json({ updatedMessageIds: ids });
  } catch (err) {
    console.error('[chatMessageRouter][ERR]/read', err?.message);
    return res.status(500).json({ message: '읽음 처리 실패' });
  }
});

/* ===========================================
 * [3] 이미지 업로드
 * =========================================== */
router.post('/chatrooms/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const { id: roomId } = req.params;
    const room = await ChatRoom.findById(roomId).select('_id participants');
    const isMember = room?.participants?.some(p => String(p) === String(myId));
    if (!room || !isMember) return res.status(403).json({ message: '채팅방 접근 권한 없음' });

    const file = req.file;
    if (!file) return res.status(400).json({ message: '파일이 존재하지 않습니다.' });

    const originalPath = file.path;
    const origExt = (path.extname(file.originalname) || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    const { yyyy, mm, dd } = getChatDest(req);
    const destDir = path.dirname(originalPath);
    const idPart = genId();

    let targetFormat = 'jpeg';
    if (mime.includes('png') || origExt === '.png') targetFormat = 'png';
    if (mime.includes('webp') || origExt === '.webp') targetFormat = 'webp';
    const isGif = mime.includes('gif') || origExt === '.gif';

    let finalFilename; let finalAbsPath;

    if (isGif) {
      finalFilename = `${idPart}.gif`;
      finalAbsPath = path.join(destDir, finalFilename);
      fs.copyFileSync(originalPath, finalAbsPath);
      fs.unlinkSync(originalPath);
    } else {
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

    const relativePath = `/uploads/chat/${yyyy}/${mm}/${dd}/${roomId}/${finalFilename}`;

    // 응답은 절대 URL도 내려주되, 프론트는 relativePath를 쓰는 게 정석
    const imageUrl = toAbsoluteMediaUrl(relativePath, req);

    log('✅ [upload-image] saved:', relativePath, '⇒', imageUrl, '| mime=', mime);
    return res.json({ imageUrl, relativePath });
  } catch (err) {
    console.error('[chatMessageRouter][ERR]/upload-image', err?.message);
    return res.status(500).json({ message: '이미지 업로드 실패' });
  }
});

module.exports = router;
