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
  ChatRoom, Message,          // chat
  FriendRequest, Report,      // social
  User,                       // user
} = require('@/models');

// ✅ 공통 인증 미들Middleware(OPTIONS 통과 + Bearer/X-Auth-Token/쿠키/쿼리 지원)
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

// 🔔 푸시 발송 모듈
const { sendPushToUser } = require('@/push/sender');

const router = express.Router();
// 전역 보호: 로그인 후 탈퇴 유예 계정 차단
router.use(requireLogin, blockIfPendingDeletion);

/* ----------------------------- 유틸/로깅 ------------------------------ */
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

/** 리스트 타입에 맞춰 ID 저장값을 결정(String 배열이면 String으로, ObjectId 배열이면 ObjectId로) */
function normalizeIdForList(list, id) {
  const str = String(id);
  if (Array.isArray(list) && list.length > 0) {
    const first = list[0];
    // ObjectId 배열로 보이면 ObjectId 반환
    if (first && typeof first === 'object' && typeof first.equals === 'function') {
      return new mongoose.Types.ObjectId(str);
    }
    // 문자열 배열로 보이면 String 반환
    if (typeof first === 'string') return str;
  }
  // 비어있으면 스키마를 알 수 없으니 기본을 문자열로
  return str;
}

/** 배열 포함 여부(문자열 기준 비교) */
function includesId(list, id) {
  const sid = String(id);
  return (list || []).some(v => String(v) === sid);
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

    if ((fromUser.friendlist || []).some(fid => String(fid) === toId))
      return res.status(400).json({ message: '이미 친구 상태입니다.' });

    const iBlockedHim = (fromUser.blocklist || []).some(bid => String(bid) === toId);
    const heBlockedMe = (toUser.blocklist || []).some(bid => String(bid) === fromId);
    if (iBlockedHim || heBlockedMe)
      return res.status(400).json({ message: '차단 상태에서는 친구 신청이 불가합니다.' });

    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    }).lean();
    if (exists) return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });

    try {
      const request = await FriendRequest.create({ from: fromId, to: toId, message: message || '', status: 'pending' });

      // 누점 카운터 증가 (best-effort)
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
    return res.status(500).json({ message: '서버 오류' });
  }
});



/** ============================
 *  📨 (NEW) 프리미엄 친구 신청 (A → B)
 *  - 현재는 일반과 기능 동일, 엔드포인트명만 분리
 * ============================ */
router.post('/friend-request-premium', requireLogin, async (req, res) => {
  const fromId = getMyId(req);
  const { to, message } = req.body || {};
  const toId = String(to || '');

  log('incoming friend-request-premium', {
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

    if ((fromUser.friendlist || []).some(fid => String(fid) === toId))
      return res.status(400).json({ message: '이미 친구 상태입니다.' });

    const iBlockedHim = (fromUser.blocklist || []).some(bid => String(bid) === toId);
    const heBlockedMe = (toUser.blocklist || []).some(bid => String(bid) === fromId);
    if (iBlockedHim || heBlockedMe)
      return res.status(400).json({ message: '차단 상태에서는 친구 신청이 불가합니다.' });

    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    }).lean();
    if (exists) return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });

    // ✅ 현재는 일반과 동일하게 생성 (추후 분리 시 type 필드 추가 예정)
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

      // 푸시 (옵션) — 문구는 동일 유지
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
        } catch (pushErr) { logErr('[push][friend-request-premium] 발송 오류', pushErr); }
      })();

      log('✅ 프리미엄 친구 신청 완료', { path: req.baseUrl + req.path, fromId, toId, requestId: request._id });
      return res.json(populated);
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        logErr('E11000 duplicate on create (pending unique)', createErr);
        return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });
      }
      throw createErr;
    }
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🤝 친구 신청 수락
 *  - ✅ 프론트가 바로 채팅방으로 이동할 수 있도록 roomId 반환
 * ============================ */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const { id } = req.params;

    // 1) 잘못된 ObjectId 방어
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: '유효하지 않은 요청 ID입니다.' });
    }

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );
    if (!request) return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });

    const fromId = String(request.from);
    const toId   = String(request.to);

    // save() 대신 원자적 업데이트로 친구 추가
    const toObjId   = new mongoose.Types.ObjectId(toId);
    const fromObjId = new mongoose.Types.ObjectId(fromId);

    await Promise.all([
      User.updateOne({ _id: toObjId },   { $addToSet: { friendlist: fromObjId } }),
      User.updateOne({ _id: fromObjId }, { $addToSet: { friendlist: toObjId   } }),
    ]);

    let roomId = null;

    // 2) 채팅방/메시지 생성은 실패해도 수락 자체는 성공 처리
    try {
      let chatRoom = await ChatRoom.findOne({
        participants: { $all: [toObjId, fromObjId], $size: 2 }
      });

      if (!chatRoom) {
        chatRoom = await ChatRoom.create({ participants: [toObjId, fromObjId], messages: [] });
        log('💬 채팅방 생성', { roomId: chatRoom._id });
      } else {
        log('💬 기존 채팅방 사용', { roomId: chatRoom._id });
      }

      roomId = String(chatRoom._id);

      // sender 필수 스키마 대비: 시스템 메시지도 일단 내 아이디로 기록
      const systemMessage = await Message.create({
        chatRoom: chatRoom._id,
        sender: toObjId, // myId
        content: '채팅이 시작되었습니다.',
      });
      chatRoom.messages.push(systemMessage._id);
      await chatRoom.save();
    } catch (chatErr) {
      logErr('chat/message create failed (ignored)', chatErr);
      // 계속 진행
    }

    await Promise.all([
      User.updateOne({ _id: fromObjId }, { $inc: { acceptedChatCountTotal: 1 } }),
      User.updateOne({ _id: toObjId },   { $inc: { acceptedChatCountTotal: 1 } }),
    ]);

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestAccepted) {
      try { emit.friendRequestAccepted(await populateRequest(request)); } catch (e) { logErr('emit.friendRequestAccepted failed', e); }
    }

    log('🤝 친구 수락 & 채팅 시작', { path: req.baseUrl + req.path, fromId, toId, roomId });
    // ✅ roomId 함께 반환하여 프론트가 즉시 채팅방으로 이동 가능
    res.json({ ok: true, roomId });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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

    const fromId = String(request.from);
    if (!isValidObjectId(fromId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });

    const myObjId = new mongoose.Types.ObjectId(myId);
    const fromObjId = new mongoose.Types.ObjectId(fromId);

    // ✅ save() 대신 원자 연산: blocklist 추가 + 서로 friendlist 제거
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

    log('🚫 친구 차단', { path: req.baseUrl + req.path, fromId, toId: myId, id });
    res.json({ ok: true });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    // friendlist가 [String]인 경우 populate는 무시되므로, 프론트는 id만 사용하거나
    // 스키마를 ObjectId로 전환하는 것을 권장
    const user = await User.findById(me).populate('friendlist', USER_MIN_FIELDS);
    res.json(user?.friendlist || []);
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👤 유저 프로필 + 친구/차단 여부
 * ============================ */
// (2) 유저 프로필 + 친구/차단 여부 - 민감정보 제외 보강
router.get('/users/:id', requireLogin, async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const targetId = String(req.params.id);

    // password 등 민감정보 제외
    const SAFE_USER_FIELDS =
      'username nickname birthyear gender region1 region2 preference profileImages profileMain ' +
      'search_birthyear1 search_birthyear2 search_region1 search_region2 search_preference user_level ' +
      'last_login marriage createdAt updatedAt';

    const targetUser = await User.findById(targetId).select(SAFE_USER_FIELDS).lean();
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const me = await User.findById(myId).select('friendlist blocklist').lean();
    if (!me) return res.status(404).json({ message: '내 정보가 없습니다.' });

    const isFriend = (me.friendlist || []).some(fid => String(fid) === targetId);
    const isBlocked = (me.blocklist || []).some(bid => String(bid) === targetId);

    res.json({ ...targetUser, isFriend, isBlocked });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    }

    const myObjId = new mongoose.Types.ObjectId(myId);
    const targetObjId = new mongoose.Types.ObjectId(targetId);

    const [r1, r2] = await Promise.all([
      // 내 리스트에서 상대 제거
      User.updateOne({ _id: myObjId },    { $pull: { friendlist: targetObjId } }),
      // 상대 리스트에서 나 제거
      User.updateOne({ _id: targetObjId },{ $pull: { friendlist: myObjId } }),
    ]);

    log('🗑️ 친구 삭제', {
      path: req.baseUrl + req.path,
      myId,
      targetId,
      modifiedA: r1.modifiedCount || 0,
      modifiedB: r2.modifiedCount || 0,
    });

    return res.json({ ok: true, modifiedA: r1.modifiedCount || 0, modifiedB: r2.modifiedCount || 0 });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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

    const myObjId = new mongoose.Types.ObjectId(myId);
    const targetObjId = new mongoose.Types.ObjectId(targetId);

    // ✅ save() 없이 원자 연산으로 처리
    const [rBlock, rPullA, rPullB, rReject] = await Promise.all([
      User.updateOne({ _id: myObjId },    { $addToSet: { blocklist: targetObjId } }),
      User.updateOne({ _id: myObjId },    { $pull: { friendlist: targetObjId } }),
      User.updateOne({ _id: targetObjId },{ $pull: { friendlist: myObjId } }),
      FriendRequest.updateMany(
        { status: 'pending', $or: [ { from: myObjId, to: targetObjId }, { from: targetObjId, to: myObjId } ] },
        { $set: { status: 'rejected' } }
      ),
    ]);

    const emit = req.app.get('emit');
    if (emit && emit.blockCreated) {
      try { emit.blockCreated({ blockerId: myId, blockedId: targetId }); } catch (e) { logErr('emit.blockCreated failed', e); }
    }

    log('🚫 일반 차단 완료', {
      path: req.baseUrl + req.path,
      myId,
      targetId,
      blockAdded: rBlock.modifiedCount || 0,
      removedA: rPullA.modifiedCount || 0,
      removedB: rPullB.modifiedCount || 0,
      rejectedPending: rReject.modifiedCount || 0,
    });

    return res.json({
      ok: true,
      blockAdded: rBlock.modifiedCount || 0,
      removedA: rPullA.modifiedCount || 0,
      removedB: rPullB.modifiedCount || 0,
      rejectedPending: rReject.modifiedCount || 0,
    });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
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

    if (!isValidObjectId(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });

    const myObjId = new mongoose.Types.ObjectId(myId);
    const targetObjId = new mongoose.Types.ObjectId(targetId);

    const r = await User.updateOne({ _id: myObjId }, { $pull: { blocklist: targetObjId } });

    log('✅ 차단 해제', { path: req.baseUrl + req.path, myId, targetId, modified: r.modifiedCount || 0 });
    res.json({ ok: true, modified: r.modifiedCount || 0 });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message, stack: err?.stack });
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
