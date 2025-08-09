const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const FriendRequest = require('../models/friendRequest');
const requireLogin = require('../middlewares/authMiddleware'); // 🔐 로그인 확인 미들웨어
const router = express.Router();

/**
 * 📨 친구 신청 (A → B)
 */
router.post('/friend-request', requireLogin, async (req, res) => {
  try {
    const fromId = req.session.user._id;
    const { to, message } = req.body;

    if (fromId === to) return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });

    const exists = await FriendRequest.findOne({ from: fromId, to });
    if (exists) return res.status(400).json({ message: '이미 신청한 사용자입니다' });

    const request = new FriendRequest({ from: fromId, to, message });
    await request.save();

    console.log(`✅ 친구 신청: ${fromId} → ${to}`);
    res.json({ message: '친구 신청이 전송되었습니다.' });
  } catch (err) {
    console.error('[친구 신청 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🗑️ 친구 신청 취소
 */
router.delete('/friend-request/:id', requireLogin, async (req, res) => {
  try {
    const fromId = req.session.user._id;
    const { id } = req.params;

    const deleted = await FriendRequest.findOneAndDelete({
      _id: id,
      from: fromId,
      status: 'pending'
    });

    if (!deleted) {
      return res.status(404).json({ message: '삭제할 친구 신청이 없거나 권한이 없습니다.' });
    }

    console.log(`🗑️ 친구 신청 취소됨: ${fromId} → ${deleted.to}`);
    res.json({ message: '친구 신청을 취소했습니다.' });
  } catch (err) {
    console.error('[친구 신청 취소 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 📬 내가 받은 친구 신청 리스트
 */
router.get('/friend-requests/received', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;

    const requests = await FriendRequest.find({ to: myId, status: 'pending' })
      .populate('from', 'username nickname');

    res.json(requests);
  } catch (err) {
    console.error('[받은 신청 목록 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 📤 내가 보낸 친구 신청 리스트
 */
router.get('/friend-requests/sent', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;

    const requests = await FriendRequest.find({ from: myId, status: 'pending' })
      .populate('to', 'username nickname');

    res.json(requests);
  } catch (err) {
    console.error('[보낸 신청 목록 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🤝 친구 신청 수락
 */
router.put('/friend-request/:id/accept', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || request.to.toString() !== myId) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'accepted';
    await request.save();

    const userMe = await User.findById(myId);
    const userFrom = await User.findById(request.from);

    if (!userMe.friendlist.includes(userFrom._id)) userMe.friendlist.push(userFrom._id);
    if (!userFrom.friendlist.includes(userMe._id)) userFrom.friendlist.push(userMe._id);

    await userMe.save();
    await userFrom.save();

    let chatRoom = await ChatRoom.findOne({
      participants: { $all: [userMe._id, userFrom._id], $size: 2 }
    });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        participants: [userMe._id, userFrom._id],
        messages: []
      });
      await chatRoom.save();
      console.log('💬 채팅방 생성:', chatRoom._id);
    }

    const systemMessage = new Message({
      chatRoom: chatRoom._id,
      sender: null,
      content: '채팅이 시작되었습니다.'
    });
    await systemMessage.save();

    chatRoom.messages.push(systemMessage._id);
    await chatRoom.save();

    console.log(`🤝 친구 수락 & 채팅 시작: ${request.from} ↔ ${myId}`);
    res.json({ message: '친구 요청을 수락했습니다.' });
  } catch (err) {
    console.error('[친구 수락 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * ❌ 친구 신청 거절
 */
router.put('/friend-request/:id/reject', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || request.to.toString() !== myId) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'rejected';
    await request.save();

    console.log(`❌ 친구 거절: ${request.from} → ${myId}`);
    res.json({ message: '친구 요청을 거절했습니다.' });
  } catch (err) {
    console.error('[친구 거절 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🚫 친구 차단 (거절 + blocklist 추가)
 */
router.put('/friend-request/:id/block', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const { id } = req.params;

    const request = await FriendRequest.findById(id);
    if (!request || request.to.toString() !== myId) {
      return res.status(403).json({ message: '권한 없음 또는 신청 없음' });
    }

    request.status = 'rejected';
    await request.save();

    const userMe = await User.findById(myId);
    if (!userMe.blocklist.includes(request.from)) {
      userMe.blocklist.push(request.from);
      await userMe.save();
    }

    console.log(`🚫 친구 차단: ${request.from} → ${myId}`);
    res.json({ message: '사용자를 차단했습니다.' });
  } catch (err) {
    console.error('[친구 차단 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 👥 친구 리스트 조회
 */
router.get('/friends', requireLogin, async (req, res) => {
  const me = req.session.user._id;
  const user = await User.findById(me).populate('friendlist', 'nickname');
  res.json(user.friendlist);
});

/**
 * 🚫 차단 리스트 조회
 */
router.get('/blocks', requireLogin, async (req, res) => {
  const me = req.session.user._id;
  const user = await User.findById(me).populate('blocklist', 'nickname');
  res.json(user.blocklist);
});

/**
 * 👤 유저 프로필 + 친구 여부 조회
 */
router.get('/users/:id', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const targetId = req.params.id;

    console.log(`📥 [요청] 유저 프로필 조회: ${targetId}`);

    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const me = await User.findById(myId).lean();
    if (!me) {
      return res.status(404).json({ message: '내 정보가 없습니다.' });
    }

    const isFriend = me.friendlist.some(friendId => friendId.equals(targetId));
    console.log(`👥 친구 여부 (${targetId}):`, isFriend);

    res.json({
      ...targetUser,
      isFriend
    });
  } catch (err) {
    console.error('❌ [유저 프로필 조회 오류]:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🗑️ 친구 삭제
 */
router.delete('/friend/:id', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const targetId = req.params.id;

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!me || !target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });

    me.friendlist = me.friendlist.filter(fid => !fid.equals(targetId));
    target.friendlist = target.friendlist.filter(fid => !fid.equals(myId));

    await me.save();
    await target.save();

    console.log(`🗑️ 친구 삭제됨: ${myId} ↔ ${targetId}`);
    res.json({ message: '친구가 삭제되었습니다' });
  } catch (err) {
    console.error('[친구 삭제 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * 🔓 차단 해제
 */
router.delete('/block/:id', requireLogin, async (req, res) => {
  try {
    const myId = req.session.user._id;
    const targetId = req.params.id;

    const me = await User.findById(myId);
    if (!me) return res.status(404).json({ message: '사용자 정보 없음' });

    me.blocklist = me.blocklist.filter(bid => !bid.equals(targetId));
    await me.save();

    console.log(`✅ 차단 해제됨: ${targetId} → ${myId}`);
    res.json({ message: '차단이 해제되었습니다' });
  } catch (err) {
    console.error('[차단 해제 오류]', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
