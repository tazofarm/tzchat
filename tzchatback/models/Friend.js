const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({



  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 신청자
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // 받는 사람
  message: { type: String },         // 신청 메세지
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],  // 수락하면 db에 accenpted 상태, 거절하면 db에 rejected 상태
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
})
















module.exports = mongoose.model('Friend', friendSchema);