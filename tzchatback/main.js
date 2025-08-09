// main.js
// 🌐 Express 기반 tzchat 서버 초기화
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app); // ✅ socket.io를 위한 서버 래핑
const PORT = 2000;
const path = require('path'); // 파일 경로 관련 내장 모듈

// ✅ JSON 파서 등록 (imageUrl 전달용)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('📦 JSON 및 URL-Encoded 파서 활성화');

// ✅ 사진 업로드된 파일 접근용 정적 경로
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('🖼️ /uploads 정적 파일 경로 설정');

// ✅ 요청 로그 및 PNA 헤더 설정
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  console.log(`📥 [요청] ${req.method} ${req.url}`);
  next();
});

// ✅ CORS 설정
const cors = require('cors');
const corsOptions = {
  origin: ['http://localhost:8081', 'https://tzchat.duckdns.org'], // 프론트 도메인
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
console.log('🛡️  CORS 설정 완료');

// ✅ MongoDB 연결
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/tzchat')
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// ✅ 세션 설정
const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionMiddleware = session({
  secret: 'tzchatsecret', // 환경변수로 분리 권장
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/tzchat',
    ttl: 60 * 60 * 24 // 1일
  }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1일
    sameSite: 'lax',
    secure: false
  }
});
app.use(sessionMiddleware);
console.log('🔐 세션 설정 완료');

// ✅ 라우터 등록
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

// ✅ Socket.IO 설정
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8081', 'https://tzchat.duckdns.org'],
    credentials: true
  }
});

// ✅ 세션 공유 설정
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ✅ 소켓 이벤트 처리
io.on('connection', (socket) => {
  const session = socket.request.session;
  const userId = session?.user?._id;

  console.log(`📡 소켓 연결됨: ${socket.id} | 유저: ${userId}`);

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`🚪 ${userId} → 방 참여: ${roomId}`);
  });

  socket.on('chatMessage', ({ roomId, message }) => {
    console.log(`📨 소켓 메시지: ${message.content || '[이미지]'} → ${roomId}`);
    io.to(roomId).emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    console.log(`❌ 소켓 연결 종료: ${socket.id}`);
  });
});

// ✅ 서버 실행 (socket.io 포함)
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
