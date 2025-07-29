// main.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
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
  preflightContinue: true, // 사전 요청(preflight) 허용
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
console.log('🛡️  CORS 미들웨어 설정 완료');

// ✅ [2-1] Chrome 130 PNA 정책 대응 헤더 추가
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true'); // Chrome 보안 대응
  next();
});
console.log('🌐 Private Network Access 헤더 추가 완료');

// ✅ [3] JSON 파서 미들웨어 적용
app.use(express.json());
console.log('📦 JSON 파서 미들웨어 적용 완료');

// ✅ [4] 세션 설정 (서버 측 로그인 유지)
app.use(session({
  secret: 'tzchatsecret', // 세션 암호화 키
  resave: false,           // 매 요청마다 세션 재저장 여부
  saveUninitialized: false, // 초기값 없는 세션 저장 여부
  cookie: {
    httpOnly: true,        // JS에서 쿠키 접근 불가
    maxAge: 1000 * 60 * 60 * 24 // 1일
  }
}));
console.log('🔐 세션 미들웨어 설정 완료');

// ✅ [5] 라우터 등록
app.use('/api', userRouter);
console.log('📡 /api → userRouter 연결 완료');

app.use('/api', authRouter);
console.log('📡 /api → authRouter 연결 완료');

// ✅ [6] 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
