const mongoose = require('mongoose')
const Schema = mongoose.Schema

const chatRoomSchema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }], // 참여자들
  messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }], // 메시지 목록
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('ChatRoom', chatRoomSchema)