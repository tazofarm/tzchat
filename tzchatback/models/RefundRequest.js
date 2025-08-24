// backend/models/RefundRequest.js
// ------------------------------------------------------------
// 환불 신청서
// - 접수/승인/거절 상태 이력화
// - "구독 1주일 이내" 같은 정책 검증/자동화에 필요
// ------------------------------------------------------------
const mongoose = require('mongoose');

const RR_STATUS = ['requested', 'approved', 'rejected', 'processed'];

const refundRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, required: true },
  subscriptionId: { type: mongoose.Types.ObjectId, ref: 'Subscription', index: true, required: true },

  status: { type: String, enum: RR_STATUS, default: 'requested', index: true },
  reason: { type: String, default: '' },

  // 환불 윈도우 검사에 필요한 기준들 (예: 결제일로부터 7일 이내)
  purchaseAt: { type: Date, required: true },
  requestedAt: { type: Date, default: Date.now },

  // 처리 메타
  handledBy: { type: String, default: '' }, // 운영자 ID/이메일
  handledAt: { type: Date, default: null },
  meta: { type: Object, default: {} }

}, { timestamps: true });

refundRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('RefundRequest', refundRequestSchema);
