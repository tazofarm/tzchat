const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const userRouter = require('./routes/userRouter');
const authRouter = require('./routes/authRouter');


const app = express();
const PORT = 2000;

// ✅ MongoDB 연결 (더 이상 useNewUrlParser, useUnifiedTopology 필요 없음)
mongoose.connect('mongodb://localhost:27017/tzchat')
  .then(() => console.log('✅ MongoDB 연결 성공'))
  .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// ✅ CORS 설정 - 프론트엔드 도메인 허용
app.use(cors({
  origin: ['http://localhost:8081', 'https://tzchat.duckdns.org'],
  credentials: true
}));

// ✅ JSON 파싱 미들웨어
app.use(express.json());

// ✅ 세션 설정
app.use(session({
  secret: 'tzchatsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 하루 유지

  }

}));

// ✅ API 라우터 연결 (/api/signup, /api/login 등)
app.use('/api', userRouter);
app.use('/api', authRouter);

// ✅ 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 백엔드 서버 실행 중: http://localhost:${PORT}`);
});
