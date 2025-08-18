const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // ✅ 이미지 압축용
const bcrypt = require('bcrypt'); // ✅ [추가] 비밀번호 해시/검증용 (아래에서 사용함)
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ✅ 누락된 import 추가
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const requireLogin = require('../middlewares/authMiddleware');
const { EMERGENCY_DURATION_SECONDS, computeRemaining } = require('../config/emergency');
const router = express.Router();

// 🔔 푸시 발송 모듈 (신규)
const { sendPushToUser } = require('../push/sender');

/**
/** 공통: 프로필에 필요한 필드 */
const USER_MIN_FIELDS = 'username nickname birthyear gender';

/** 유틸: friendRequest 문서를 from/to 모두 인구(populate) */
async function populateRequest(doc) {
  if (!doc) return null;
  return doc.populate([
    { path: 'from', select: USER_MIN_FIELDS },
    { path: 'to',   select: USER_MIN_FIELDS },
  ]);
}

/** ============================
 *  📨 친구 신청 (A → B)
 *  - 생성 후 양쪽 유저에게 'friendRequest:created'
 *  - 응답: populate된 request 반환(프론트가 즉시 렌더/ⓝ 표시)
 *  - 🔔 신청 "받는 사람"에게 FCM 푸시 발송 (신규)
 * ============================ */
router.post('/friend-request', requireLogin, async (req, res) => {
  try {
    const fromId = String(req.session.user._id);
    const { to, message } = req.body;
    const toId = String(to);

    if (fromId === toId) {
      return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });
    }

    // 같은 조합의 pending 존재 여부 체크 (양방향도 방어적으로 확인)
    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    });
    if (exists) return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });

    const request = await FriendRequest.create({ from: fromId, to: toId, message, status: 'pending' });
    const populated = await populateRequest(request);

    // 소켓 브로드캐스트 (기존 유지)
    const emit = req.app.get('emit');
    if (emit && emit.friendRequestCreated) emit.friendRequestCreated(populated);

    // 🔔 푸시: 받는 사람(to)에게 "친구 신청 도착"
    (async () => {
      try {
        // 보낸 사람 닉네임 조회 (body 메시지용)
        const fromUser = await User.findById(fromId, { nickname: 1 }).lean();
        const fromNick = fromUser?.nickname || '알 수 없음';

        console.log('[push][friend-request] 발송 준비:', { toId, fromNick });

        await sendPushToUser(toId, {
          title: '친구 신청 도착',
          body: `${fromNick} 님이 친구 신청을 보냈습니다.`,
          type: 'friend_request',  // 프론트에서 구분용
          fromUserId: fromId,
          roomId: '',              // 친구신청은 채팅방 없음
        });

        console.log('[push][friend-request] ✅ 발송 완료:', { toId });
      } catch (pushErr) {
        console.error('[push][friend-request] ❌ 발송 오류:', pushErr);
      }
    })();

    console.log(`✅ 친구 신청: ${fromId} → ${toId}`);
    res.json(populated);
  } catch (err) {
    console.error('[친구 신청 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 신청 취소 (보낸 사람이 취소)
 *  - 양쪽에 'friendRequest:cancelled'
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

    console.log(`🗑️ 친구 신청 취소됨: ${fromId} → ${deleted.to?._id}`);
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error('[친구 신청 취소 오류]', err);
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
    console.error('[받은 신청 목록 오류]', err);
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
    console.error('[보낸 신청 목록 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🤝 친구 신청 수락 (받은 사람이 수락)
 *  - 양쪽에 'friendRequest:accepted'
 *  - 1:1 채팅방 생성(없으면)
 *  - (옵션) 보낸 사람에게 "수락" 푸시 가능 (주석 참고)
 * ============================ */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || String(request.to) !== myId || request.status !== 'pending') {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'accepted';
    await request.save();

    const userMe = await User.findById(myId);
    const userFrom = await User.findById(request.from);

    if (!userMe.friendlist.some(fid => String(fid) === String(userFrom._id))) {
      userMe.friendlist.push(userFrom._id);
    }
    if (!userFrom.friendlist.some(fid => String(fid) === String(userMe._id))) {
      userFrom.friendlist.push(userMe._id);
    }
    await userMe.save();
    await userFrom.save();

    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [userMe._id, userFrom._id], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = await ChatRoom.create({
        participants: [userMe._id, userFrom._id],
        messages: []
      });
      console.log('💬 채팅방 생성:', chatRoom._id);
    }

    const systemMessage = await Message.create({
      chatRoom: chatRoom._id,
      sender: null,
      content: '채팅이 시작되었습니다.'
    });
    chatRoom.messages.push(systemMessage._id);
    await chatRoom.save();

    const populated = await populateRequest(request);

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestAccepted) emit.friendRequestAccepted(populated);

    // (옵션) 🔔 보낸 사람에게 "수락됨" 푸시 — 원하시면 주석 해제
    /*
    (async () => {
      try {
        const me = await User.findById(myId, { nickname: 1 }).lean();
        await sendPushToUser(String(request.from), {
          title: '친구 신청 수락',
          body: `${me?.nickname || '상대방'} 님이 친구 신청을 수락했습니다.`,
          type: 'friend_accept',
          fromUserId: myId,
        });
        console.log('[push][friend-accept] ✅ 발송 완료:', { to: String(request.from) });
      } catch (pushErr) {
        console.error('[push][friend-accept] ❌ 발송 오류:', pushErr);
      }
    })();
    */

    console.log(`🤝 친구 수락 & 채팅 시작: ${request.from} ↔ ${myId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[친구 수락 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  ❌ 친구 신청 거절 (받은 사람이 거절)
 *  - 양쪽에 'friendRequest:rejected'
 *  - (옵션) 보낸 사람에게 "거절" 푸시 가능 (주석 참고)
 * ============================ */
router.put('/friend-request/:id/reject', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || String(request.to) !== myId || request.status !== 'pending') {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'rejected';
    await request.save();

    const populated = await populateRequest(request);

    const emit = req.app.get('emit');
    if (emit && emit.friendRequestRejected) emit.friendRequestRejected(populated);

    // (옵션) 🔔 보낸 사람에게 "거절됨" 푸시 — 원하시면 주석 해제
    /*
    (async () => {
      try {
        const me = await User.findById(myId, { nickname: 1 }).lean();
        await sendPushToUser(String(request.from), {
          title: '친구 신청 거절',
          body: `${me?.nickname || '상대방'} 님이 친구 신청을 거절했습니다.`,
          type: 'friend_reject',
          fromUserId: myId,
        });
        console.log('[push][friend-reject] ✅ 발송 완료:', { to: String(request.from) });
      } catch (pushErr) {
        console.error('[push][friend-reject] ❌ 발송 오류:', pushErr);
      }
    })();
    */

    console.log(`❌ 친구 거절: ${request.from} → ${myId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[친구 거절 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🚫 친구 차단 (거절 + blocklist 추가)
 *  - 'friendRequest:rejected' + 'block:created'
 * ============================ */
router.put('/friend-request/:id/block', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || String(request.to) !== myId || request.status !== 'pending') {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'rejected';
    await request.save();

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

    console.log(`🚫 친구 차단: ${fromId} → ${myId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[친구 차단 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👥 친구 리스트 조회
 *  - 프론트에서 username/nickname/birthyear/gender를 쓰므로 모두 제공
 * ============================ */
router.get('/friends', requireLogin, async (req, res) => {
  try {
    const me = req.session.user._id;
    const user = await User.findById(me).populate('friendlist', USER_MIN_FIELDS);
    res.json(user?.friendlist || []);
  } catch (err) {
    console.error('[친구 리스트 오류]', err);
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
    console.error('[차단 리스트 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  👤 유저 프로필 + 친구 여부
 * ============================ */
router.get('/users/:id', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const targetId = String(req.params.id);

    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const me = await User.findById(myId).lean();
    if (!me) return res.status(404).json({ message: '내 정보가 없습니다.' });

    const isFriend = (me.friendlist || []).some(fid => String(fid) === targetId);

    res.json({ ...targetUser, isFriend });
  } catch (err) {
    console.error('[유저 프로필 조회 오류]', err);
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

    console.log(`🗑️ 친구 삭제됨: ${myId} ↔ ${targetId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[친구 삭제 오류]', err);
    res.status(500).json({ message: '서버 오류' });
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

    console.log(`✅ 차단 해제됨: ${targetId} → ${myId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[차단 해제 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
