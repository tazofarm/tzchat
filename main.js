const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path'); // path 모듈을 추가합니다.
const flash = require('connect-flash'); // 플래시 미들웨어 추가
const http = require('http');  // http 모듈 추가
const socketIo = require('socket.io'); // Socket.IO 추가

// dotenv 설정 - 이 부분을 맨 상단에 추가
require('dotenv').config();

const Message = require('./0500_models/Message'); // Message 모델 가져오기
const mainRouter = require('./0410_routes/mainRouter');
const friendRouter = require('./0410_routes/friendRouter');
const chatRouter = require('./0410_routes/chatRouter');

const app = express();
const PORT = process.env.PORT || 2000;

// HTTP 서버 생성
const server = http.createServer(app);
const io = socketIo(server); // Socket.IO 서버 초기화

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '0200_public')));

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '0100_views')); // EJS 템플릿 경로 설정

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/tzchat')
    .then(() => console.log('MongoDB에 연결되었습니다.'))
    .catch(err => console.error('MongoDB 연결 실패:', err));

// 미들웨어 설정
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 세션 설정
app.use(session({
    secret: 'tztz',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS에서만 유효한 쿠키 설정: 개발 중에는 false로 유지
}));

// 라우터 설정
app.use('/', mainRouter);
app.use('/', friendRouter);
app.use('/', chatRouter);

// Socket.IO 설정
io.on('connection', (socket) => {
    console.log('새로운 사용자 연결됨:', socket.id);

    // 클라이언트로부터 메시지를 수신
    socket.on('sendMessage', (data) => {
        // 사용자의 ID를 정확히 가져와야 합니다
        const userId = data.userId; // 사용자 ID를 클라이언트에서 보내도록 설정하거나 세션에서 가져옵니다
        const { message, chatRoomId, username } = data;

        const newMessage = new Message({
            chatroom: chatRoomId,
            user: userId, // 사용자 ID는 ObjectId여야 합니다
            message: message
        });

        newMessage.save()
            .then(() => {
                io.emit('receiveMessage', { username, message }); // 모든 클라이언트에 메시지를 전송
            })
            .catch(err => {
                console.error('메시지 저장 중 오류 발생:', err);
            });
    });

    socket.on('disconnect', () => {
        console.log('사용자 연결 해제됨:', socket.id);
    });
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});