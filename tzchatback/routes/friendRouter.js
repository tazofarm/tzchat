// backend/routes/friendRouter.js
// ------------------------------------------------------------
// 친구 신청/수락/거절/차단/목록 라우터
// - 변경 최소화 원칙 준수
// - ★ 신규: 누적 카운터($inc) 반영
//   * 신청 생성: from.sentRequestCountTotal++, to.receivedRequestCountTotal++
//   * 수락(처음 pending→accepted 전이): 양쪽 acceptedChatCountTotal++
// - ★ 수락 로직은 findOneAndUpdate로 원자적 전이 보장(중복 증가 방지)
// - 가독성(검은색 텍스트), 주석/로그 최대화
// ------------------------------------------------------------

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp'); // 이미지 압축용 (현재 파일에선 미사용이지만 기존 유지)
const bcrypt = require('bcrypt'); // 비밀번호 해시/검증용 (현재 파일에선 미사용이지만 기존 유지)

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
 *  - 생성 후 소켓/푸시
 *  - ★ 누적 카운터 +1 (from: sent, to: received)
 * ============================ */
router.post('/friend-request', requireLogin, async (req, res) => {
  try {
    const fromId = String(req.session.user._id);
    const { to, message } = req.body || {};
    const toId = String(to);

    log('POST /friend-request', { fromId, toId });

    if (!toId) return res.status(400).json({ message: '대상 사용자(to)가 필요합니다.' });
    if (fromId === toId) {
      return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });
    }

    // 같은 조합의 pending 존재 여부 체크 (양방향 방어)
    const exists = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId, status: 'pending' },
        { from: toId,   to: fromId, status: 'pending' },
      ]
    }).lean();
    if (exists) return res.status(400).json({ message: '이미 진행 중인 친구 신청이 있습니다.' });

    // 1) 친구 신청 문서 생성
    const request = await FriendRequest.create({ from: fromId, to: toId, message, status: 'pending' });

    // 2) ★ 누적 카운터 증가 (원자적 $inc)
    //    - 신청자: sentRequestCountTotal +1
    //    - 수신자: receivedRequestCountTotal +1
    await Promise.all([
      User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }),
      User.updateOne({ _id: toId },   { $inc: { receivedRequestCountTotal: 1 } }),
    ]);
    log('counter++ on create', {
      fromId, toId,
      inc: { from: 'sentRequestCountTotal', to: 'receivedRequestCountTotal' }
    });

    const populated = await populateRequest(request);

    // 소켓 브로드캐스트 (기존 유지)
    const emit = req.app.get('emit');
    if (emit && emit.friendRequestCreated) emit.friendRequestCreated(populated);

    // 🔔 푸시: 받는 사람(to)에게 "친구 신청 도착"
    (async () => {
      try {
        const fromUser = await User.findById(fromId, { nickname: 1 }).lean();
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

    log('✅ 친구 신청', { fromId, toId, requestId: request._id });
    res.json(populated);
  } catch (err) {
    logErr('친구 신청 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  🗑️ 친구 신청 취소 (보낸 사람이 취소)
 *  - 양쪽에 'friendRequest:cancelled'
 *  - (누적 카운터는 "신청 시점"에 이미 반영되었으므로 변화 없음)
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
 *  🤝 친구 신청 수락 (받은 사람이 수락)
 *  - ★ pending → accepted "처음" 전이에만 성공(원자적)
 *  - 성공 시에만 채팅방 생성/친구연결/카운터 증가
 *  - 양쪽에 'friendRequest:accepted'
 * ============================ */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = String(req.session.user._id);
    const { id } = req.params;

    // 1) ★ 원자적 전이: pending → accepted 에 "처음" 성공한 경우에만 반환
    const request = await FriendRequest.findOneAndUpdate(
      { _id: id, to: myId, status: 'pending' },
      { $set: { status: 'accepted' } },
      { new: true }
    );
    if (!request) {
      // 이미 처리(accepted/rejected/blocked) 되었거나 권한 없음
      return res.status(403).json({ message: '권한 없음 또는 신청 없음/이미 처리됨' });
    }

    // 2) 친구목록 동기화(양방향 addToSet 느낌으로 중복 방지)
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

    // 4) ★ 누적 카운터 증가(최초 수락 시 1회만)
    await Promise.all([
      User.updateOne({ _id: fromId }, { $inc: { acceptedChatCountTotal: 1 } }),
      User.updateOne({ _id: toId },   { $inc: { acceptedChatCountTotal: 1 } }),
    ]);
    log('counter++ on accept', {
      fromId, toId,
      inc: { both: 'acceptedChatCountTotal' }
    });

    // 5) populate 후 소켓 브로드캐스트
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
        log('[push][friend-accept] ✅ 발송 완료', { to: String(request.from) });
      } catch (pushErr) {
        logErr('[push][friend-accept] 발송 오류', pushErr);
      }
    })();
    */

    log('🤝 친구 수락 & 채팅 시작', { fromId, toId, roomId: chatRoom._id });
    res.json({ ok: true });
  } catch (err) {
    logErr('친구 수락 오류', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/** ============================
 *  ❌ 친구 신청 거절 (받은 사람이 거절)
 *  - 상태만 변경 (문서를 삭제하지 않아도 됨)
 *  - 누적 카운터 변화 없음(신청 시 반영 완료)
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
 *  🚫 친구 차단 (거절 + blocklist 추가)
 *  - 문서 상태를 rejected로 변경(삭제 아님)
 *  - 누적 카운터 변화 없음(신청 시 반영 완료)
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
