const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 📨 메시지 스키마
 * - type: 'text' | 'image'
 * - content: 텍스트 내용
 * - imageUrl: 이미지 메시지일 경우 경로
 */
const messageSchema = new Schema({
  chatRoom: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 시스템 메시지면 null
  type: { type: String, enum: ['text', 'image'], default: 'text' }, // ✅ 메시지 타입 추가
  content: { type: String, default: '' },   // 텍스트 메시지
  imageUrl: { type: String, default: '' },  // 이미지 메시지
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
