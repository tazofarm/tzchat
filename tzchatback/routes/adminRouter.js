// routes/adminRouter.js
// -----------------------------------------------
// 관리자 전용 API 라우터 (풀세트)
// 권한: requireLogin + requireMaster  (✅ JWT 미들웨어에서 req.user 설정 가정)
// 로그: 접근/성공/에러 로그 상세 출력
// -----------------------------------------------
const express = require('express');
const router = express.Router();

const requireLogin = require('../middlewares/requireLogin');
const requireMaster = require('../middlewares/requireMaster');

const mongoose = require('mongoose');
const os = require('os');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const AppConfig = require('../models/AppConfig');

// ChatRoom/Message 모델은 기존 프로젝트의 것을 사용
let ChatRoom, Message;
try {
  ChatRoom = require('../models/ChatRoom');
  Message = require('../models/Message');
} catch (e) {
  console.warn('[ADMIN] ChatRoom/Message 모델이 프로젝트에 없거나 경로가 다릅니다.');
}

// ⭐ 공용 미들웨어 (JWT 전제)
router.use(requireLogin, requireMaster);

// ✅ JWT 전환: 세션 대신 req.user를 사용하기 위한 헬퍼
function getAdminId(req) {
  // requireLogin 미들웨어에서 JWT 검증 후 req.user에 {_id, role, ...} 세팅되어 있다고 가정
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
    path: `/admin${req.path}`,
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
      path: `/admin${req.path}`,
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

// 1-1. Heartbeat 확장 (서버/버전/업타임/메모리)
router.get('/heartbeat', async (req, res) => {
  try {
    const now = new Date();
    const uptimeSec = process.uptime();
    const mem = process.memoryUsage();
    const adminId = getAdminId(req);

    console.log('[ADMIN] HEARTBEAT', { adminId, at: now.toISOString() });

    res.json({
      ok: true,
      message: '관리자 대시보드 연결 OK',
      serverTime: now.toISOString(),
      version: process.version,             // Node.js 버전
      platform: process.platform,
      uptimeSec,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed },
    });
  } catch (e) {
    console.log('[API][ERR]', { path: '/admin/heartbeat', message: e?.message });
    res.status(500).json({ ok: false, error: 'heartbeat 실패' });
  }
});

// 1-2. DB Ping
router.get('/db-ping', async (req, res) => {
  try {
    const admin = await mongoose.connection.db.admin().ping();
    res.json({ ok: true, result: admin });
  } catch (e) {
    console.error('[ADMIN] db-ping 실패', e);
    res.status(500).json({ ok: false, error: 'DB ping 실패' });
  }
});

// 1-3. 실시간 접속/방 현황 (Socket.IO 공유 자료 이용)
router.get('/online', async (req, res) => {
  try {
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    const roomMembers = req.app.get('roomMembers');

    const rooms = [];
    for (const [roomId, set] of roomMembers.entries()) {
      rooms.push({ roomId, count: set.size });
    }

    res.json({
      ok: true,
      sockets: io?.engine?.clientsCount || 0,
      onlineUsers: Array.from(onlineUsers || []),
      rooms,
    });
  } catch (e) {
    console.error('[ADMIN] online 실패', e);
    res.status(500).json({ ok: false, error: 'online 조회 실패' });
  }
});

// 1-4. 최근 관리자 액션 로그
router.get('/logs', async (req, res) => {
  try {
    const logs = await AdminLog.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ ok: true, logs });
  } catch (e) {
    console.error('[ADMIN] logs 실패', e);
    res.status(500).json({ ok: false, error: 'logs 조회 실패' });
  }
});

// ==============================
// 2) 유저 관리
// ==============================

// 2-1. 유저 목록 + 간단 필터
router.get('/users', async (req, res) => {
  try {
    const { q } = req.query;
    const match = {};
    if (q) {
      const rx = new RegExp(String(q), 'i');
      Object.assign(match, {
        $or: [
          { username: rx },
          { nickname: rx },
          { region1: rx },
          { region2: rx },
          { gender: rx },
          { preference: rx },
        ],
      });
    }
    const users = await User.find(match)
      .select('username nickname birthyear gender region1 region2 preference role suspended createdAt last_login')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ ok: true, users });
  } catch (e) {
    console.error('[ADMIN] users 목록 실패', e);
    res.status(500).json({ ok: false, error: 'users 조회 실패' });
  }
});

// 2-2. 유저 상세
router.get('/users/:id', async (req, res) => {
  try {
    const u = await User.findById(req.params.id)
      .populate('friendlist', 'username nickname')
      .populate('blocklist', 'username nickname')
      .lean();
    if (!u) return res.status(404).json({ ok: false, error: '유저 없음' });
    res.json({ ok: true, user: u });
  } catch (e) {
    console.error('[ADMIN] user 상세 실패', e);
    res.status(500).json({ ok: false, error: 'user 조회 실패' });
  }
});

// 2-3. 권한 변경
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body; // 'master' | 'user'
    if (!['master', 'user'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'role 값이 올바르지 않습니다.' });
    }
    const u = await User.findByIdAndUpdate(req.params.id, { $set: { role } }, { new: true });
    if (!u) return res.status(404).json({ ok: false, error: '유저 없음' });

    await logAdminAction(getAdminId(req), 'setRole', req.params.id, { role });
    res.json({ ok: true, user: u });
  } catch (e) {
    console.error('[ADMIN] set role 실패', e);
    res.status(500).json({ ok: false, error: 'set role 실패' });
  }
});

// 2-4. 계정 잠금/해제
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const { suspended } = req.body; // true/false
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { suspended: !!suspended } },
      { new: true }
    );
    if (!u) return res.status(404).json({ ok: false, error: '유저 없음' });

    await logAdminAction(getAdminId(req), 'suspend', req.params.id, { suspended: !!suspended });
    res.json({ ok: true, user: u });
  } catch (e) {
    console.error('[ADMIN] suspend 실패', e);
    res.status(500).json({ ok: false, error: 'suspend 실패' });
  }
});

// 2-5. 강제 로그아웃 (세션 강제 만료)
//  - JWT 환경에서는 일반적으로 서버측 세션 파기가 아닌 "토큰 블랙리스트" 또는
//    사용자 필드 기반 강제만료 플래그로 처리.
//  - 여기서는 기존 주석을 유지하며 예시 동작만 수행.
router.post('/users/:id/force-logout', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { $set: { suspended: true } });
    await logAdminAction(getAdminId(req), 'forceLogout', req.params.id);
    res.json({
      ok: true,
      message:
        '강제 로그아웃 플래그 설정(예시). 실제 JWT 무효화는 블랙리스트/버전필드/만료 전략 중 택1로 구현 필요.',
    });
  } catch (e) {
    console.error('[ADMIN] force-logout 실패', e);
    res.status(500).json({ ok: false, error: 'force-logout 실패' });
  }
});

// ==============================
// 3) 채팅 관리
// ==============================
router.get('/chatrooms', async (req, res) => {
  try {
    if (!ChatRoom) return res.json({ ok: true, rooms: [] });
    const rooms = await ChatRoom.find({})
      .select('participants messages updatedAt')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    res.json({ ok: true, rooms });
  } catch (e) {
    console.error('[ADMIN] chatrooms 실패', e);
    res.status(500).json({ ok: false, error: 'chatrooms 조회 실패' });
  }
});

router.delete('/chatrooms/:id', async (req, res) => {
  try {
    if (!ChatRoom) return res.status(404).json({ ok: false, error: '모델 없음' });
    await ChatRoom.findByIdAndDelete(req.params.id);
    await logAdminAction(getAdminId(req), 'deleteRoom', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ADMIN] delete room 실패', e);
    res.status(500).json({ ok: false, error: 'delete 실패' });
  }
});

// 특정 유저 메시지 최근 N개 조회
router.get('/users/:id/messages', async (req, res) => {
  try {
    if (!Message) return res.json({ ok: true, messages: [] });
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const msgs = await Message.find({ sender: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ ok: true, messages: msgs });
  } catch (e) {
    console.error('[ADMIN] user messages 실패', e);
    res.status(500).json({ ok: false, error: 'messages 조회 실패' });
  }
});

// ==============================
// 4) 신고 관리
// ==============================
router.get('/reports', async (req, res) => {
  try {
    const list = await Report.find({})
      .populate('reporter', 'username nickname')
      .populate('reported', 'username nickname')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ ok: true, reports: list });
  } catch (e) {
    console.error('[ADMIN] reports 실패', e);
    res.status(500).json({ ok: false, error: 'reports 조회 실패' });
  }
});

router.put('/reports/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // 'open'|'warned'|'blocked'|'dismissed'
    if (!['open', 'warned', 'blocked', 'dismissed'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'status 값이 올바르지 않습니다.' });
    }
    const r = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!r) return res.status(404).json({ ok: false, error: '신고 없음' });

    await logAdminAction(getAdminId(req), 'setReportStatus', req.params.id, { status });
    res.json({ ok: true, report: r });
  } catch (e) {
    console.error('[ADMIN] set report status 실패', e);
    res.status(500).json({ ok: false, error: 'report 상태 변경 실패' });
  }
});

// ==============================
// 5) 공지 관리 (CRUD)
// ==============================
router.get('/notices', async (req, res) => {
  try {
    const list = await Notice.find({}).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, notices: list });
  } catch (e) {
    console.error('[ADMIN] notices 실패', e);
    res.status(500).json({ ok: false, error: 'notices 조회 실패' });
  }
});

router.post('/notices', async (req, res) => {
  try {
    const { title, body, isActive, startsAt, endsAt } = req.body;
    const n = await Notice.create({ title, body, isActive, startsAt, endsAt });
    await logAdminAction(getAdminId(req), 'createNotice', String(n._id));
    res.json({ ok: true, notice: n });
  } catch (e) {
    console.error('[ADMIN] create notice 실패', e);
    res.status(500).json({ ok: false, error: 'notice 생성 실패' });
  }
});

router.put('/notices/:id', async (req, res) => {
  try {
    const { title, body, isActive, startsAt, endsAt } = req.body;
    const n = await Notice.findByIdAndUpdate(
      req.params.id,
      { $set: { title, body, isActive, startsAt, endsAt } },
      { new: true }
    );
    if (!n) return res.status(404).json({ ok: false, error: '공지 없음' });
    await logAdminAction(getAdminId(req), 'updateNotice', req.params.id);
    res.json({ ok: true, notice: n });
  } catch (e) {
    console.error('[ADMIN] update notice 실패', e);
    res.status(500).json({ ok: false, error: 'notice 수정 실패' });
  }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    await logAdminAction(getAdminId(req), 'deleteNotice', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[ADMIN] delete notice 실패', e);
    res.status(500).json({ ok: false, error: 'notice 삭제 실패' });
  }
});

// ==============================
// 6) 통계/리포트
// ==============================
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, todayUsers, emergencyOn] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      User.countDocuments({ 'emergency.isActive': true }),
    ]);

    res.json({
      ok: true,
      stats: {
        totalUsers,
        todayJoin: todayUsers,
        emergencyOn,
      },
    });
  } catch (e) {
    console.error('[ADMIN] stats 실패', e);
    res.status(500).json({ ok: false, error: 'stats 조회 실패' });
  }
});

// ==============================
// 7) 시스템 설정 (환경값 K/V)
// ==============================
router.get('/config', async (req, res) => {
  try {
    const items = await AppConfig.find({}).lean();
    res.json({ ok: true, items });
  } catch (e) {
    console.error('[ADMIN] config 조회 실패', e);
    res.status(500).json({ ok: false, error: 'config 조회 실패' });
  }
});

router.put('/config/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const item = await AppConfig.findOneAndUpdate(
      { key: req.params.key },
      { $set: { value } },
      { new: true, upsert: true }
    );
    await logAdminAction(getAdminId(req), 'setConfig', req.params.key, { value });
    res.json({ ok: true, item });
  } catch (e) {
    console.error('[ADMIN] set config 실패', e);
    res.status(500).json({ ok: false, error: 'config 저장 실패' });
  }
});

module.exports = router;
