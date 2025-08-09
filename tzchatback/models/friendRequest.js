// models/friendRequest.js

const mongoose = require('mongoose')

// 📌 친구 신청 모델 정의
const friendRequestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',      // 신청자
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',      // 받는 사람
    required: true
  },
  message: {
    type: String,     // 신청 메시지
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'  // 초기 상태는 대기 중
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

// ✅ 동일한 사람에게 중복 신청 방지 (from + to 조합이 유일)
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true })

// 로그 확인용
friendRequestSchema.pre('save', function (next) {
  console.log('📝 친구 신청 저장됨:', this)
  next()
})

module.exports = mongoose.model('FriendRequest', friendRequestSchema)
