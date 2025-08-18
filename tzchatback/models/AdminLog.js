// models/AdminLog.js
const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'promote', 'block', 'deleteRoom'
  targetId: { type: String },               // 유저/방/공지 등 타깃 식별자
  meta: { type: Object, default: {} },      // 추가 정보
}, { timestamps: true });

module.exports = mongoose.model('AdminLog', adminLogSchema);
