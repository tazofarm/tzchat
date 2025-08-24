// backend/routes/friendRouter.js
// ------------------------------------------------------------
// 친구 신청/수락/거절/차단/목록 라우터
// - 변경 최소화 원칙 준수
// - ★ 신규: 누적 카운터($inc) 반영
//   * 신청 생성: from.sentRequestCountTotal++, to.receivedRequestCountTotal++
//   * 수락(처음 pending→accepted 전이): 양쪽 acceptedChatCountTotal++
// - ★ 수락 로직은 findOneAndUpdate로 원자적 전이 보장(중복 증가 방지)
// - 가독성(검은색 텍스트), 주석/로그 최대화
// - ★ POST /friend-request: 유효성 검사/로그 강화 + E11000 400 처리
// - ★ NEW: PUT /block/:id (일반 차단) 추가
// - ★ users/:id 응답에 isBlocked 포함
// ------------------------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // 이미지 압축용 (현재 파일에선 미사용이지만 기존 유지)
const bcrypt = require('bcrypt'); // 비밀번호 해시/검증용 (현재 파일에선 미사용이지만 기존 유지)
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');

const requireLogin = require('../middlewares/authMiddleware');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency'); // (현재 파일 내 미사용) 기존 유지
const router = express.Router();

// 🔔 푸시 발송 모듈 (기존 유지)
const { sendPushToUser } = require('../push/sender');

/** 공통: 프로필에 필요한 필드(간단 프로젝션) */
const USER_MIN_FIELDS = 'username nickname birthyear gender';

/** 유틸: friendRequest 문서를 from/to 모두 인구(populate) */
async function populateRequest(doc) {
  if (!doc) return null;
  return doc.populate([
    { path: 'from', select: USER_MIN_FIELDS },
    { path: 'to',   select: USER_MIN_FIELDS },
  ]);
}

/** 간단 로그 유틸 */
function log(...args) {
  try { console.log('[friendRouter]', ...args); } catch (_) {}
}
function logErr(...args) {
  try { console.error('[friendRouter][ERR]', ...args); } catch (_) {}
}

/** ============================
 *  📨 친구 신청 (A → B)
 * ============================ */
router.post('/friend-request', requireLogin, async (req, res) => {
  const fromId = String(req.session?.user?._id || '');
  const rawBody = req.body; // 디버그용
  const { to, message } = rawBody || {};
  const toId = String(to || '');

  // 0) 입력값 로그 (민감정보 제외)
  log('POST /friend-request :: incoming', {
    hasSession: !!req.session?.user?._id,
    fromId,
    body: { to: toId, messageLen: (message || '').length }
  });

  try {
    // 1) 기본 유효성 + ObjectId 검증
    if (!fromId) {
      logErr('no-session-user');
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    if (!toId) {
      logErr('no-to');
      return res.status(400).json({ message: '대상 사용자(to)가 필요합니다.' });
    }
    if (!isValidObjectId(toId)) {
      logErr('invalid-toId', toId);
      return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    }
    if (fromId === toId) {
      return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });
    }

    // 2) 실제 존재하는 사용자 여부
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromId).select('_id nickname suspended friendlist blocklist').lean(),
      User.findById(toId).select('_id nickname suspended friendlist blocklist').lean()
    ]);

    if (!fromUser) {
      logErr('fromUser-not-found', { fromId });
      return res.status(404).json({ message: '내 사용자 정보를 찾을 수 없습니다.' });
    }
    if (!toUser) {
      logErr('toUser-not-found', { toId });
      return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
    }
    if (fromUser.suspended || toUser.suspended) {
      logErr('suspended-user', { fromSusp: !!fromUser.suspended, toSusp: !!toUser.suspended });
      return res.status(403).json({ message: '정지된 계정입니다.' });
    }

    // 3) 이미 친구인지 방어
    const alreadyFriend = (fromUser.friendlist || []).some(fid => String(fid) === toId);
    if (alreadyFriend) {
      return res.status(400).json({ message: '이미 친구 상태입니다.' });
    }

    // 4) 차단 관계 방어 (상호 차단 포함)
    const iBlockedHim = (fromUser.blocklist || []).some(bid => String(bid) === toId);
    const heBlockedMe = (toUser.blocklist || []).some(bid => String(bid) === fromId);
    if (iBlockedHim || heBlockedMe) {
      return res.status(400).json({ message: '차단 상태에서는 친구 신청이 불가합니다.' });
    }

    // 5) 같은 조합의 pending 존재 여부 체크 (양방향 방어)
    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    }).lean();
    if (exists) {
      log('duplicate-pending', { existsId: exists._id });
      return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });
    }

    // 6) 생성
    try {
      log('creating-friend-request');
      const request = await FriendRequest.create({
        from: fromId,
        to: toId,
        message: message || '',
        status: 'pending'
      });
      log('created-friend-request', { requestId: request._id });

      // 7) 누적 카운터 증가
      try {
        const incRes = await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }),
          User.updateOne({ _id: toId   }, { $inc: { receivedRequestCountTotal: 1 } }),
        ]);
        log('counter-inc-ok', incRes.map(r => r.acknowledged));
      } catch (incErr) {
        logErr('counter-inc-failed', incErr);
      }

      // 8) populate
      const populated = await populateRequest(request);

      // 9) 소켓
      const emit = req.app.get('emit');
      if (emit && emit.friendRequestCreated) {
        try { emit.friendRequestCreated(populated); } catch (emitErr) { logErr('socket-emit-failed', emitErr); }
      }

      // 10) 푸시 (옵션)
      (async () => {
        try {
          const fromNick = fromUser?.nickname || '알 수 없음';
          log('[push][friend-request] 준비', { toId, fromNick });
          await sendPushToUser(toId, {
            title: '친구 신청 도착',
            body: `${fromNick} 님이 친구 신청을 보냈습니다.`,
            type: 'friend_request',
            fromUserId: fromId,
            roomId: '',
          });
          log('[push][friend-request] ✅ 발송 완료', { toId });
        } catch (pushErr) {
          logErr('[push][friend-request] 발송 오류', pushErr);
        }
      })();

      log('✅ 친구 신청 완료', { fromId, toId, requestId: request._id });
      return res.json(populated);
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        logErr('E11000 duplicate on create (pending unique)', createErr);
        return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });
      }
      throw createErr;
    }
  } catch (err) {
    logErr('친구 신청 오류', { message: err?.message, name: err?.name, code: err?.code, stack: err?.stack });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 신청 취소
 * ============================ */
router.delete('/friend-request/:id', requireLogin, async (req, res) => {
  try {
    const fromId = String(req.session.user._id);
    const { id } = req.params;

    const deleted = await FriendRequest
      .findOneAndDelete({ _id: id, from: fromId, status: 'pending' })
      .populate('from to', USER_MIN_FIELDS);

    if (!deleted) {
      return res.status(404).json({ message: '삭제할 친구 신청이 없거나 권한이 없습니다.' });
    }

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestCancelled) emit.friendRequestCancelled(deleted);

    log('🗑️ 친구 신청 취소', { fromId, toId: deleted.to?._id, id });
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    logErr('친구 신청 취소 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  📬 내가 받은 친구 신청 리스트
 * ============================ */
router.get('/friend-requests/received', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const requests = await FriendRequest.find({ to: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('from', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    logErr('받은 신청 목록 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  📤 내가 보낸 친구 신청 리스트
 * ============================ */
router.get('/friend-requests/sent', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const requests = await FriendRequest.find({ from: myId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('to', USER_MIN_FIELDS);
    res.json(requests);
  } catch (err) {
    logErr('보낸 신청 목록 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🤝 친구 신청 수락
 * ============================ */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    // 1) 원자적 전이
    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );
    if (!request) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });
    }

    // 2) 친구목록 동기화(양방향)
    const fromId = String(request.from);
    const toId = String(request.to);

    const [userMe, userFrom] = await Promise.all([
      User.findById(toId),
      User.findById(fromId),
    ]);
    if (!userMe || !userFrom) {
      logErr('수락 처리 중 사용자 조회 실패', { toId, fromId });
      return res.status(404).json({ message: '사용자 조회 실패' });
    }

    if (!userMe.friendlist.some(fid => String(fid) === fromId)) {
      userMe.friendlist.push(userFrom._id);
    }
    if (!userFrom.friendlist.some(fid => String(fid) === toId)) {
      userFrom.friendlist.push(userMe._id);
    }
    await Promise.all([userMe.save(), userFrom.save()]);

    // 3) 채팅방 생성(없으면) + 시스템 메시지
    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [userMe._id, userFrom._id], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = await ChatRoom.create({
        participants: [userMe._id, userFrom._id],
        messages: []
      });
      log('💬 채팅방 생성', { roomId: chatRoom._id });
    }

    const systemMessage = await Message.create({
      chatRoom: chatRoom._id,
      sender: null,
      content: '채팅이 시작되었습니다.'
    });
    chatRoom.messages.push(systemMessage._id);
    await chatRoom.save();

    // 4) 누적 카운터 증가
    await Promise.all([
      User.updateOne({ _id: fromId }, { $inc: { acceptedChatCountTotal: 1 } }),
      User.updateOne({ _id: toId },   { $inc: { acceptedChatCountTotal: 1 } }),
    ]);
    log('counter++ on accept', { fromId, toId });

    // 5) 소켓
    const populated = await populateRequest(request);
    const emit = req.app.get('emit');
    if (emit && emit.friendRequestAccepted) emit.friendRequestAccepted(populated);

    log('🤝 친구 수락 & 채팅 시작', { fromId, toId, roomId: chatRoom._id });
    res.json({ ok: true });
  } catch (err) {
    logErr('친구 수락 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  ❌ 친구 신청 거절
 * ============================ */
router.put('/friend-request/:id/reject', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true }
    );
    if (!request) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });
    }

    const populated = await populateRequest(request);

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestRejected) emit.friendRequestRejected(populated);

    log('❌ 친구 거절', { from: String(request.from), to: myId, id });
    res.json({ ok: true });
  } catch (err) {
    logErr('친구 거절 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 친구 차단 (받은 신청에서 즉시 차단)
 * ============================ */
router.put('/friend-request/:id/block', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'rejected' } },
      { new: true }
    );
    if (!request) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });
    }

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

    log('🚫 친구 차단', { fromId, toId: myId, id });
    res.json({ ok: true });
  } catch (err) {
    logErr('친구 차단 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👥 친구 리스트 조회
 * ============================ */
router.get('/friends', requireLogin, async (req, res) => {
  try {
    const me = req.session.user._id;
    const user = await User.findById(me).populate('friendlist', USER_MIN_FIELDS);
    res.json(user?.friendlist || []);
  } catch (err) {
    logErr('친구 리스트 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 차단 리스트 조회
 * ============================ */
router.get('/blocks', requireLogin, async (req, res) => {
  try {
    const me = req.session.user._id;
    const user = await User.findById(me).populate('blocklist', USER_MIN_FIELDS);
    res.json(user?.blocklist || []);
  } catch (err) {
    logErr('차단 리스트 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👤 유저 프로필 + 친구/차단 여부 (★ isBlocked 추가)
 * ============================ */
router.get('/users/:id', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const targetId = String(req.params.id);

    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const me = await User.findById(myId).lean();
    if (!me) return res.status(404).json({ message: '내 정보가 없습니다.' });

    const isFriend  = (me.friendlist  || []).some(fid => String(fid) === targetId);
    const isBlocked = (me.blocklist   || []).some(bid => String(bid) === targetId);

    // 기존 구조 유지: targetUser 전체 + isFriend, isBlocked를 덧붙여 전달
    res.json({ ...targetUser, isFriend, isBlocked });
  } catch (err) {
    logErr('유저 프로필 조회 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 삭제
 * ============================ */
router.delete('/friend/:id', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const targetId = String(req.params.id);

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!me || !target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });

    me.friendlist = (me.friendlist || []).filter(fid => String(fid) !== targetId);
    target.friendlist = (target.friendlist || []).filter(fid => String(fid) !== myId);

    await me.save();
    await target.save();

    log('🗑️ 친구 삭제', { myId, targetId });
    res.json({ ok: true });
  } catch (err) {
    logErr('친구 삭제 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 (NEW) 일반 차단 생성
 *  - PUT /block/:id
 *  - 나의 blocklist에 대상 추가
 *  - 기존 친구 관계가 있으면 해제
 *  - 진행 중인 친구 신청(pending)이 양방향 존재하면 모두 rejected 처리
 *  - 소켓 이벤트 emit.blockCreated (옵션)
 * ============================ */
router.put('/block/:id', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const targetId = String(req.params.id);

    log('PUT /block/:id :: incoming', { myId, targetId });

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    }
    if (myId === targetId) {
      return res.status(400).json({ message: '자기 자신을 차단할 수 없습니다.' });
    }

    const [me, target] = await Promise.all([
      User.findById(myId),
      User.findById(targetId)
    ]);
    if (!me || !target) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 1) blocklist 추가 (중복 방지)
    let added = false;
    if (!me.blocklist.some(bid => String(bid) === targetId)) {
      me.blocklist.push(target._id);
      added = true;
    }

    // 2) 친구 관계가 있으면 양쪽에서 제거
    const beforeA = me.friendlist?.length || 0;
    const beforeB = target.friendlist?.length || 0;
    me.friendlist     = (me.friendlist     || []).filter(fid => String(fid) !== targetId);
    target.friendlist = (target.friendlist || []).filter(fid => String(fid) !== myId);
    const removedFriends = (beforeA !== (me.friendlist?.length||0)) || (beforeB !== (target.friendlist?.length||0));

    // 3) 진행 중인 친구 신청은 모두 rejected로 변경 (양방향)
    const { modifiedCount } = await FriendRequest.updateMany(
      {
        status: 'pending',
        $or: [
          { from: myId,    to: targetId },
          { from: targetId, to: myId }
        ]
      },
      { $set: { status: 'rejected' } }
    );

    await Promise.all([me.save(), target.save()]);

    // 4) 소켓 이벤트 (옵션)
    const emit = req.app.get('emit');
    if (emit && emit.blockCreated) {
      try { emit.blockCreated({ blockerId: myId, blockedId: targetId }); }
      catch (e) { logErr('emit.blockCreated failed', e); }
    }

    log('🚫 일반 차단 완료', {
      myId, targetId,
      addedBlock: added,
      removedFriends,
      rejectedPending: modifiedCount
    });

    return res.json({ ok: true, addedBlock: added, removedFriends, rejectedPending: modifiedCount });
  } catch (err) {
    logErr('일반 차단 오류', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🔓 차단 해제
 * ============================ */
router.delete('/block/:id', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const targetId = String(req.params.id);

    const me = await User.findById(myId);
    if (!me) return res.status(404).json({ message: '사용자 정보 없음' });

    me.blocklist = (me.blocklist || []).filter(bid => String(bid) !== targetId);
    await me.save();

    log('✅ 차단 해제', { myId, targetId });
    res.json({ ok: true });
  } catch (err) {
    logErr('차단 해제 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
