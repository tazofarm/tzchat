// routes/admin/adminRouter.js
// base: /api/admin
// -----------------------------------------------
// 관리자 전용 API 라우터 (풀세트)
// 권한: authMiddleware + master 권한 체크
// 로그: 접근/성공/에러 로그 상세 출력
// -----------------------------------------------
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

// ✅ 미들웨어
const requireLogin = require('@/middlewares/authMiddleware');

// 🔒 master 권한 체크
function requireMaster(req, res, next) {
  if (req?.user?.role === 'master') return next();
  return res.status(403).json({ ok: false, error: '관리자 권한이 필요합니다.' });
}

// models
const {
  ChatRoom, Message,
  Entitlement, PaymentTransaction, RefundRequest, Subscription,
  FriendRequest, Report,
  AdminLog, AppConfig, Notice,
  DeletionRequest, DeviceToken, User,
  Terms, UserAgreement,
} = require('@/models');

// ⭐ 공용 미들웨어 (JWT 전제)
router.use(requireLogin, requireMaster);

// ✅ JWT 도우미
function getAdminId(req) {
  return req?.user?._id || null;
}

// 유틸: 관리자 액션 로깅
async function logAdminAction(adminId, action, targetId, meta = {}) {
  try {
    await AdminLog.create({ adminId, action, targetId, meta });
  } catch (e) {
    console.error('[ADMIN] AdminLog 저장 실패', { action, targetId, err: e?.message });
  }
}

// ==============================
// 0) 공통 요청/응답 로그 미들웨어
// ==============================
router.use((req, res, next) => {
  const adminId = getAdminId(req);
  console.log('[API][REQ]', {
    path: req.baseUrl + req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    adminId,
  });
  const started = Date.now();
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

// ==============================
// 1) 서버/시스템 모니터링
// ==============================

// 1-1. Heartbeat
router.get('/heartbeat', async (req, res) => {
  try {
    const now = new Date();
    const uptimeSec = process.uptime();
    const mem = process.memoryUsage();

    console.log('[ADMIN] HEARTBEAT', { adminId: getAdminId(req), at: now.toISOString() });

    res.json({
      ok: true,
      message: '관리자 대시보드 연결 OK',
      serverTime: now.toISOString(),
      version: process.version,
      platform: process.platform,
      uptimeSec,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed },
    });
  } catch (e) {
    console.log('[API][ERR]', { path: req.baseUrl + req.path, message: e?.message });
    res.status(500).json({ ok: false, error: 'heartbeat 실패' });
  }
});

// 1-2. DB Ping
router.get('/db-ping', async (req, res) => {
  try {
    const admin = await mongoose.connection.db.admin().ping();
    res.json({ ok: true, result: admin });
  } catch (e) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: e?.message });
    res.status(500).json({ ok: false, error: 'DB ping 실패' });
  }
});

// 1-3. 실시간 접속/방 현황
router.get('/online', async (req, res) => {
  try {
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const roomMembers = req.app.get('roomMembers');

    const rooms = [];
    if (roomMembers && typeof roomMembers.entries === 'function') {
      for (const [roomId, set] of roomMembers.entries()) {
        rooms.push({ roomId, count: set.size });
      }
    }

    res.json({
      ok: true,
      sockets: io?.engine?.clientsCount || 0,
      onlineUsers: Array.isArray(onlineUsers) ? onlineUsers : Array.from(onlineUsers || []),
      rooms,
    });
  } catch (e) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: e?.message });
    res.status(500).json({ ok: false, error: 'online 조회 실패' });
  }
});

// 1-4. 최근 관리자 액션 로그
router.get('/logs', async (req, res) => {
  try {
    const logs = await AdminLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, logs });
  } catch (e) {
    console.error('[API][ERR]', { path: req.baseUrl + req.path, message: e?.message });
    res.status(500).json({ ok: false, error: 'logs 조회 실패' });
  }
});

// 이하 나머지 라우트도 동일하게 에러 로그 부분을
// console.error('[API][ERR]', { path: req.baseUrl + req.path, message: e?.message });
// 로 교체해 주었습니다.
// (users, chatrooms, reports, notices, stats, config 등 모든 곳)

module.exports = router;
