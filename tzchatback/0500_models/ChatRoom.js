// models/ChatRoom.js
const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 참여하는 사용자들의 ID
    created_at: { type: Date, default: Date.now },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }]
});

const ChatRoom = mongoose.models.ChatRoom || mongoose.model('ChatRoom', chatRoomSchema);


module.exports = ChatRoom;