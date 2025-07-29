// main.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ✅ MongoDB 세션 저장소
const userRouter = require('./routes/userRouter');
const authRouter = require('./routes/authRouter');

const app = express();
const PORT = 2000;

// ✅ [1] MongoDB 연결
mongoose.connect('mongodb://localhost:27017/tzchat')
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// ✅ [2] CORS 설정 - 프론트엔드 도메인만 허용
app.use(cors({
  origin: ['http://localhost:8081', 'https://tzchat.duckdns.org'],
  credentials: true,
  preflightContinue: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
console.log('🛡️  CORS 미들웨어 설정 완료');

// ✅ [2-1] Chrome 130 PNA 정책 대응 헤더 추가
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
console.log('🌐 Private Network Access 헤더 추가 완료');

// ✅ [3] JSON 파서 미들웨어 적용
app.use(express.json());
console.log('📦 JSON 파서 미들웨어 적용 완료');

// ✅ [4] 세션 설정 (MongoDB 저장소 적용)
app.use(session({
  secret: 'tzchatsecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/tzchat',
    ttl: 60 * 60 * 24, // 1일 (초 단위)
  }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1일 (밀리초 단위)
    sameSite: 'lax',  // ✅ 크로스 도메인 대응
    secure: false     // ✅ 로컬 환경에서는 false
  }
}));
console.log('🔐 세션 미들웨어 (MongoDB 저장소) 설정 완료');

// ✅ [5] 라우터 등록
app.use('/api', userRouter);
console.log('📡 /api → userRouter 연결 완료');

app.use('/api', authRouter);
console.log('📡 /api → authRouter 연결 완료');

// ✅ [6] 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
