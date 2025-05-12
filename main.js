const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const flash = require('connect-flash');
const http = require('http');
const socketIo = require('socket.io');

// 환경 변수 로드
require('dotenv').config();

const Message = require('./0500_models/Message');
const User = require('./0500_models/User');
const ChatRoom = require('./0500_models/ChatRoom');

const mainRouter = require('./0410_routes/mainRouter');
const friendRouter = require('./0410_routes/friendRouter');
const chatRouter = require('./0410_routes/chatRouter');
const profileImageRouter = require('./0410_routes/profileImage');

const app = express();
const PORT = process.env.PORT || 2000;

// HTTP 서버 생성
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '0200_public')));
app.use('/images', express.static(path.join(__dirname, '0200_public/images')));
app.use('/uploads', express.static(path.join(__dirname, '0200_public/uploads')));

// EJS 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '0100_views'));

// 미들웨어
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'tztz',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// 라우터
app.use('/', mainRouter);
app.use('/', friendRouter);
app.use('/', chatRouter);
app.use('/profileImage', profileImageRouter);

// Socket.IO 이벤트
io.on('connection', (socket) => {
    console.log('새로운 사용자 연결됨:', socket.id);

    socket.on('joinRoom', (chatRoomId) => {
        socket.join(chatRoomId);
        console.log(`Socket ${socket.id} joined room ${chatRoomId}`);
    });

    socket.on('sendMessage', async (data) => {
        try {
            const userId = data.userId;
            const { message, chatRoomId } = data;

            const newMessage = new Message({
                chatroom: chatRoomId,
                user: userId,
                message: message
            });

            const savedMessage = await newMessage.save();

            await ChatRoom.findByIdAndUpdate(chatRoomId, {
                $push: { messages: savedMessage._id }
            });

            const user = await User.findById(userId);

            io.to(chatRoomId).emit('receiveMessage', {
                username: user.nickname,
                message: message,
                timestamp: savedMessage.timestamp
            });

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

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB에 연결되었습니다.');
    server.listen(PORT, () => {
      console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB 연결 실패:', err);
  });