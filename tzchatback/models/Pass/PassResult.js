// backend/models/Pass/PassResult.js
// ------------------------------------------------------
// PASS 결과 이력 + 1회성 토큰 저장소
// - 콜백 원본(rawMasked) 일부만 보관(민감정보 마스킹 전제)
// - 가입/임시로그인 분기 판단 전 단계의 저장소
// - consumed 플래그로 재사용 차단(소모형)
// ------------------------------------------------------
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PassResultSchema = new Schema(
  {
    // 거래/세션 식별자 (예: 다날 TID 또는 내부 txId)
    txId: { type: String, required: true, unique: true, index: true },

    // 공급자/의도
    provider: { type: String, default: 'Danal' },
    intent: { type: String, default: 'unified', index: true }, // 예: unified, phoneUpdate 등

    // 상태
    status: {
      type: String,
      enum: ['pending', 'success', 'fail'],
      default: 'pending',
      index: true,
    },
    failCode: { type: String, default: null },

    // 결과(마스킹/정규화된 값들)
    name: { type: String, default: '' },        // 마스킹된 이름 권장
    birthyear: { type: Number, default: null },
    gender: { type: String, enum: ['man', 'woman', ''], default: '' },
    phone: { type: String, default: '' },       // E.164
    carrier: { type: String, default: '' },

    // 식별 해시 (원문 CI/DI는 저장하지 않음)
    ciHash: { type: String, index: true },
    diHash: { type: String, index: true },

    // 연계된 사용자(소모 시점에 기입 가능)
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // 원본(민감정보 제거/마스킹된 형태만 저장)
    rawMasked: { type: Schema.Types.Mixed, default: {} },

    // 1회성 소모 제어
    consumed: { type: Boolean, default: false, index: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// 인덱스 최적화
PassResultSchema.index({ createdAt: -1 });
PassResultSchema.index({ status: 1, consumed: 1, createdAt: -1 });
PassResultSchema.index({ txId: 1, consumed: 1 });

// ------------------------------------------------------
// Statics: 소모(consume) 유틸
// ------------------------------------------------------
/**
 * txId를 1회성으로 소모 처리.
 * - 이미 consumed인 경우 null 반환
 * - 최초 소모 시 consumed=true, usedAt/usedBy 기록 후 문서 반환
 */
PassResultSchema.statics.consumeByTxId = async function (txId, userId = null) {
  if (!txId) return null;
  const now = new Date();
  const doc = await this.findOneAndUpdate(
    { txId, consumed: false },
    {
      $set: {
        consumed: true,
        usedAt: now,
        ...(userId ? { usedBy: new Types.ObjectId(userId) } : {}),
      },
    },
    { new: true }
  ).lean();
  return doc; // 이미 소모됐으면 null
};

module.exports = mongoose.model('PassResult', PassResultSchema);
