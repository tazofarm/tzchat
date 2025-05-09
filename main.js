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
const User = require('./0500_models/User');       // ✅ 추가: 닉네임 조회용
const ChatRoom = require('./0500_models/ChatRoom'); // ✅ 추가: 메시지 ID 저장용

const mainRouter = require('./0410_routes/mainRouter');
const friendRouter = require('./0410_routes/friendRouter');
const chatRouter = require('./0410_routes/chatRouter');
const profileImageRouter = require('./0410_routes/profileImage');


const app = express();
const PORT = process.env.PORT || 2000;

// HTTP 서버 생성
const server = http.createServer(app);
const io = socketIo(server); // Socket.IO 서버 초기화

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '0200_public')));

// 기본 이미지용
app.use('/images', express.static(path.join(__dirname, '0200_public/images')));

// 업로드된 이미지용
app.use('/uploads', express.static(path.join(__dirname, '0200_public/uploads')));


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
app.use('/profileImage', profileImageRouter);



// Socket.IO 설정
io.on('connection', (socket) => {
    console.log('새로운 사용자 연결됨:', socket.id);

    // ✅ 채팅방 입장 처리
    socket.on('joinRoom', (chatRoomId) => {
        socket.join(chatRoomId);
        console.log(`Socket ${socket.id} joined room ${chatRoomId}`);
    });

    // 클라이언트로부터 메시지를 수신
    socket.on('sendMessage', async (data) => {
        try {
            const userId = data.userId;
            const { message, chatRoomId, username } = data;

            const newMessage = new Message({
                chatroom: chatRoomId,
                user: userId,
                message: message
            });

            const savedMessage = await newMessage.save();

            // ✅ 메시지 ID를 채팅방에 추가
            await ChatRoom.findByIdAndUpdate(chatRoomId, {
                $push: { messages: savedMessage._id }
            });

            // ✅ 사용자 정보 조회 (닉네임)
            const user = await User.findById(userId);

            // ✅ 채팅방 참가자에게만 메시지 전송
            io.to(chatRoomId).emit('receiveMessage', {
                username: user.nickname,
                message: message,
                timestamp: savedMessage.timestamp
            });

            // ✅ 자기 자신에게도 전송 (joinRoom 누락 시 대비)
            socket.emit('receiveMessage', {
                username: user.nickname,
                message: message,
                timestamp: savedMessage.timestamp
            });

        } catch (err) {
            console.error('메시지 저장 중 오류 발생:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('사용자 연결 해제됨:', socket.id);
    });
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});