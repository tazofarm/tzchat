// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatroom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true }, // 해당 메시지가 속하는 채팅방
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 메시지를 보낸 사용자
    message: { type: String, required: true }, // 메시지 내용
    timestamp: { type: Date, default: Date.now } // 메시지 전송 시간
});

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;