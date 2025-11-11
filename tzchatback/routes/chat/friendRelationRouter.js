// routes/chat/friendRelationRouter.js
// base: /api
// ------------------------------------------------------------
// 친구/차단 "관계" 전용 라우터
// - GET    /friends                 : 친구 목록
// - DELETE /friend/:id              : 친구 삭제
// - GET    /blocks                  : 차단 목록
// - PUT    /block/:id               : 일반 차단 생성
// - DELETE /block/:id               : 차단 해제
// - GET    /users/:id               : 유저 프로필(+ isFriend/isBlocked)
// - ✅ 로깅은 req.baseUrl + req.path 기준
// ------------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const { User, FriendRequest } = require('@/models');

const requireLogin = require('@/middlewares/authMiddleware');
const blockIfPendingDeletion = require('@/middlewares/blockIfPendingDeletion');

const router = express.Router();
router.use(requireLogin, blockIfPendingDeletion);

/* ----------------------------- 유틸/로깅 ------------------------------ */
function log(...args) { try { console.log('[friendRelationRouter]', ...args); } catch (_) {} }
function logErr(...args) { try { console.error('[friendRelationRouter][ERR]', ...args); } catch (_) {} }

function getMyId(req) {
  const jwtId = req?.user?._id;
  const sessId = req?.session?.user?._id;
  return (jwtId && String(jwtId)) || (sessId && String(sessId)) || '';
}
const USER_MIN_FIELDS = 'username nickname birthyear gender';

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
 *  👥 친구 리스트 조회
 * ========================= */
router.get('/friends', async (req, res) => {
  try {
    const me = getMyId(req);
    if (!me) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const user = await User.findById(me).populate('friendlist', USER_MIN_FIELDS);
    res.json(user?.friendlist || []);
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  🗑️ 친구 삭제
 * ========================= */
router.delete('/friend/:id', async (req, res) => {
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
      User.updateOne({ _id: myObjId },    { $pull: { friendlist: targetObjId } }),
      User.updateOne({ _id: targetObjId },{ $pull: { friendlist: myObjId } }),
    ]);

    log('🗑️ 친구 삭제', { path: req.baseUrl + req.path, myId, targetId, modifiedA: r1.modifiedCount || 0, modifiedB: r2.modifiedCount || 0 });
    return res.json({ ok: true, modifiedA: r1.modifiedCount || 0, modifiedB: r2.modifiedCount || 0 });
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  🚫 차단 목록
 * ========================= */
router.get('/blocks', async (req, res) => {
  try {
    const me = getMyId(req);
    if (!me) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const user = await User.findById(me).populate('blocklist', USER_MIN_FIELDS);
    res.json(user?.blocklist || []);
  } catch (err) {
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  🚫 일반 차단 생성
 * ========================= */
router.put('/block/:id', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const targetId = String(req.params.id);

    log('incoming block', { path: req.baseUrl + req.path, myId, targetId });

    if (!isValidObjectId(targetId)) return res.status(400).json({ message: '유효하지 않은 사용자 ID입니다.' });
    if (myId === targetId) return res.status(400).json({ message: '자기 자신을 차단할 수 없습니다.' });

    const myObjId = new mongoose.Types.ObjectId(myId);
    const targetObjId = new mongoose.Types.ObjectId(targetId);

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
      path: req.baseUrl + req.path, myId, targetId,
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    return res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  🔓 차단 해제
 * ========================= */
router.delete('/block/:id', async (req, res) => {
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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

/* =========================
 *  👤 유저 프로필(+ 여부)
 * ========================= */
router.get('/users/:id', async (req, res) => {
  try {
    const myId = getMyId(req);
    if (!myId) return res.status(401).json({ message: '로그인이 필요합니다.' });

    const targetId = String(req.params.id);

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
    logErr('[API][ERR]', { path: req.baseUrl + req.path, name: err?.name, message: err?.message });
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
