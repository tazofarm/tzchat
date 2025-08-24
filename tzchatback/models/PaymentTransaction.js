// backend/models/PaymentTransaction.js
// ------------------------------------------------------------
// 결제/환불 등 금전 이벤트 기록
// - 회계/정산·분쟁 대응의 증빙
// - 하나의 구독에 여러 트랜잭션이 연결될 수 있음
// ------------------------------------------------------------
const mongoose = require('mongoose');

const TX_TYPE = ['purchase', 'renewal', 'refund', 'chargeback', 'adjustment'];
const TX_STATUS = ['pending', 'succeeded', 'failed'];

const paymentTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, required: true },
  subscriptionId: { type: mongoose.Types.ObjectId, ref: 'Subscription', index: true },

  type: { type: String, enum: TX_TYPE, required: true },    // purchase|renewal|refund...
  status: { type: String, enum: TX_STATUS, default: 'pending' },

  provider: { type: String, enum: ['google','apple','web'], required: true },
  orderId: { type: String, index: true },
  receipt: { type: Object, default: {} }, // 영수증 전문(필요 시 원문 저장)

  amount: { type: Number, required: true },    // +결제, -환불
  currency: { type: String, default: 'KRW' },

  reason: { type: String, default: '' },  // 환불 사유 등
  meta: { type: Object, default: {} }

}, { timestamps: true });

paymentTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
