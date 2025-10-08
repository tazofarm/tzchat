// /routes/chat/friendRouter.js
// base: /api
// ------------------------------------------------------------
// 친구 신청/수락/거절/차단/목록 라우터
// - 공통 인증 미들웨어(requireLogin) 사용
// - 누적 카운터($inc) 유지
// - ✅ 로깅을 req.baseUrl + req.path 로 통일(마운트 프리픽스 포함)
// ------------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

// models/index.js 가 모든 모델을 export 한다는 가정
const {
  // chat
  ChatRoom, Message,
  // social
  FriendRequest, Report,
  // user
  User,
} = require('@/models');

// ✅ 공통 인증 미들웨어(OPTIONS 통과 + Bearer/X-Auth-Token/쿠키/쿼리 지원)
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');


// 🔔 푸시 발송 모듈
const { sendPushToUser } = require('@/push/sender');

const router = express.Router();
// 전역 보호: 로그인 후 탈퇴 유예 계정 차단
router.use(requireLogin, blockIfPendingDeletion);


function log(...args) { try { console.log('[friendRouter]', ...args); } catch (_) {} }
function logErr(...args) { try { console.error('[friendRouter][ERR]', ...args); } catch (_) {} }

/** 공통: 내 사용자 ID 추출 (authMiddleware가 req.user/req.session.user를 맞춰둠) */
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}

/** 공통: 프로필에 필요한 필드(간단 프로젝션) */
const USER_MIN_FIELDS = 'username nickname birthyear gender';

/** 유틸: friendRequest 문서를 from/to 모두 populate */
async function populateRequest(doc) {
  if (!doc) return null;
  return doc.populate([
    { path: 'from', select: USER_MIN_FIELDS },
    { path: 'to',   select: USER_MIN_FIELDS },
  ]);
}

/* ===========================================================
 * ✅ 공통 요청/응답 로깅 미들웨어 (이 라우터 전용)
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
    console.log('[API][RES]', {
      path: req.baseUrl + req.path,
      status,
      ms,
      size,
    });
    return originalJson(body);
  };
  next();
});

/** ============================
 *  📨 친구 신청 (A → B)
 * ============================ */
router.post('/friend-request', requireLogin, async (req, res) => {
  const fromId = getMyId(req);
  const { to, message } = req.body || {};
  const toId = String(to || '');

  log('incoming friend-request', {
    path: req.baseUrl + req.path,
    userId: fromId,
    body: { to: toId, messageLen: (message || '').length }
  });

  try {
    if (!fromId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!toId)   return res.status(400).json({ message: '대상 사용자(to)가 필요합니다.' });
    if (!isValidObjectId(toId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    if (fromId === toId) return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromId).select('_id nickname suspended friendlist blocklist').lean(),
      User.findById(toId).select('_id nickname suspended friendlist blocklist').lean()
    ]);
    if (!fromUser) return res.status(404).json({ message: '내 사용자 정보를 찾을 수 없습니다.' });
    if (!toUser)   return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
    if (fromUser.suspended || toUser.suspended) return res.status(403).json({ message: '정지된 계정입니다.' });

    const alreadyFriend = (fromUser.friendlist || []).some(fid => String(fid) === toId);
    if (alreadyFriend) return res.status(400).json({ message: '이미 친구 상태입니다.' });

    const iBlockedHim = (fromUser.blocklist || []).some(bid => String(bid) === toId);
    const heBlockedMe = (toUser.blocklist || []).some(bid => String(bid) === fromId);
    if (iBlockedHim || heBlockedMe) return res.status(400).json({ message: '차단 상태에서는 친구 신청이 불가합니다.' });

    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    }).lean();
    if (exists) return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });

    try {
      const request = await FriendRequest.create({ from: fromId, to: toId, message: message || '', status: 'pending' });

      // 누적 카운터 증가 (best-effort)
      try {
        await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }),
          User.updateOne({ _id: toId   }, { $inc: { receivedRequestCountTotal: 1 } }),
        ]);
      } catch (incErr) { logErr('counter-inc-failed', incErr); }

      const populated = await populateRequest(request);

      // 소켓 통지 (옵션)
      const emit = req.app.get('emit');
      if (emit && emit.friendRequestCreated) {
        try { emit.friendRequestCreated(populated); } catch (emitErr) { logErr('socket-emit-failed', emitErr); }
      }

      // 푸시 (옵션)
      (async () => {
        try {
          const fromNick = fromUser?.nickname || '알 수 없음';
          await sendPushToUser(toId, {
            title: '친구 신청 도착',
            body: `${fromNick} 님이 친구 신청을 보냈습니다.`,
            type: 'friend_request',
            fromUserId: fromId,
            roomId: '',
          });
        } catch (pushErr) { logErr('[push][friend-request] 발송 오류', pushErr); }
      })();

      log('✅ 친구 신청 완료', { path: req.baseUrl + req.path, fromId, toId, requestId: request._id });
      return res.json(populated);
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        logErr('E11000 duplicate on create (pending unique)', createErr);
        return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });
      }
      throw createErr;
    }
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 신청 취소
 * ============================ */
router.delete('/friend-request/:id', requireLogin, async (req, res) => {
  try {
    const fromId = getMyId(req);
    const { id } = req.params;
    if (!fromId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const deleted = await FriendRequest
      .findOneAndDelete({ _id: id, from: fromId, status: 'pending' })
      .populate('from to', USER_MIN_FIELDS);

    if (!deleted) return res.status(404).json({ message: '삭제할 친구 신청이 없거나 권한이 없습니다.' });

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestCancelled) emit.friendRequestCancelled(deleted);

    log('🗑️ 친구 신청 취소', { path: req.baseUrl + req.path, fromId, toId: deleted.to?._id, id });
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  📬 내가 받은 친구 신청 리스트
 * ============================ */
router.get('/friend-requests/received', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const requests = await FriendRequest.find({ to: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('from', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  📤 내가 보낸 친구 신청 리스트
 * ============================ */
router.get('/friend-requests/sent', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const requests = await FriendRequest.find({ from: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('to', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🤝 친구 신청 수락
 * ============================ */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );
    if (!request) return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });

    const fromId = String(request.from);
    const toId = String(request.to);

    const [userMe, userFrom] = await Promise.all([
      User.findById(toId),
      User.findById(fromId),
    ]);
    if (!userMe || !userFrom) return res.status(404).json({ message: '사용자 조회 실패' });

    if (!userMe.friendlist.some(fid => String(fid) === fromId)) userMe.friendlist.push(userFrom._id);
    if (!userFrom.friendlist.some(fid => String(fid) === toId)) userFrom.friendlist.push(userMe._id);
    await Promise.all([userMe.save(), userFrom.save()]);

    // 채팅방 생성(없으면)
    let chatRoom = await ChatRoom.findOne({ participants: { $all: [userMe._id, userFrom._id], $size: 2 } });
    if (!chatRoom) {
      chatRoom = await ChatRoom.create({ participants: [userMe._id, userFrom._id], messages: [] });
      log('💬 채팅방 생성', { roomId: chatRoom._id });
    }

    const systemMessage = await Message.create({ chatRoom: chatRoom._id, sender: null, content: '채팅이 시작되었습니다.' });
    chatRoom.messages.push(systemMessage._id);
    await chatRoom.save();

    await Promise.all([
      User.updateOne({ _id: fromId }, { $inc: { acceptedChatCountTotal: 1 } }),
      User.updateOne({ _id: toId },   { $inc: { acceptedChatCountTotal: 1 } }),
    ]);

    const populated = await populateRequest(request);
    const emit = req.app.get('emit');
    if (emit && emit.friendRequestAccepted) emit.friendRequestAccepted(populated);

    log('🤝 친구 수락 & 채팅 시작', { path: req.baseUrl + req.path, fromId, toId, roomId: chatRoom._id });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  ❌ 친구 신청 거절
 * ============================ */
router.put('/friend-request/:id/reject', requireLogin, async (req, res) => {
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
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 친구 차단 (받은 신청에서 즉시 차단)
 * ============================ */
router.put('/friend-request/:id/block', requireLogin, async (req, res) => {
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

    const me = await User.findById(myId);
    const fromId = String(request.from);
    if (!me.blocklist.some(bid => String(bid) === fromId)) {
      me.blocklist.push(fromId);
      await me.save();
    }

    const populated = await populateRequest(request);
    const emit = req.app.get('emit');
    if (emit) {
      if (emit.friendRequestRejected) emit.friendRequestRejected(populated);
      if (emit.blockCreated) emit.blockCreated({ blockerId: myId, blockedId: fromId });
    }

    log('🚫 친구 차단', { path: req.baseUrl + req.path, fromId, toId: myId, id });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👥 친구 리스트 조회
 * ============================ */
router.get('/friends', requireLogin, async (req, res) => {
  try {
    const me = getMyId(req);
    if (!me) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const user = await User.findById(me).populate('friendlist', USER_MIN_FIELDS);
    res.json(user?.friendlist || []);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 차단 리스트 조회
 * ============================ */
router.get('/blocks', requireLogin, async (req, res) => {
  try {
    const me = getMyId(req);
    if (!me) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const user = await User.findById(me).populate('blocklist', USER_MIN_FIELDS);
    res.json(user?.blocklist || []);
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👤 유저 프로필 + 친구/차단 여부
 * ============================ */
router.get('/users/:id', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const targetId = String(req.params.id);

    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const me = await User.findById(myId).lean();
    if (!me) return res.status(404).json({ message: '내 정보가 없습니다.' });

    const isFriend  = (me.friendlist  || []).some(fid => String(fid) === targetId);
    const isBlocked = (me.blocklist   || []).some(bid => String(bid) === targetId);

    res.json({ ...targetUser, isFriend, isBlocked });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 삭제
 * ============================ */
router.delete('/friend/:id', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const targetId = String(req.params.id);

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!me || !target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });

    me.friendlist = (me.friendlist || []).filter(fid => String(fid) !== targetId);
    target.friendlist = (target.friendlist || []).filter(fid => String(fid) !== myId);

    await me.save();
    await target.save();

    log('🗑️ 친구 삭제', { path: req.baseUrl + req.path, myId, targetId });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 (NEW) 일반 차단 생성
 * ============================ */
router.put('/block/:id', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const targetId = String(req.params.id);

    log('incoming block', { path: req.baseUrl + req.path, myId, targetId });

    if (!isValidObjectId(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    if (myId === targetId) return res.status(400).json({ message: '자기 자신을 차단할 수 없습니다.' });

    const [me, target] = await Promise.all([ User.findById(myId), User.findById(targetId) ]);
    if (!me || !target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    let added = false;
    if (!me.blocklist.some(bid => String(bid) === targetId)) {
      me.blocklist.push(target._id);
      added = true;
    }

    const beforeA = me.friendlist?.length || 0;
    const beforeB = target.friendlist?.length || 0;
    me.friendlist     = (me.friendlist     || []).filter(fid => String(fid) !== targetId);
    target.friendlist = (target.friendlist || []).filter(fid => String(fid) !== myId);
    const removedFriends = (beforeA !== (me.friendlist?.length||0)) || (beforeB !== (target.friendlist?.length||0));

    const { modifiedCount } = await FriendRequest.updateMany(
      { status: 'pending', $or: [ { from: myId, to: targetId }, { from: targetId, to: myId } ] },
      { $set: { status: 'rejected' } }
    );

    await Promise.all([me.save(), target.save()]);

    const emit = req.app.get('emit');
    if (emit && emit.blockCreated) {
      try { emit.blockCreated({ blockerId: myId, blockedId: targetId }); } catch (e) { logErr('emit.blockCreated failed', e); }
    }

    log('🚫 일반 차단 완료', { path: req.baseUrl + req.path, myId, targetId, addedBlock: added, removedFriends, rejectedPending: modifiedCount });
    return res.json({ ok: true, addedBlock: added, removedFriends, rejectedPending: modifiedCount });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🔓 차단 해제
 * ============================ */
router.delete('/block/:id', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const targetId = String(req.params.id);

    const me = await User.findById(myId);
    if (!me) return res.status(404).json({ message: '사용자 정보 없음' });

    me.blocklist = (me.blocklist || []).filter(bid => String(bid) !== targetId);
    await me.save();

    log('✅ 차단 해제', { path: req.baseUrl + req.path, myId, targetId });
    res.json({ ok: true });
  } catch (err) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
