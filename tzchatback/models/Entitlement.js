// backend/models/Entitlement.js
// ------------------------------------------------------------
// Entitlement: 현재 권한(기능 접근) 스냅샷
// - 매 빌링/상태 변경 시 계산 후 업데이트
// - 프론트는 이걸 빠르게 조회해서 UI/기능 제어
// ------------------------------------------------------------
const mongoose = require('mongoose');

const entitlementSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true, unique: true },

  // 접근 권한 플래그(예: 일일 좋아요 수, 고급 검색, 광고 제거 등)
  // 숫자/불리언 혼합 가능
  features: {
    adFree: { type: Boolean, default: false },
    superLikePerDay: { type: Number, default: 0 },
    advancedSearch: { type: Boolean, default: false },
    priorityBoost: { type: Boolean, default: false }
  },

  // 어떤 근거로 생성됐는지 추적(디버깅)
  source: {
    planId: { type: String, default: '' },
    user_level: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  }

}, { timestamps: true });

module.exports = mongoose.model('Entitlement', entitlementSchema);
