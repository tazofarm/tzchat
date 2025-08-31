// main.js
// 🌐 Express 기반 tzchat 서버 초기화 (Socket.IO 포함)
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app); // ✅ socket.io를 위한 서버 래핑
const path = require('path'); // 파일 경로 관련 내장 모듈

// ✅ 환경변수(포트/DB/시크릿) — 없으면 기존 기본값 유지
const PORT = Number(process.env.PORT || 2000);
const HOST = process.env.HOST || '0.0.0.0';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tzchat';
const SESSION_SECRET = process.env.SESSION_SECRET || 'tzchatsecret';

// ⚠️ (신규) 채팅방 참여자 조회용 모델 로드
const ChatRoom = require('./models/ChatRoom');

// =======================================
// 0) 파서 & 정적 경로 & 기본 로깅/CORS
// =======================================

// ✅ JSON 파서 등록 (imageUrl 전달용)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('📦 JSON 및 URL-Encoded 파서 활성화');

/**
 * ✅ /public 정적 파일 서빙
 * - privacy.html 등 정적 페이지를 직접 서빙합니다.
 * - 결과적으로 /privacy.html 로도 접근 가능 → Play Console URL로 쓰기 좋음
 */
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
console.log('🗂️  /public 정적 서빙 활성화:', publicDir);

/**
 * ✅ (유지) /privacy → /public/privacy.html 로 연결 (짧은 경로 지원 + 접근 로그)
 */
app.get('/privacy', (req, res) => {
  console.log(`[ROUTE] GET /privacy  ua=${req.get('user-agent')} ip=${req.ip}`);
  res.sendFile(path.join(publicDir, 'privacy.html'));
});

// ✅ 사진 업로드된 파일 접근용 정적 경로
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('🖼️ /uploads 정적 파일 경로 설정');

// ✅ 요청 로그 및 PNA 헤더 설정
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  console.log(`📥 [요청] ${req.method} ${req.url}`);
  next();
});

// ★★★★★ 운영/개발 모드 판단 (쿠키/보안 설정에 사용)
const isProd = process.env.NODE_ENV === 'production' || process.env.USE_TLS === '1';
const isCapAppMode = process.env.APP_MODE === 'capacitor' || process.env.FORCE_MOBILE_SESSION === '1';
console.log('🧭 실행 모드:', isProd ? 'PROD(HTTPS 프록시 뒤)' : 'DEV', '| 앱세션강제:', isCapAppMode);

// ✅ CORS 설정
const cors = require('cors');

// ★ 운영: HTTPS 오리진 허용, 개발: 로컬 오리진 허용 + 앱(WebView, Capacitor) 허용
const allowedOrigins = [
  'http://localhost:8081',
  'http://192.168.0.7:8081',
  'capacitor://localhost',       // ✅ 앱(WebView) 오리진
  'https://tzchat.duckdns.org',  // ✅ 운영 오리진(HTTPS)
];

// 디버그: 요청마다 오리진/경로 출력
app.use((req, res, next) => {
  console.log('[CORS-DBG] Origin=', req.headers.origin, '| Path=', req.method, req.path);
  next();
});

const corsOptions = {
  origin: (origin, cb) => {
    // 모바일 앱/webview 등 Origin 없을 수도 있으니 허용
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.includes(origin);
    console.log('[CORS-CHECK]', origin, '=>', ok ? 'ALLOW' : 'BLOCK');
    return cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // ✅ 프리플라이트 캐시(선택)
  maxAge: 600,
};
app.use(cors(corsOptions));
console.log('🛡️  CORS 허용 오리진:', allowedOrigins.join(', '));

// ✅ 헬스체크
app.get('/api/ping', (req, res) => {
  console.log('🩺 /api/ping', {
    ip: req.ip,
    origin: req.headers.origin,
    ua: req.headers['user-agent'],
    cookie: req.headers.cookie ? '(present)' : '(none)',
  });
  res.json({ ok: true, at: new Date().toISOString() });
});

// =======================================
// 1) DB, 세션 설정
// =======================================

// ✅ MongoDB 연결
const mongoose = require('mongoose');
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB 연결 성공:', MONGO_URI))
  .catch((err) => console.error('❌ MongoDB 연결 실패:', err));

// ✅ 프록시 신뢰 (HTTPS 리버스 프록시 뒤에서 secure 쿠키 인식)
// ★ 중요: 이 설정이 있어야 sameSite:'none', secure:true 쿠키가 정상 동작
app.set('trust proxy', 1);

// ✅ 세션 설정 (connect-mongo)
const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionStore = MongoStore.create({
  mongoUrl: MONGO_URI,
  ttl: 60 * 60 * 24, // 1일(초 단위)
});

// ————————————————————————————————————————————————
// 🍪 쿠키 정책 설명
// - 웹(동일 오리진 또는 Lax로도 되는 상황): sameSite:'lax', secure:false (DEV)
// - 앱(Capacitor WebView = capacitor://localhost ⇒ 크로스사이트):
//   반드시 sameSite:'none' + secure:true + HTTPS 로 접근해야 쿠키가 실림.
// - 이를 위해 APP_MODE=capacitor 또는 FORCE_MOBILE_SESSION=1 시,
//   sameSite:'none', secure:true 로 강제합니다.
//   (이때 백엔드는 https:// 로 접근해야 하며, 프록시 신뢰가 필요합니다.)
// ————————————————————————————————————————————————
const cookieForProd = {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24, // 1일
  sameSite: 'none', // ✅ 크로스사이트(HTTPS) 허용
  secure: true,     // ✅ HTTPS에서만
};
const cookieForDevWeb = {
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24, // 1일
  sameSite: 'lax',
  secure: false,
};

// ✅ 최종 쿠키 설정 결괏값 계산
// - PROD 이거나 앱세션강제면 SameSite=None + Secure
// - 그 외에는 개발 웹 기본값(Lax)
const cookieConfig = (isProd || isCapAppMode) ? cookieForProd : cookieForDevWeb;

// ⚠️ 경고 로그: 앱세션강제인데 HTTPS가 아니라면 쿠키가 막힙니다.
if ((isProd || isCapAppMode) && process.env.API_BASE_URL && !process.env.API_BASE_URL.startsWith('https://')) {
  console.warn('⚠️ APP_MODE/PROD 쿠키는 Secure 필요. API_BASE_URL이 HTTPS가 아니면 세션 쿠키가 동작하지 않습니다:', process.env.API_BASE_URL);
}

const sessionMiddleware = session({
  name: 'tzchat.sid',
  secret: SESSION_SECRET, // ⚠️ 운영 시 환경변수 사용 권장(이미 적용)
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: cookieConfig,
});

app.use((req, res, next) => {
  // 요청 단위로 어떤 쿠키 정책이 적용됐는지 로그
  const origin = req.headers.origin || '(no-origin)';
  console.log('🍪 [SessionCookiePolicy] origin=', origin, '| sameSite=', cookieConfig.sameSite, '| secure=', cookieConfig.secure);
  next();
});

app.use(sessionMiddleware);
app.set('sessionStore', sessionStore);
console.log('🔐 세션 설정 완료:', cookieConfig);

// =======================================
// 2) 라우터 등록
// =======================================
const userRouter = require('./routes/userRouter');
app.use('/api', userRouter);
console.log('📡 /api → userRouter 등록 완료');

const authRouter = require('./routes/authRouter');
app.use('/api', authRouter);
console.log('📡 /api → authRouter 등록 완료');

const targetRouter = require('./routes/targetRouter');
app.use('/api', targetRouter);
console.log('📡 /api → targetRouter 등록 완료');

const friendRouter = require('./routes/friendRouter');
app.use('/api', friendRouter);
console.log('📡 /api → friendRouter 등록 완료');

const chatRouter = require('./routes/chatRouter');
app.use('/api', chatRouter);
console.log('📡 /api → chatRouter 등록 완료');

const emergencyRouter = require('./routes/emergencyRouter');
app.use('/api', emergencyRouter);
console.log('📡 /api → emergencyRouter 등록 완료');

const pushRouter = require('./routes/pushRouter');
app.use('/api/push', pushRouter);
console.log('📡 /api/push → pushRouter 등록 완료');

const supportRouter = require('./routes/supportRouter');
app.use('/api', supportRouter); // 공개 라우터, 인증 미들웨어 앞에서 연결
console.log('📡 /api → supportRouter 등록 완료');

let adminRouter; // 아래서 등록

// =======================================
// 3) Socket.IO 설정 (+온라인유저/방현황 트래킹)
// =======================================
const { Server } = require('socket.io');
const io = new Server(server, {
  // ★ 프론트와 경로 통일 (connectSocket()에서 path:'/socket.io')
  path: '/socket.io',
  cors: {
    origin: allowedOrigins, // ★ CORS 오리진 동일 적용 (capacitor 포함)
    credentials: true,
  },
});
console.log('🔌 Socket.IO 경로(/socket.io) 및 CORS 적용');

// ✅ 세션 공유 (Socket.IO → req.session 사용 가능)
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ✅ 온라인 유저/방 현황
const onlineUsers = new Set();
const roomMembers = new Map();

// ✅ 유저별 룸 이름 규칙
const userRoom = (userId) => `user:${userId}`;

// ✅ app에 공유
app.set('io', io);
app.set('onlineUsers', onlineUsers);
app.set('roomMembers', roomMembers);

// ✅ (신규) 채팅 리스트/TopMenu 갱신용 헬퍼
async function notifyRoomParticipantsForList(roomId, lastMessagePayload) {
  try {
    const room = await ChatRoom.findById(roomId).select('participants').lean();
    const ids = room?.participants?.map((id) => String(id)) || [];
    ids.forEach((pid) => {
      // ⓐ TopMenu 합계/리스트 배지 재계산 신호
      io.to(userRoom(pid)).emit('chatrooms:badge', { changedRoomId: roomId });
      // ⓑ 리스트의 마지막 메시지 미리보기 갱신(옵션)
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
  // 특정 유저에게 임의 이벤트
  toUser(userId, event, payload) {
    if (!userId) return;
    io.to(userRoom(userId)).emit(event, payload);
  },
  // 친구 요청 관련 표준 이벤트들
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
  // 🆕 채팅 관련 헬퍼
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
    const session = socket.request.session;
    const userId = session?.user?._id ? String(session.user._id) : null;

    console.log(`📡 소켓 연결됨: ${socket.id} | 유저: ${userId || '(anon)'} | path=/socket.io`);

    if (userId) {
      onlineUsers.add(userId);
      // 자동 개인룸 조인(세션이 있으면)
      socket.join(userRoom(userId));
      console.log(`👤 자동 개인룸 조인: ${userRoom(userId)}`);
    }

    // ==== 클라이언트에서 명시적으로 개인룸 조인 (프론트: socket.emit('join', { userId })) ====
    socket.on('join', (payload = {}) => {
      try {
        const uid = String(payload.userId || userId || '');
        if (!uid) return;
        socket.join(userRoom(uid));
        console.log(`🚪 사용자 조인: ${uid} → ${userRoom(uid)}`);
      } catch (err) {
        console.error('❌ join 처리 오류:', err);
      }
    });

    // ==== 채팅방 조인 ====
    socket.on('joinRoom', (roomId) => {
      try {
        socket.join(roomId);
        console.log(`🚪 ${userId || '(anon)'} → 방 참여: ${roomId}`);
        if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
        if (userId) roomMembers.get(roomId).add(userId);
      } catch (err) {
        console.error('❌ joinRoom 처리 오류:', err);
      }
    });

    socket.on('leaveRoom', (roomId) => {
      try {
        socket.leave(roomId);
        console.log(`🚪 ${userId || '(anon)'} → 방 나가기: ${roomId}`);
        if (roomMembers.has(roomId) && userId) {
          roomMembers.get(roomId).delete(userId);
        }
      } catch (err) {
        console.error('❌ leaveRoom 처리 오류:', err);
      }
    });

    // ==== 채팅 메시지 포워딩 ====
    // ⚠️ 프론트에서 POST로 메시지 저장 후, 아래 이벤트를 emit하고 있음
    socket.on('chatMessage', async ({ roomId, message }) => {
      try {
        console.log(`📨 소켓 메시지: ${message?.content ? message.content : '[이미지]'} → ${roomId}`);
        io.to(roomId).emit('chatMessage', message); // 방 내 전파
        await notifyRoomParticipantsForList(roomId, {
          _id: message?._id,
          content: message?.content || '',
          imageUrl: message?.imageUrl || '',
          sender: message?.sender || null,
          createdAt: message?.createdAt || new Date(),
        });
      } catch (err) {
        console.error('❌ chatMessage 처리 오류:', err);
      }
    });

    // ✅ 읽음 처리 브로드캐스트
    socket.on('messagesRead', async (payload = {}) => {
      try {
        const { roomId, readerId, messageIds } = payload;
        console.log(
          `👀 messagesRead 브로드캐스트: room=${roomId} reader=${readerId} count=${messageIds?.length || 0}`
        );
        socket.to(roomId).emit('messagesRead', { roomId, readerId, messageIds });
        await notifyRoomParticipantsBadgeOnly(roomId);
      } catch (err) {
        console.error('❌ messagesRead 처리 오류:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        console.log(`❌ 소켓 연결 종료: ${socket.id}`);
        if (userId) {
          onlineUsers.delete(userId);
          for (const set of roomMembers.values()) set.delete(userId);
        }
      } catch (err) {
        console.error('❌ disconnect 처리 오류:', err);
      }
    });
  } catch (err) {
    console.error('❌ 소켓 connection 핸들러 오류:', err);
  }
});

// =======================================
// 4) (마지막) Admin Router 등록
// =======================================
adminRouter = require('./routes/adminRouter');
app.use('/api/admin', adminRouter);
console.log('📡 /api → adminRouter 등록 완료');

// =======================================
// 5) 서버 실행
// =======================================
server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`🚀 서버 실행 중: http://${addr.address}:${addr.port}`);
  console.log(`🔭 휴대폰 테스트 예시: http://192.168.0.7:${PORT}`);
  if (isProd || isCapAppMode) {
    console.log('🔒 SameSite=None + Secure 쿠키 사용중 → 반드시 HTTPS로 접근해야 세션 동작합니다.');
  } else {
    console.log('🧪 DEV 모드: sameSite=lax, secure=false 쿠키 / 로컬 개발 오리진 허용');
  }
});
