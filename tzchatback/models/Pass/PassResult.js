// backend/models/Pass/PassResult.js
// ------------------------------------------------------
// PASS 결과 이력 + 1회성 토큰 저장소
// - 콜백 원본(rawMasked) 일부만 보관(민감정보 마스킹 전제)
// - 가입/임시로그인 분기 판단 전 단계의 저장소
// - consumed 플래그로 재사용 차단(소모형)
// - TTL 옵션(PASSRESULT_TTL_DAYS) 지원
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
    // name은 마스킹된 형태 권장(예: '홍*동')
    name: { type: String, default: '' },
    birthyear: { type: Number, default: null },
    gender: { type: String, enum: ['man', 'woman', ''], default: '' },

    // 전화 관련 (E.164 정규화된 값; 원문 포맷은 저장 금지)
    phone: { type: String, default: '' }, // E.164 예: +821012345678
    carrier: { type: String, default: '' },

    // 식별 해시 (원문 CI/DI는 저장하지 않음)
    ciHash: { type: String, index: true },
    diHash: { type: String, index: true },

    // 라우팅 결과 기록 (개발/분석 편의)
    // signup | templogin
    routeDecided: { type: String, default: null },

    // 연계된 사용자(소모 시점 또는 라우팅 확정 시 기록)
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // 원본(민감정보 제거/마스킹된 형태만 저장)
    rawMasked: { type: Schema.Types.Mixed, default: {} },

    // 민감정보 레드액트 여부(콜백 처리 후 true 권장)
    sensitiveFieldsRedacted: { type: Boolean, default: false },

    // 1회성 소모 제어
    consumed: { type: Boolean, default: false, index: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ------------------------------------------------------
// 인덱스 최적화
// ------------------------------------------------------
PassResultSchema.index({ createdAt: -1 });
PassResultSchema.index({ status: 1, consumed: 1, createdAt: -1 });
PassResultSchema.index({ txId: 1, consumed: 1 });

// 선택적 TTL(환경변수 일 단위)
// 예) PASSRESULT_TTL_DAYS=30 → createdAt 기준 30일 후 자동 만료
const TTL_DAYS = parseInt(process.env.PASSRESULT_TTL_DAYS || '0', 10);
if (Number.isFinite(TTL_DAYS) && TTL_DAYS > 0) {
  PassResultSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 }
  );
}

// ------------------------------------------------------
// Statics
// ------------------------------------------------------
/**
 * txId로 문서 조회(소모 여부 무관, 최신 1건)
 */
PassResultSchema.statics.findByTxId = function (txId) {
  if (!txId) return null;
  return this.findOne({ txId });
};

/**
 * txId를 1회성으로 소모 처리.
 * - 이미 consumed인 경우 null 반환
 * - 최초 소모 시 consumed=true, usedAt/usedBy 기록 후 문서 반환(lean)
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

/**
 * 라우팅 결과 및 유저 매핑 기록 (옵션)
 */
PassResultSchema.statics.markRoute = async function (txId, route, userId = null) {
  if (!txId) return null;
  const update = {
    $set: {
      routeDecided: route || null,
      ...(userId ? { userId: new Types.ObjectId(userId) } : {}),
    },
  };
  return this.findOneAndUpdate({ txId }, update, { new: true }).lean();
};

// ------------------------------------------------------
// Methods
// ------------------------------------------------------
/**
 * 민감 필드 레드액트 플래그 설정(내용은 콜백 처리부에서 이미 마스킹 가정)
 */
PassResultSchema.methods.markRedacted = async function () {
  if (!this.sensitiveFieldsRedacted) {
    this.sensitiveFieldsRedacted = true;
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('PassResult', PassResultSchema);
