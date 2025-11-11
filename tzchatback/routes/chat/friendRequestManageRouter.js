// routes/chat/friendRequestManageRouter.js
// base: /api
// ------------------------------------------------------------
// 친구 "신청 처리/목록" 전용 라우터
// - PUT  /friend-request/:id/accept  : 신청 수락 (채팅방 생성/반환)
// - PUT  /friend-request/:id/reject  : 신청 거절
// - PUT  /friend-request/:id/block   : 신청에서 바로 차단
// - GET  /friend-requests/received   : 받은 신청 목록
// - GET  /friend-requests/sent       : 보낸 신청 목록
// - ✅ 로깅은 req.baseUrl + req.path 기준
// ------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const { ChatRoom, Message, FriendRequest, User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

/* ----------------------------- 유틸/로깅 ------------------------------ */
function log(...args) { try { console.log('[friendRequestManageRouter]', ...args); } catch (_) {} }
function logErr(...args) { try { console.error('[friendRequestManageRouter][ERR]', ...args); } catch (_) {} }
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
const USER_MIN_FIELDS = 'username nickname birthyear gender';

async function populateRequest(doc) {
  if (!doc) return null;
  return doc.populate([
    { path: 'from', select: USER_MIN_FIELDS },
    { path: 'to',   select: USER_MIN_FIELDS },
  ]);
}

/* ===========================================================
 * 공통 요청/응답 로깅
 * =========================================================== */
router.use((req, res, next) => {
  const started = Date.now();
  console.log('[API][REQ]', {
    path: req.baseUrl + req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    userId: getMyId(req),
  });
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - started;
    const status = res.statusCode;
    const size = typeof body === 'string' ? body.length : Buffer.byteLength(JSON.stringify(body || {}));
    console.log('[API][RES]', { path: req.baseUrl + req.path, status, ms, size });
    return originalJson(body);
  };
  next();
});

/* =========================
 *  🤝 수락 (채팅방 ID 반환)
 * ========================= */
router.put('/friend-request/:id/accept', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: '유효하지 않은 요청 ID입니다.' });

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );
    if (!request) return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });

    const fromId = String(request.from);
    const toId   = String(request.to);

    const toObjId   = new mongoose.Types.ObjectId(toId);
    const fromObjId = new mongoose.Types.ObjectId(fromId);

    await Promise.all([
      User.updateOne({ _id: toObjId },   { $addToSet: { friendlist: fromObjId } }),
      User.updateOne({ _id: fromObjId }, { $addToSet: { friendlist: toObjId   } }),
    ]);

    let roomId = null;
    try {
      let chatRoom = await ChatRoom.findOne({
        participants: { $all: [toObjId, fromObjId], $size: 2 }
      });

      if (!chatRoom) {
        chatRoom = await ChatRoom.create({ participants: [toObjId, fromObjId], messages: [] });
      }

      roomId = String(chatRoom._id);

      const systemMessage = await Message.create({
        chatRoom: chatRoom._id,
        sender: toObjId, // myId
        content: '채팅이 시작되었습니다.',
      });
      chatRoom.messages.push(systemMessage._id);
      await chatRoom.save();
    } catch (chatErr) {
      logErr('chat/message create failed (ignored)', chatErr);
    }

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestAccepted) {
      try { emit.friendRequestAccepted(await populateRequest(request)); } catch (e) { logErr('emit.friendRequestAccepted failed', e); }
    }

    log('🤝 친구 수락 & 채팅 시작', { path: req.baseUrl + req.path, fromId, toId, roomId });
    res.json({ ok: true, roomId });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  ❌ 거절
 * ========================= */
router.put('/friend-request/:id/reject', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true }
    );
    if (!request) return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });

    const populated = await populateRequest(request);
    const emit = req.app.get('emit');
    if (emit && emit.friendRequestRejected) emit.friendRequestRejected(populated);

    log('❌ 친구 거절', { path: req.baseUrl + req.path, from: String(request.from), to: myId, id });
    res.json({ ok: true });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  🚫 받은 신청에서 즉시 차단
 * ========================= */
router.put('/friend-request/:id/block', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true }
    );
    if (!request) return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });

    const fromId = String(request.from);
    if (!isValidObjectId(fromId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });

    const myObjId = new mongoose.Types.ObjectId(myId);
    const fromObjId = new mongoose.Types.ObjectId(fromId);

    await Promise.all([
      User.updateOne({ _id: myObjId },   { $addToSet: { blocklist: fromObjId }, $pull: { friendlist: fromObjId } }),
      User.updateOne({ _id: fromObjId }, { $pull: { friendlist: myObjId } }),
      FriendRequest.updateMany(
        { status: 'pending', $or: [ { from: myObjId, to: fromObjId }, { from: fromObjId, to: myObjId } ] },
        { $set: { status: 'rejected' } }
      )
    ]);

    const populated = await populateRequest(request);
    const emit = req.app.get('emit');
    if (emit) {
      if (emit.friendRequestRejected) emit.friendRequestRejected(populated);
      if (emit.blockCreated) emit.blockCreated({ blockerId: myId, blockedId: fromId });
    }

    log('🚫 친구 차단(신청에서)', { path: req.baseUrl + req.path, fromId, toId: myId, id });
    res.json({ ok: true });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  📬 받은/보낸 목록
 * ========================= */
router.get('/friend-requests/received', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const requests = await FriendRequest.find({ to: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('from', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

router.get('/friend-requests/sent', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const requests = await FriendRequest.find({ from: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('to', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
