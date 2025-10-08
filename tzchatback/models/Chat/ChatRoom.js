// models/Chat/ChatRoom.js
// -------------------------------------------------------------
// 💬 ChatRoom 스키마
// - 기존 구조 최대 유지(participants, messages, createdAt)
// - 리스트 성능/정렬 개선: lastMessage/updatedAt/인덱스
// -------------------------------------------------------------
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// lastMessage 서브도큐먼트
const lastMessageSchema = new Schema(
  {
    content:   { type: String, default: '' },
    imageUrl:  { type: String, default: '' },
    sender:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date }
  },
  { _id: false }
);

// 메인 스키마
const chatRoomSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    messages:     [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    createdAt:    { type: Date, default: Date.now },
    lastMessage:  { type: lastMessageSchema, default: () => ({}) },
    updatedAt:    { type: Date, default: Date.now }
  }
);

// 인덱스
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ updatedAt: -1 });
chatRoomSchema.index({ createdAt: -1 });
// ✅ “내가 포함된 방을 최신순으로” 조회 최적화
chatRoomSchema.index({ participants: 1, updatedAt: -1 });

// 저장 전 updatedAt 자동 갱신
chatRoomSchema.pre('save', function (next) {
  try {
    this.updatedAt = new Date();
    next();
  } catch (err) {
    console.error('[ChatRoom.pre.save] ❌ error:', err);
    next(err);
  }
});

// 마지막 메시지 캐시 갱신 + updatedAt 터치
chatRoomSchema.methods.setLastMessageAndTouch = function (payload = {}) {
  const {
    content = '',
    imageUrl = '',
    sender = null,
    createdAt = new Date()
  } = payload;

  this.lastMessage = { content, imageUrl, sender, createdAt };
  this.updatedAt = new Date();
};

chatRoomSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
