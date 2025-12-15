// routes/chat/chatRoomRouter.js
// base: /api
// -------------------------------------------------------------
// 💬 채팅방 라우터 (목록/상세/생성/삭제/집계)
// - GET    /chatrooms                   : 내 채팅방 목록(마지막 메시지+미읽음 수)
// - GET    /chatrooms/unread-total      : 총 미읽음 합계(TopMenu 뱃지)
// - GET    /chatrooms/partners          : 내가 대화한 상대 ID 목록
// - GET    /chatrooms/:id               : 채팅방 상세(참가자+메시지 목록)
// - POST   /chatrooms                   : 1:1 방 생성 또는 기존 방 반환
// - DELETE /chatrooms/:id               : 방 삭제(메시지 포함 하드 삭제)
// - ✅ 응답 시 미디어 URL 절대경로 정규화(혼합콘텐츠 방지)
// -------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');

// models
const { ChatRoom, Message, User } = require('@/models');

// 인증 미들웨어
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

// ===== 공통 헬퍼 =====
const log = (...args) => console.log('[chatRoomsRouter]', ...args);
const getIO   = (req) => { try { return req.app.get('io'); }   catch { return null; } };
function getMyId(req) { return req?.user?._id || req?.session?.user?._id || null; }

// ----- URL 정규화 유틸 -----
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
  const fwd = parseForwarded(req.headers['forwarded']);
  let fProto = fwd.proto || firstHeaderVal(req.headers['x-forwarded-proto']) || '';
  let fHost  = fwd.host  || firstHeaderVal(req.headers['x-forwarded-host'])  || '';
  const xfPort = firstHeaderVal(req.headers['x-forwarded-port']);
  if (xfPort && fHost && !/:\d+$/.test(fHost)) fHost = `${fHost}:${xfPort}`;

  const envBase = process.env.PUBLIC_BASE_URL || process.env.FILE_BASE_URL || process.env.API_BASE_URL || '';
  if (envBase) {
    const envIsLocal = isLocalhostUrl(envBase);
    const fBare = (fHost || '').replace(/:\d+$/, '');
    const fIsValidPublic = !!fHost && !/^localhost$|^127\.0\.0\.1$/i.test(fBare);
    if (!(envIsLocal && fIsValidPublic)) {
      return stripTrailingSlashes(envBase);
    }
  }

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
function normalizeUserPhotos(user, req) {
  if (!user || typeof user !== 'object') return user;
  const out = { ...user };
  if (out.profile && typeof out.profile === 'object') {
    if (out.profile.mainUrl) out.profile.mainUrl = toAbsoluteMediaUrl(out.profile.mainUrl, req);
  }
  if (out.profilePhotoUrl) out.profilePhotoUrl = toAbsoluteMediaUrl(out.profilePhotoUrl, req);
  if (out.photoUrl) out.photoUrl = toAbsoluteMediaUrl(out.photoUrl, req);
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
 * [1] 채팅방 목록
 * =========================================== */
router.get('/chatrooms', async (req, res) => {
  console.time('[GET]/chatrooms');
  try {
    const myId = getMyId(req);
    if (!myId) { console.timeEnd('[GET]/chatrooms'); return res.status(401).json([]); }

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const rooms = await ChatRoom.find({ participants: myObjId })
      .select('_id participants lastMessage updatedAt createdAt')
      .populate('participants', 'nickname gender profilePhotoUrl photoUrl profile.mainUrl photos.url photos.isMain')
      .sort({ updatedAt: -1 })
      .lean();

    const roomIds = rooms.map(r => r._id);
    const pipeline = [
      { $match: { chatRoom: { $in: roomIds } } },
      { $sort: { createdAt: -1 } },
      { $group: {
          _id: '$chatRoom',
          last: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                    { $ne: ['$sender', myObjId] },
                    { $not: [{ $in: [myObjId, { $ifNull: ['$readBy', []] }] }] }
                  ]},
                1, 0
              ]
            }
          }
      }}
    ];
    const agg = roomIds.length ? await Message.aggregate(pipeline) : [];
    const byRoomId = new Map(agg.map(x => [String(x._id), x]));

    const result = rooms.map(r => {
      const extra = byRoomId.get(String(r._id));
      const lastDoc = extra?.last;
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
            ? { ...r.lastMessage, imageUrl: toAbsoluteMediaUrl(r.lastMessage.imageUrl || '', req) }
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
    return res.json(result);
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/chatrooms', err?.message);
    console.timeEnd('[GET]/chatrooms');
    return res.status(500).json({ message: '채팅방 불러오기 실패' });
  }
});

/* ===========================================
 * [1-1] 총 미읽음 합계
 * =========================================== */
router.get('/chatrooms/unread-total', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(200).json({ total: 0 });
    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const roomIds = await ChatRoom.find({ participants: myObjId }).distinct('_id');
    if (!roomIds.length) return res.json({ total: 0 });
    const total = await Message.countDocuments({
      chatRoom: { $in: roomIds },
      sender: { $ne: myObjId },
      readBy: { $ne: myObjId }
    });
    return res.json({ total });
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/unread-total', err?.message);
    return res.status(500).json({ total: 0 });
  }
});

/* ===========================================
 * [1-2] 내가 대화한 상대 ID 목록
 * =========================================== */
router.get('/chatrooms/partners', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const rooms = await ChatRoom.find({ participants: myObjId }).select('participants').lean();
    const ids = [
      ...new Set(
        (rooms || [])
          .flatMap(r => Array.isArray(r.participants) ? r.participants : [])
          .map(p => String(p))
          .filter(pid => pid !== String(myId))
      )
    ];
    return res.json({ ids });
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/partners', err?.message);
    return res.status(500).json({ message: '채팅 상대 조회 실패' });
  }
});

/* ===========================================
 * [2] 채팅방 상세(메시지 포함)
 * =========================================== */
router.get('/chatrooms/:id', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const { id } = req.params;

    const chatRoom = await ChatRoom.findById(id)
      .populate('participants', 'nickname gender profilePhotoUrl photoUrl profile.mainUrl photos.url photos.isMain')
      .lean();

    const isMember = chatRoom?.participants?.some(p => String(p._id || p) === String(myId));
    if (!chatRoom || !isMember) return res.status(403).json({ message: '접근 권한 없음' });

    const normalizedParticipants = Array.isArray(chatRoom.participants)
      ? chatRoom.participants.map(p => normalizeUserPhotos(p, req))
      : chatRoom.participants;

    let messages = await Message.find({ chatRoom: id })
      .sort({ createdAt: 1 })
      .populate('sender', 'nickname')
      .lean();

    messages = messages.map(m => ({ ...m, imageUrl: toAbsoluteMediaUrl(m.imageUrl || '', req) }));

    return res.json({ myId: String(myObjId), participants: normalizedParticipants, messages });
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/:id', err?.message);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [3] 채팅방 생성 or 조회 (두 명 DM)
 * =========================================== */
router.post('/chatrooms', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { userId } = req.body;

    const myObjId = new mongoose.Types.ObjectId(String(myId));
    const otherObjId = new mongoose.Types.ObjectId(String(userId));

    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [myObjId, otherObjId], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = new ChatRoom({ participants: [myObjId, otherObjId], messages: [] });
      await chatRoom.save();
      log('✅ created room=', chatRoom._id.toString());
    } else {
      log('found room=', chatRoom._id.toString());
    }
    return res.json(chatRoom);
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/create', err?.message);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* ===========================================
 * [4] 채팅방 삭제(메시지 포함)
 * =========================================== */
router.delete('/chatrooms/:id', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id: roomId } = req.params;

    const room = await ChatRoom.findById(roomId).select('_id participants');
    if (!room) return res.status(404).json({ message: '채팅방이 존재하지 않습니다.' });
    const isParticipant = (room.participants || []).some(p => String(p) === String(myId));
    if (!isParticipant) return res.status(403).json({ message: '삭제 권한이 없습니다.' });

    await Message.deleteMany({ chatRoom: roomId });
    await ChatRoom.deleteOne({ _id: roomId });

    const io = getIO(req);
    if (io) {
      (room.participants || []).forEach((uid) => {
        const ch = `user:${String(uid)}`;
        io.to(ch).emit('chatrooms:badge',   { changedRoomId: String(roomId) });
        io.to(ch).emit('chatrooms:updated', { deletedRoomId: String(roomId) });
        io.to(ch).emit('chatrooms:deleted', { roomId: String(roomId) });
      });
    }
    return res.json({ message: '채팅방 삭제 완료', roomId });
  } catch (err) {
    console.error('[chatRoomsRouter][ERR]/delete', err?.message);
    return res.status(500).json({ message: '채팅방 삭제 실패' });
  }
});

module.exports = router;
