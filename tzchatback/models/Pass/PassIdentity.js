// models/User/PassIdentity.js
// ------------------------------------------------------
// PASS 정본 매핑: CI/DI → User 1:1 연결
// - 로그인/가입 판별의 기준 저장소 (소유권 테이블)
// - CI/DI/전화 해시 보관, 검증 시각 업데이트
// - PassResult는 이력/토큰(consume) 용도로 분리 운용
// ------------------------------------------------------
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const PassIdentitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // 결정적 해시(sha256 등)로 저장. 원문 CI/DI는 절대 저장하지 않음.
    ciHash: { type: String, unique: true, sparse: true, index: true },
    diHash: { type: String, unique: true, sparse: true, index: true },

    // 전화번호는 User.phone(E.164, 평문)에 저장하고,
    // 여기에는 비교/변경 추적용 해시만 저장(선택).
    phoneHash: { type: String, index: true },

    carrier: { type: String }, // 통신사(선택)

    firstVerifiedAt: { type: Date, default: Date.now },
    lastVerifiedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ['active', 'migrated', 'revoked'],
      default: 'active',
      index: true,
    },
  },
  {
    collection: 'pass_identities',
    timestamps: true, // createdAt, updatedAt
  }
);

// ------------------------------------------------------
// 스태틱/인스턴스 유틸
// ------------------------------------------------------

/**
 * CI 기준으로 upsert 수행.
 * - 존재: userId 일치 확인 후 최신 값 갱신, lastVerifiedAt 갱신
 * - 부재: 신규 생성(최소 userId, ciHash 필요)
 */
PassIdentitySchema.statics.upsertByCI = async function ({
  ciHash,
  diHash,
  userId,
  phoneHash,
  carrier,
}) {
  if (!ciHash) throw new Error('ciHash is required');
  if (!userId) throw new Error('userId is required');

  const now = new Date();

  const update = {
    $setOnInsert: {
      userId: new Types.ObjectId(userId),
      firstVerifiedAt: now,
      status: 'active',
    },
    $set: {
      lastVerifiedAt: now,
    },
  };

  if (typeof diHash === 'string' && diHash) update.$set.diHash = diHash;
  if (typeof phoneHash === 'string' && phoneHash) update.$set.phoneHash = phoneHash;
  if (typeof carrier === 'string' && carrier) update.$set.carrier = carrier;

  // ciHash 고유키로 upsert
  const doc = await this.findOneAndUpdate(
    { ciHash },
    update,
    { new: true, upsert: true }
  );

  // 기존 레코드가 있는데 소유자가 다르면 차단
  if (doc.userId.toString() !== String(userId)) {
    throw new Error('CI is already bound to a different user');
  }

  return doc;
};

/** 검증 시각만 갱신 */
PassIdentitySchema.statics.touchVerified = async function (ciHash) {
  if (!ciHash) return null;
  return this.findOneAndUpdate(
    { ciHash },
    { $set: { lastVerifiedAt: new Date() } },
    { new: true }
  );
};

/** 전화/통신사 변화 반영(해시/캐리어) */
PassIdentitySchema.statics.setPhone = async function ({ ciHash, phoneHash, carrier }) {
  if (!ciHash) throw new Error('ciHash is required');
  const $set = {};
  if (typeof phoneHash === 'string' && phoneHash) $set.phoneHash = phoneHash;
  if (typeof carrier === 'string' && carrier) $set.carrier = carrier;
  if (Object.keys($set).length === 0) return null;

  $set.lastVerifiedAt = new Date();

  return this.findOneAndUpdate(
    { ciHash },
    { $set },
    { new: true }
  );
};

module.exports = mongoose.model('PassIdentity', PassIdentitySchema);
