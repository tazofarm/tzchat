// routes/chat/friendRequestSendRouter.js
// base: /api
// ------------------------------------------------------------
// 친구 "신청 발송/취소" 전용 라우터
// - POST   /friend-request           : 일반 신청 (포인트 차감)
// - POST   /friend-request-premium   : 프리미엄 신청 (포인트 차감)
// - DELETE /friend-request/:id       : 신청 취소
// - ✅ 응답에 wallet 포함(+ x-wallet-* 헤더)
// - ✅ 로깅은 req.baseUrl + req.path 기준
// ------------------------------------------------------------
const express = require('express');
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const { FriendRequest, User } = require('@/models');
const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

// 푸시/포인트
const { sendPushToUser } = require('@/push/sender');
const points = require('@/services/pointService');
const { COST } = require('@/config/points');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

/* ----------------------------- 유틸/로깅 ------------------------------ */
function log(...args) { try { console.log('[friendRequestSendRouter]', ...args); } catch (_) {} }
function logErr(...args) { try { console.error('[friendRequestSendRouter][ERR]', ...args); } catch (_) {} }
function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
const USER_MIN_FIELDS = 'username nickname birthyear gender';

function isReplicaSetTxnError(err) {
  const m = String(err?.message || err).toLowerCase();
  return (
    m.includes('transaction numbers are only allowed') ||
    m.includes('not a replica set member') ||
    m.includes('replica set') ||
    m.includes('retryable writes are not supported') ||
    (err?.codeName === 'NotMaster') ||
    (err?.codeName === 'IllegalOperation')
  );
}
function setWalletHeaders(res, wallet) {
  if (!wallet) return;
  try {
    res.set('x-wallet-heart', String(wallet.heart ?? 0));
    res.set('x-wallet-star',  String(wallet.star ?? 0));
    res.set('x-wallet-ruby',  String(wallet.ruby ?? 0));
  } catch (_) {}
}

/* ===========================================================
 * 공통 요청/응답 로깅
 * =========================================================== */
router.use((req, res, next) => {
  const started = Date.now();
  console.log('[API][REQ]', {
    path: req.baseUrl + req.path, method: req.method, params: req.params, query: req.query, userId: getMyId(req),
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
 *  📨 친구 신청 (일반)
 * ========================= */
router.post('/friend-request', async (req, res) => {
  const fromId = getMyId(req);
  const { to, message } = req.body || {};
  const toId = String(to || '');
  log('incoming friend-request', { path: req.baseUrl + req.path, fromId, toId });

  try {
    if (!fromId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!toId)   return res.status(400).json({ message: '대상 사용자(to)가 필요합니다.' });
    if (!isValidObjectId(toId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    if (fromId === toId) return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });

    const [fromUserLean, toUser] = await Promise.all([
      User.findById(fromId).select('_id nickname suspended friendlist blocklist').lean(),
      User.findById(toId).select('_id nickname suspended friendlist blocklist').lean()
    ]);
    if (!fromUserLean) return res.status(404).json({ message: '내 사용자 정보를 찾을 수 없습니다.' });
    if (!toUser)       return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
    if (fromUserLean.suspended || toUser.suspended) return res.status(403).json({ message: '정지된 계정입니다.' });

    if ((fromUserLean.friendlist || []).some(fid => String(fid) === toId))
      return res.status(400).json({ message: '이미 친구 상태입니다.' });

    const iBlockedHim = (fromUserLean.blocklist || []).some(bid => String(bid) === toId);
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

    const session = await mongoose.startSession();
    let walletAfter = null;
    let createdReq = null;

    try {
      await session.withTransaction(async () => {
        const fromUserDoc = await User.findById(fromId).session(session);
        if (!fromUserDoc) throw new Error('내 사용자 정보를 찾을 수 없습니다.');

        const result = await points.consumeForNormalRequest(fromUserDoc, {
          save: true, log: true, session,
          type: 'friend_request_spend', reason: '친구 신청(일반)',
          meta: { toUserId: toId }, trace: { by: 'user', actor: String(fromId), source: 'friendRequestSendRouter' },
        });

        walletAfter = result?.remain || {
          heart: fromUserDoc.heart ?? 0, star: fromUserDoc.star ?? 0, ruby: fromUserDoc.ruby ?? 0,
        };

        createdReq = await FriendRequest.create(
          [{ from: fromId, to: toId, message: message || '', status: 'pending' }],
          { session }
        ).then(arr => arr[0]);

        await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }, { session }),
          User.updateOne({ _id: toId },   { $inc: { receivedRequestCountTotal: 1 } }, { session }),
        ]);
      });
    } catch (txErr) {
      if (isReplicaSetTxnError(txErr)) {
        log('TX unsupported, fallback(no-txn) for /friend-request');
        const fromUserDoc = await User.findById(fromId);
        if (!fromUserDoc) throw txErr;

        const result = await points.consumeForNormalRequest(fromUserDoc, {
          save: true, log: true,
          type: 'friend_request_spend', reason: '친구 신청(일반)',
          meta: { toUserId: toId }, trace: { by: 'user', actor: String(fromId), source: 'friendRequestSendRouter-fallback' },
        });

        walletAfter = result?.remain || {
          heart: fromUserDoc.heart ?? 0, star: fromUserDoc.star ?? 0, ruby: fromUserDoc.ruby ?? 0,
        };

        createdReq = await FriendRequest.create({
          from: fromId, to: toId, message: message || '', status: 'pending'
        });

        await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }),
          User.updateOne({ _id: toId },   { $inc: { receivedRequestCountTotal: 1 } }),
        ]);
      } else {
        throw txErr;
      }
    } finally {
      session.endSession();
    }

    // 소켓/푸시(베스트 에포트)
    try {
      const emit = req.app.get('emit');
      if (emit && emit.friendRequestCreated) emit.friendRequestCreated(createdReq);
    } catch (e) { logErr('socket-emit failed', e); }
    try {
      const fromNick = fromUserLean?.nickname || '알 수 없음';
      await sendPushToUser(toId, {
        title: '친구 신청 도착', body: `${fromNick} 님이 친구 신청을 보냈습니다.`,
        type: 'friend_request', fromUserId: fromId, roomId: '',
      });
    } catch (pushErr) { logErr('[push] friend-request failed', pushErr); }

    setWalletHeaders(res, walletAfter);
    log('✅ 친구 신청 완료', { path: req.baseUrl + req.path, fromId, toId, cost: COST.NORMAL_REQUEST });
    return res.json({ ...createdReq.toObject(), wallet: walletAfter });
  } catch (err) {
    if (err?.code === 'POINTS_NOT_ENOUGH') {
      try {
        const me = await User.findById(fromId).select('heart star ruby').lean();
        return res.status(400).json({
          message: '포인트가 부족합니다.', need: COST.NORMAL_REQUEST,
          wallet: me ? { heart: me.heart||0, star: me.star||0, ruby: me.ruby||0 } : null,
        });
      } catch (_) {}
      return res.status(400).json({ message: '포인트가 부족합니다.', need: COST.NORMAL_REQUEST });
    }
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  📬 프리미엄 친구 신청
 * ========================= */
router.post('/friend-request-premium', async (req, res) => {
  const fromId = getMyId(req);
  const { to, message } = req.body || {};
  const toId = String(to || '');
  log('incoming friend-request-premium', { path: req.baseUrl + req.path, fromId, toId });

  try {
    if (!fromId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!toId)   return res.status(400).json({ message: '대상 사용자(to)가 필요합니다.' });
    if (!isValidObjectId(toId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    if (fromId === toId) return res.status(400).json({ message: '자기 자신에게 친구 신청할 수 없습니다' });

    const [fromUserLean, toUser] = await Promise.all([
      User.findById(fromId).select('_id nickname suspended friendlist blocklist').lean(),
      User.findById(toId).select('_id nickname suspended friendlist blocklist').lean()
    ]);
    if (!fromUserLean) return res.status(404).json({ message: '내 사용자 정보를 찾을 수 없습니다.' });
    if (!toUser)       return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' });
    if (fromUserLean.suspended || toUser.suspended) return res.status(403).json({ message: '정지된 계정입니다.' });

    if ((fromUserLean.friendlist || []).some(fid => String(fid) === toId))
      return res.status(400).json({ message: '이미 친구 상태입니다.' });

    const iBlockedHim = (fromUserLean.blocklist || []).some(bid => String(bid) === toId);
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

    const session = await mongoose.startSession();
    let walletAfter = null;
    let createdReq = null;

    try {
      await session.withTransaction(async () => {
        const fromUserDoc = await User.findById(fromId).session(session);
        if (!fromUserDoc) throw new Error('내 사용자 정보를 찾을 수 없습니다.');

        const result = await points.consumeForPremiumRequest(fromUserDoc, {
          save: true, log: true, session,
          type: 'friend_request_spend', reason: '친구 신청(프리미엄)',
          meta: { toUserId: toId }, trace: { by: 'user', actor: String(fromId), source: 'friendRequestSendRouter' },
        });

        walletAfter = result?.remain || {
          heart: fromUserDoc.heart ?? 0, star: fromUserDoc.star ?? 0, ruby: fromUserDoc.ruby ?? 0,
        };

        createdReq = await FriendRequest.create(
          [{ from: fromId, to: toId, message: message || '', status: 'pending' }],
          { session }
        ).then(arr => arr[0]);

        await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }, { session }),
          User.updateOne({ _id: toId },   { $inc: { receivedRequestCountTotal: 1 } }, { session }),
        ]);
      });
    } catch (txErr) {
      if (isReplicaSetTxnError(txErr)) {
        log('TX unsupported, fallback(no-txn) for /friend-request-premium');
        const fromUserDoc = await User.findById(fromId);
        if (!fromUserDoc) throw txErr;

        const result = await points.consumeForPremiumRequest(fromUserDoc, {
          save: true, log: true,
          type: 'friend_request_spend', reason: '친구 신청(프리미엄)',
          meta: { toUserId: toId }, trace: { by: 'user', actor: String(fromId), source: 'friendRequestSendRouter-fallback' },
        });

        walletAfter = result?.remain || {
          heart: fromUserDoc.heart ?? 0, star: fromUserDoc.star ?? 0, ruby: fromUserDoc.ruby ?? 0,
        };

        createdReq = await FriendRequest.create({
          from: fromId, to: toId, message: message || '', status: 'pending'
        });

        await Promise.all([
          User.updateOne({ _id: fromId }, { $inc: { sentRequestCountTotal: 1 } }),
          User.updateOne({ _id: toId },   { $inc: { receivedRequestCountTotal: 1 } }),
        ]);
      } else {
        throw txErr;
      }
    } finally {
      session.endSession();
    }

    try {
      const emit = req.app.get('emit');
      if (emit && emit.friendRequestCreated) emit.friendRequestCreated(createdReq);
    } catch (e) { logErr('socket-emit failed', e); }
    try {
      const fromNick = fromUserLean?.nickname || '알 수 없음';
      await sendPushToUser(toId, {
        title: '친구 신청 도착', body: `${fromNick} 님이 친구 신청을 보냈습니다.`,
        type: 'friend_request', fromUserId: fromId, roomId: '',
      });
    } catch (pushErr) { logErr('[push] friend-request-premium failed', pushErr); }

    setWalletHeaders(res, walletAfter);
    log('✅ 프리미엄 친구 신청 완료', { path: req.baseUrl + req.path, fromId, toId, cost: COST.PREMIUM_REQUEST });
    return res.json({ ...createdReq.toObject(), wallet: walletAfter });
  } catch (err) {
    if (err?.code === 'POINTS_NOT_ENOUGH') {
      try {
        const me = await User.findById(fromId).select('heart star ruby').lean();
        return res.status(400).json({
          message: '포인트가 부족합니다.', need: COST.PREMIUM_REQUEST,
          wallet: me ? { heart: me.heart||0, star: me.star||0, ruby: me.ruby||0 } : null,
        });
      } catch (_) {}
      return res.status(400).json({ message: '포인트가 부족합니다.', need: COST.PREMIUM_REQUEST });
    }
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  📨 신청 취소
 * ========================= */
router.delete('/friend-request/:id', async (req, res) => {
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
