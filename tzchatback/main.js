// main.js
// 🌐 Express 기반 tzchat 서버 초기화 (Socket.IO 포함 + ✅ JWT 병행 지원)
// - 기존 세션(session) 기반은 그대로 유지(호환성)
// - 추가: JWT(Bearer) 파싱/검증 미들웨어 + Socket.IO 토큰 인증
// - 웹/앱(웹뷰/네이티브) 공용 사용 목적
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app); // ✅ socket.io를 위한 서버 래핑
const path = require('path');          // 파일 경로 관련 내장 모듈
const fs = require('fs');              // ✅ public/pubblic 자동 감지용

app.disable('x-powered-by'); // 소소한 보안 헤더

// ✅ 환경변수(포트/DB/시크릿) — 없으면 기존 기본값 유지
const PORT = Number(process.env.PORT || 2000);
const HOST = process.env.HOST || '0.0.0.0';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tzchat';
const SESSION_SECRET = process.env.SESSION_SECRET || 'tzchatsecret';
// 🔐 JWT 비밀키(신규) — 세션과 병행 사용
const JWT_SECRET = process.env.JWT_SECRET || 'tzchatjwtsecret';

// ⚠️ (신규) 라우터 로딩 에러를 잡아 친절하게 안내하는 헬퍼
function safeMountRouter(mountPath, modulePath, exact = true) {
  try {
    if (exact && !mountPath.startsWith('/')) {
      console.warn(`⚠️ 라우터 마운트 경로는 "/"로 시작해야 합니다. 자동 보정: ${mountPath} → /${mountPath}`);
      mountPath = `/${mountPath}`;
    }
    const router = require(modulePath);
    app.use(mountPath, router);
    console.log(`📡 ${mountPath} → ${modulePath} 등록 완료`);
  } catch (e) {
    console.error(`❌ 라우터 로드 실패: mount="${mountPath}" module="${modulePath}"`);
    console.error(e);
    const msg = String(e?.message || '');
    if (msg.includes('path-to-regexp')) {
      console.error('🧭 힌트: 라우트 경로에 전체 URL(https://...) 또는 잘못된 파라미터 패턴이 있을 수 있어요.');
      console.error('    - OK: router.get("/login", ...), app.use("/api", router)');
      console.error('    - NG: router.get("https://tzchat.tazocode.com/api/login", ...), app.use("https://...", router)');
      console.error('    - NG: "/api/:" 또는 "/user/:?name" (파라미터 이름 필수)');
    }
    process.exit(1);
  }
}

// ⚠️ (신규) 채팅방 참여자 조회용 모델 로드
const ChatRoom = require('./models/ChatRoom');

// =======================================
// 0) 파서 & 정적 경로 & 기본 로깅
// =======================================

// ✅ JSON 파서 등록 (imageUrl 전달용)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('📦 JSON 및 URL-Encoded 파서 활성화');

/**
 * ✅ /public 정적 파일 서빙
 * - privacy.html 등 정적 페이지 직접 서빙.
 * - "pubblic" 오타 폴더 존재 시 자동 감지.
 */
let publicBase = 'public';
if (!fs.existsSync(path.join(__dirname, 'public')) && fs.existsSync(path.join(__dirname, 'pubblic'))) {
  publicBase = 'pubblic';
  console.warn('⚠️ "public" 폴더가 없어 "pubblic" 폴더를 사용합니다. (권장: 폴더명을 public로 통일)');
}
const publicDir = path.join(__dirname, publicBase);
app.use(express.static(publicDir));
console.log('🗂️  /public 정적 서빙 활성화:', publicDir);

/**
 * ✅ (유지) /privacy → /public/privacy.html
 */
app.get('/privacy', (req, res) => {
  console.log(`[ROUTE] GET /privacy  ua=${req.get('user-agent')} ip=${req.ip}`);
  res.sendFile(path.join(publicDir, 'privacy.html'));
});

// ✅ 사진 업로드 정적 경로
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('🖼️ /uploads 정적 파일 경로 설정');

// ✅ 요청 로그 및 Private-Network 헤더
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  console.log(`📥 [요청] ${req.method} ${req.url}`);
  next();
});

// =======================================
// CORS (라우터/세션 이전에 설정)
// =======================================
const cors = require('cors');

// ★ 운영/원격-dev 허용 오리진
const allowedOriginsList = [
  'https://tzchat.tazocode.com', // 배포/원격-dev 공용
  'http://localhost',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8100',
  'http://127.0.0.1:8100',
  'http://192.168.0.7:8081',
  'capacitor://localhost',
  'ionic://localhost',
  // ✅ Capacitor https-scheme & 로컬 https 테스트 허용
  'https://localhost',
  'https://127.0.0.1',
];

// 사설망 오리진 정규식 허용 (http/https 모두)
const dynamicOriginAllow = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/i,
];

// 디버그: 요청마다 오리진/경로 출력
app.use((req, res, next) => {
  console.log('[CORS-DBG] Origin=', req.headers.origin, '| Path=', req.method, req.path);
  next();
});

// 🔧 앱(WebView)에서 file:// 또는 일부 환경은 Origin 헤더가 'null'로 옵니다.
// credentials 요청에서는 명시적으로 'null'을 ACAO로 돌려줘야 합니다.
const ALLOW_NULL_ORIGIN = true;

const corsOptions = {
  origin: (origin, cb) => {
    // 내부 호출(서버-서버) 등 Origin이 없으면 허용
    if (!origin) {
      console.log('[CORS-CHECK] (no-origin) => ALLOW');
      return cb(null, true);
    }
    // 'null' 오리진 허용(옵션)
    if (origin === 'null' && ALLOW_NULL_ORIGIN) {
      console.log('[CORS-CHECK] null => ALLOW(explicit)');
      // cors 패키지가 헤더를 'null'로 세팅하도록 문자열 그대로 허용
      return cb(null, true);
    }
    if (allowedOriginsList.includes(origin)) {
      console.log('[CORS-CHECK]', origin, '=> ALLOW(list)');
      return cb(null, true);
    }
    if (dynamicOriginAllow.some((re) => re.test(origin))) {
      console.log('[CORS-CHECK]', origin, '=> ALLOW(regex)');
      return cb(null, true);
    }
    console.log('[CORS-CHECK]', origin, '=> BLOCK');
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true, // ⭐ withCredentials 쿠키 허용(세션 호환), JWT는 Authorization 헤더 사용
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // ✅ JWT 헤더 허용
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600, // 프리플라이트 캐시
  optionsSuccessStatus: 204,
};

app.use((req, res, next) => {
  // 오리진별 캐시 안전
  res.setHeader('Vary', 'Origin');
  next();
});

app.use(cors(corsOptions));

// Express v5: 정규식으로 OPTIONS 허용 + 로그
app.options(/.*/, (req, res, next) => {
  console.log('[CORS-OPTIONS] Preflight for', req.headers.origin || '(no-origin)', req.path);
  next();
}, cors(corsOptions), (req, res) => {
  res.sendStatus(204);
});

console.log('🛡️  CORS 허용(고정):', allowedOriginsList.join(', '));
console.log('🛡️  CORS 허용(동적-사설망/에뮬레이터):', dynamicOriginAllow.map((r) => r.toString()).join(', '));
console.log('🛡️  CORS 특수: Origin:null 허용 =', ALLOW_NULL_ORIGIN);

// =======================================
/**
 * 운영/개발 모드 판단 (쿠키/보안 설정에 사용)
 * - dev:remote(로컬 FE → HTTPS BE)에서도 쿠키는 Secure+None 이어야 하므로
 *   "원격 HTTPS 백엔드"에 맞춰 secure 모드로 취급
 */
// =======================================
const isProd = process.env.NODE_ENV === 'production' || process.env.USE_TLS === '1';
const isCapAppMode = process.env.APP_MODE === 'capacitor' || process.env.FORCE_MOBILE_SESSION === '1';
console.log('🧭 실행 모드:', isProd ? 'PROD(HTTPS 프록시 뒤)' : 'DEV', '| 앱세션강제:', isCapAppMode);

// =======================================
// 1) DB, 세션 설정 (유지) + ✅ JWT 파서(신규)
// =======================================
const mongoose = require('mongoose');
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공:', MONGO_URI))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// ✅ 프록시 신뢰 (HTTPS 리버스 프록시 뒤에서 Secure 쿠키 인식)
app.set('trust proxy', 1); // ★ 반드시 세션 미들웨어 이전

// ✅ 세션 설정 (connect-mongo) — 기존 세션 의존 라우터 호환용
const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionStore = MongoStore.create({
  mongoUrl: MONGO_URI,
  ttl: 60 * 60 * 24, // 1일
});

// 🍪 쿠키 정책
const cookieForProd = {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24,
  sameSite: 'none', // ★ 크로스사이트 쿠키
  secure: true,     // ★ HTTPS 필수
  path: '/',
};
const cookieForDevWeb = {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24,
  sameSite: 'lax',
  secure: false,
  path: '/',
};

// dev:remote(프론트 localhost:8081 → 백 https://tzchat.tazocode.com) 시
// 백엔드는 HTTPS이므로 secure 쿠키가 필요함 → isSecureMode = true 취급
const FORCE_SECURE_COOKIE = true; // ← dev-remote에서도 무조건 Secure+None
const isSecureMode = FORCE_SECURE_COOKIE || isProd || isCapAppMode;
const cookieConfig = isSecureMode ? cookieForProd : cookieForDevWeb;

if (isSecureMode && process.env.API_BASE_URL && !process.env.API_BASE_URL.startsWith('https://')) {
  console.warn('⚠️ Secure 쿠키 모드인데 API_BASE_URL이 HTTPS가 아닙니다:', process.env.API_BASE_URL);
}

const sessionMiddleware = session({
  name: 'tzchat.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: cookieConfig,
});

// 요청 단위 쿠키정책 로그 + 프록시 프로토콜 점검
app.use((req, res, next) => {
  const origin = req.headers.origin || '(no-origin)';
  const xfProto = req.headers['x-forwarded-proto'] || '(none)';
  console.log('🍪 [SessionCookiePolicy] origin=', origin, '| sameSite=', cookieConfig.sameSite, '| secure=', cookieConfig.secure, '| xfp=', xfProto);
  if (cookieConfig.secure === true && xfProto !== 'https') {
    console.warn('⚠️ secure 쿠키 모드인데 X-Forwarded-Proto !== https 입니다. Nginx proxy_set_header X-Forwarded-Proto $scheme; 확인 필요');
  }
  next();
});

app.use(sessionMiddleware);
app.set('sessionStore', sessionStore);
console.log('🔐 세션 설정 완료:', cookieConfig);

// ---------------------------------------
// ✅ JWT 파서/검증 미들웨어 (신규, 비파괴)
// - Authorization: Bearer <token> 또는 ?token=, X-Auth-Token 지원
// - 유효하면 req.user 설정(세션보다 우선 사용 가능)
// - 라우터들은 점진적 전환: req.user || req.session.user
// ---------------------------------------
const jwt = require('jsonwebtoken');

function extractToken(req) {
  // Authorization 헤더
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();

  // 대안 헤더
  const xToken = req.headers['x-auth-token'];
  if (xToken) return String(xToken).trim();

  // 쿼리 토큰(소켓 핸드셰이크 재활용)
  if (req.query && req.query.token) return String(req.query.token).trim();

  return null;
}

app.use((req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    console.log('[AUTH][JWT][MISS]', { path: req.path });
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // 민감 정보 마스킹하여 로그
    console.log('[AUTH][JWT][OK]', { sub: payload.sub || payload._id || '(none)', path: req.path });
    // 표준화된 형태로 저장
    req.user = {
      _id: payload._id || payload.sub || null,
      username: payload.username || null,
      nickname: payload.nickname || null,
      roles: payload.roles || [],
      // 필요 시 추가 클레임
    };
    req.auth = { type: 'jwt', tokenMasked: token.slice(0, 8) + '***' };
  } catch (err) {
    console.log('[AUTH][ERR]', { step: 'jwt.verify', code: err.name, message: err.message });
    // JWT 실패해도 세션 경로로 계속 진행(호환)
  }
  next();
});

// 디버그 라우트
app.get('/debug/echo', (req, res) => {
  console.log('🔎 /debug/echo cookies =', req.headers.cookie || '(none)');
  res.json({
    ok: true,
    gotCookieHeader: !!req.headers.cookie,
    cookieHeader: req.headers.cookie || null
  });
});

app.get('/debug/session', (req, res) => {
  console.log('🔎 /debug/session sessionID =', req.sessionID, ' user =', req.session?.user || null, ' jwtUser =', req.user || null);
  res.json({
    ok: true,
    sessionID: req.sessionID,
    sessionUser: req.session?.user || null,
    jwtUser: req.user || null
  });
});

// 🧪 쿠키 저장 테스트용: 앱(WebView)에서 Set-Cookie 수신/저장 확인
app.get('/debug/set-cookie', (req, res) => {
  const value = Date.now().toString(36);
  res.cookie('tzchat_test', value, {
    httpOnly: true,
    sameSite: cookieConfig.sameSite,
    secure: cookieConfig.secure,
    path: '/',
  });
  console.log('🔎 /debug/set-cookie -> Set-Cookie: tzchat_test=', value);
  res.json({ ok: true, set: true, value });
});

// =======================================
// 2) 라우터 등록 (safeMountRouter)
// =======================================
safeMountRouter('/api', './routes/userRouter');
safeMountRouter('/api', './routes/authRouter');
safeMountRouter('/api', './routes/targetRouter');
safeMountRouter('/api', './routes/friendRouter');
safeMountRouter('/api', './routes/chatRouter');
safeMountRouter('/api/push', './routes/pushRouter'); // 별도 prefix
safeMountRouter('/api', './routes/supportRouter');   // 공개 라우터
safeMountRouter('/api/admin', './routes/adminRouter');

// =======================================
// 3) Socket.IO 설정 (+온라인유저/방현황 트래킹)
//    ✅ JWT 인증 병행: handshake.auth.token / headers.authorization
// =======================================
const { Server } = require('socket.io');
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin === 'null' && ALLOW_NULL_ORIGIN) return cb(null, true);
      if (allowedOriginsList.includes(origin)) return cb(null, true);
      if (dynamicOriginAllow.some((re) => re.test(origin))) return cb(null, true);
      return cb(new Error('Socket.IO CORS blocked'));
    },
    credentials: true,
  },
});
console.log('🔌 Socket.IO 경로(/socket.io) 및 CORS 적용');

// ✅ 세션 공유(유지) — 기존 세션 방식과 병행
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ✅ JWT 인증(신규)
// - 우선 JWT 검사 → 실패해도 세션이 있으면 세션으로 진행
io.use((socket, next) => {
  try {
    const h = socket.handshake || {};
    const headers = h.headers || {};
    const auth = headers['authorization'] || '';
    let token = null;

    if (h.auth && h.auth.token) token = String(h.auth.token);
    else if (auth.startsWith('Bearer ')) token = auth.slice(7).trim();
    else if (h.query && h.query.token) token = String(h.query.token);

    if (!token) {
      console.log('[SOCKET][AUTH][JWT][MISS]', { sid: socket.id });
      return next(); // 세션으로 계속
    }

    const payload = require('jsonwebtoken').verify(token, JWT_SECRET);
    // socket.user: 라우팅/방조인 로직에서 사용 가능
    socket.user = {
      _id: payload._id || payload.sub || null,
      username: payload.username || null,
      nickname: payload.nickname || null,
      roles: payload.roles || [],
    };
    console.log('[SOCKET][AUTH][JWT][OK]', { sid: socket.id, sub: socket.user._id });
    return next();
  } catch (err) {
    console.log('[SOCKET][AUTH][ERR]', { step: 'jwt.verify', code: err.name, message: err.message });
    // JWT 실패 시 세션만으로도 입장 가능(호환)
    return next();
  }
});

// ✅ 온라인 유저/방 현황
const onlineUsers = new Set();
const roomMembers = new Map();
const userRoom = (userId) => `user:${userId}`;

app.set('io', io);
app.set('onlineUsers', onlineUsers);
app.set('roomMembers', roomMembers);

// ✅ 채팅 리스트/TopMenu 갱신 헬퍼
async function notifyRoomParticipantsForList(roomId, lastMessagePayload) {
  try {
    const room = await ChatRoom.findById(roomId).select('participants').lean();
    const ids = room?.participants?.map((id) => String(id)) || [];
    ids.forEach((pid) => {
      io.to(userRoom(pid)).emit('chatrooms:badge', { changedRoomId: roomId });
      io.to(userRoom(pid)).emit('chatrooms:updated', {
        changedRoomId: roomId,
        lastMessage: lastMessagePayload || null,
      });
    });
    console.log(`[notifyRoomParticipantsForList] room=${roomId} -> users=${ids.join(',')}`);
  } catch (err) {
    console.error('[notifyRoomParticipantsForList] ❌', err);
  }
}
async function notifyRoomParticipantsBadgeOnly(roomId) {
  try {
    const room = await ChatRoom.findById(roomId).select('participants').lean();
    const ids = room?.participants?.map((id) => String(id)) || [];
    ids.forEach((pid) => {
      io.to(userRoom(pid)).emit('chatrooms:badge', { changedRoomId: roomId });
    });
    console.log(`[notifyRoomParticipantsBadgeOnly] room=${roomId} -> users=${ids.join(',')}`);
  } catch (err) {
    console.error('[notifyRoomParticipantsBadgeOnly] ❌', err);
  }
}

// ✅ 라우터에서 편하게 쏘도록 헬퍼 제공
app.set('emit', {
  toUser(userId, event, payload) {
    if (!userId) return;
    io.to(userRoom(userId)).emit(event, payload);
  },
  friendRequestCreated(reqObj) {
    const fromId = typeof reqObj.from === 'object' ? reqObj.from._id : reqObj.from;
    const toId = typeof reqObj.to === 'object' ? reqObj.to._id : reqObj.to;
    if (fromId) io.to(userRoom(fromId)).emit('friendRequest:created', reqObj);
    if (toId) io.to(userRoom(toId)).emit('friendRequest:created', reqObj);
  },
  friendRequestAccepted(reqObj) {
    const fromId = typeof reqObj.from === 'object' ? reqObj.from._id : reqObj.from;
    const toId = typeof reqObj.to === 'object' ? reqObj.to._id : reqObj.to;
    if (fromId) io.to(userRoom(fromId)).emit('friendRequest:accepted', reqObj);
    if (toId) io.to(userRoom(toId)).emit('friendRequest:accepted', reqObj);
  },
  friendRequestRejected(reqObj) {
    const fromId = typeof reqObj.from === 'object' ? reqObj.from._id : reqObj.from;
    const toId = typeof reqObj.to === 'object' ? reqObj.to._id : reqObj.to;
    if (fromId) io.to(userRoom(fromId)).emit('friendRequest:rejected', reqObj);
    if (toId) io.to(userRoom(toId)).emit('friendRequest:rejected', reqObj);
  },
  friendRequestCancelled(reqObj) {
    const fromId = typeof reqObj.from === 'object' ? reqObj.from._id : reqObj.from;
    const toId = typeof reqObj.to === 'object' ? reqObj.to._id : reqObj.to;
    if (fromId) io.to(userRoom(fromId)).emit('friendRequest:cancelled', reqObj);
    if (toId) io.to(userRoom(toId)).emit('friendRequest:cancelled', reqObj);
  },
  blockCreated(blockObj) {
    const { blockerId, blockedId } = blockObj || {};
    if (blockerId) io.to(userRoom(blockerId)).emit('block:created', blockObj);
    if (blockedId) io.to(userRoom(blockedId)).emit('block:created', blockObj);
  },
  async chatMessageNew(roomId, message) {
    try {
      io.to(roomId).emit('chatMessage', message);
      await notifyRoomParticipantsForList(roomId, {
        _id: message?._id,
        content: message?.content || '',
        imageUrl: message?.imageUrl || '',
        sender: message?.sender || null,
        createdAt: message?.createdAt || new Date(),
      });
      console.log('[emit.chatMessageNew] ✅ room=', roomId);
    } catch (err) {
      console.error('[emit.chatMessageNew] ❌', err);
    }
  },
  async chatMessagesRead(roomId, readerId, messageIds) {
    try {
      io.to(roomId).emit('messagesRead', { roomId, readerId, messageIds });
      await notifyRoomParticipantsBadgeOnly(roomId);
      console.log('[emit.chatMessagesRead] ✅ room=', roomId, 'count=', messageIds?.length || 0);
    } catch (err) {
      console.error('[emit.chatMessagesRead] ❌', err);
    }
  },
});

io.on('connection', (socket) => {
  try {
    // ✅ JWT 우선 → 없으면 세션
    const jwtUserId = socket.user?._id ? String(socket.user._id) : null;
    const session = socket.request.session;
    const sessUserId = session?.user?._id ? String(session.user._id) : null;
    const userId = jwtUserId || sessUserId || null;

    console.log('[SOCKET][CONN]', { sid: socket.id, userId: userId || '(anon)', via: jwtUserId ? 'jwt' : (sessUserId ? 'session' : 'anonymous') });

    if (userId) {
      onlineUsers.add(userId);
      socket.join(userRoom(userId));
      console.log(`👤 자동 개인룸 조인: ${userRoom(userId)}`);
    }

    socket.on('join', (payload = {}) => {
      try {
        const uid = String(payload.userId || userId || '');
        if (!uid) return;
        socket.join(userRoom(uid));
        console.log(`[SOCKET][MSG] join`, { roomId: userRoom(uid), from: uid, type: 'personal' });
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'join', message: err.message });
      }
    });

    socket.on('joinRoom', (roomId) => {
      try {
        socket.join(roomId);
        console.log(`[SOCKET][MSG] joinRoom`, { roomId, from: userId || '(anon)', type: 'chatroom' });
        if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
        if (userId) roomMembers.get(roomId).add(userId);
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'joinRoom', message: err.message });
      }
    });

    socket.on('leaveRoom', (roomId) => {
      try {
        socket.leave(roomId);
        console.log(`[SOCKET][MSG] leaveRoom`, { roomId, from: userId || '(anon)' });
        if (roomMembers.has(roomId) && userId) {
          roomMembers.get(roomId).delete(userId);
        }
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'leaveRoom', message: err.message });
      }
    });

    // ⚠️ 프론트에서 POST로 메시지 저장 후 emit
    socket.on('chatMessage', async ({ roomId, message }) => {
      try {
        console.log(`[SOCKET][MSG] chatMessage`, { roomId, from: userId || '(anon)', type: message?.imageUrl ? 'image' : 'text' });
        io.to(roomId).emit('chatMessage', message);
        await notifyRoomParticipantsForList(roomId, {
          _id: message?._id,
          content: message?.content || '',
          imageUrl: message?.imageUrl || '',
          sender: message?.sender || null,
          createdAt: message?.createdAt || new Date(),
        });
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'chatMessage', message: err.message });
      }
    });

    // ✅ 읽음 처리 브로드캐스트
    socket.on('messagesRead', async (payload = {}) => {
      try {
        const { roomId, readerId, messageIds } = payload;
        console.log(`[SOCKET][MSG] messagesRead`, { roomId, from: readerId, count: messageIds?.length || 0 });
        socket.to(roomId).emit('messagesRead', { roomId, readerId, messageIds });
        await notifyRoomParticipantsBadgeOnly(roomId);
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'messagesRead', message: err.message });
      }
    });

    socket.on('disconnect', () => {
      try {
        console.log(`[SOCKET][DISC]`, { sid: socket.id });
        if (userId) {
          onlineUsers.delete(userId);
          for (const set of roomMembers.values()) set.delete(userId);
        }
      } catch (err) {
        console.log('[SOCKET][ERR]', { step: 'disconnect', message: err.message });
      }
    });
  } catch (err) {
    console.error('❌ 소켓 connection 핸들러 오류:', err);
  }
});

// =======================================
// 5) 서버 실행 + 프로세스 레벨 에러 로그
// =======================================
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`🚀 서버 실행 중: http://${addr.address}:${addr.port}`);
  console.log(`🔭 휴대폰 테스트 예시: http://192.168.0.7:${PORT}`);
  if (isSecureMode) {
    console.log('🔒 SameSite=None + Secure 쿠키 사용중(세션 호환) + JWT 병행 → HTTPS(프록시) 권장.');
    console.log('   Nginx 설정에 proxy_set_header X-Forwarded-Proto $scheme; 가 필요합니다.');
  } else {
    console.log('🧪 DEV 모드: sameSite=lax, secure=false 쿠키 / 로컬 개발 오리진 허용');
  }
  console.log('[AUTH] JWT 사용 준비 완료. 라우터는 req.user(JWT) → 없으면 req.session.user 순으로 참조 권장.');
});
