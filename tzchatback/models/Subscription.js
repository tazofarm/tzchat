// backend/models/Subscription.js
// ------------------------------------------------------------
// Subscription 모델
// - "사용자가 어떤 플랜을 언제부터 언제까지 쓰는가"의 정본
// - 플랫폼(google/apple/web) 별 식별자/영수증 토큰 저장
// - 다음 결제일(nextBillingAt), 취소예약(cancelAtPeriodEnd) 관리
// ------------------------------------------------------------
const mongoose = require('mongoose');

const SUB_STATUS = ['active', 'trial', 'past_due', 'canceled', 'paused', 'expired'];
const PROVIDERS = ['google', 'apple', 'web'];

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, required: true },

  // 어떤 상품/플랜인지
  planId: { type: String, required: true },         // 예: 'lite_monthly', 'vip_monthly', ...
  planName: { type: String, default: '' },          // 사람친화적 이름
  interval: { type: String, enum: ['month', 'year'], default: 'month' },
  price: { type: Number, default: 0 },              // 세금 제외/포함 전략은 서비스 정책에 맞춰
  currency: { type: String, default: 'KRW' },

  // 상태/주기
  status: { type: String, enum: SUB_STATUS, default: 'active', index: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd:   { type: Date, required: true }, // ≒ 결제주기 종료시점 (갱신 직전)
  nextBillingAt:      { type: Date, required: true }, // 다음 결제 예정일 = currentPeriodEnd
  cancelAtPeriodEnd:  { type: Boolean, default: false }, // true면 다음 갱신 시점에 자동 종료
  canceledAt:         { type: Date, default: null },     // 사용자가 취소 신청한 시점(취소예약)

  // 무료체험/유예
  trialStart: { type: Date, default: null },
  trialEnd:   { type: Date, default: null },
  gracePeriodEnd: { type: Date, default: null }, // 결제 실패 후 유예 기한

  // 플랫폼/결제 사업자 식별
  provider: { type: String, enum: PROVIDERS, required: true }, // 'google'|'apple'|'web'
  purchaseToken: { type: String, default: '' }, // 구글/애플 영수증 토큰(검증용)
  orderId: { type: String, default: '', index: true },

  // 운영 메모/감사 로그
  meta: { type: Object, default: {} }

}, { timestamps: true });

subscriptionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
