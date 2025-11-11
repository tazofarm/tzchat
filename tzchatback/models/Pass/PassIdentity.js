// models/User/PassIdentity.js
// ------------------------------------------------------
// PASS 정본 매핑: CI/DI → User 1:1 연결
// - 로그인/가입 판별의 기준 저장소 (소유권 테이블)
// - CI/DI/전화 해시 보관, 검증 시각 업데이트
// - PassResult는 이력/토큰(consume) 용도로 분리 운용
// - ✅ userId는 선택(가입 전 비연결 상태 허용)
// ------------------------------------------------------
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Schema, Types } = mongoose;

const PassIdentitySchema = new Schema(
  {
    // 가입 전에도 레코드가 존재할 수 있으므로 선택(Optional)
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // 결정적 해시(sha256 등)로 저장. 원문 CI/DI는 절대 저장하지 않음.
    ciHash: { type: String, required: true, unique: true, index: true },
    diHash: { type: String, unique: true, sparse: true, index: true }, // 선택 필드

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
// 인덱스(1:1 보장)
// - userId는 가입 후 1:1 매핑을 강제하기 위해 unique + sparse
// ------------------------------------------------------
PassIdentitySchema.index({ userId: 1 }, { unique: true, sparse: true });

// ------------------------------------------------------
// 유틸
// ------------------------------------------------------
const sha256Hex = (s = '') =>
  crypto.createHash('sha256').update(String(s)).digest('hex');

// ------------------------------------------------------
// 스태틱/인스턴스 유틸
// ------------------------------------------------------

/**
 * CI 기준으로 upsert 수행.
 * - 존재: (선택) userId 일치성 확인/미연결이면 연결, 최신 값 갱신, lastVerifiedAt 갱신
 * - 부재: 신규 생성(최소 ciHash 필요; userId는 선택)
 * @param {Object} params
 * @param {String} params.ciHash - 필수(원문 CI의 SHA-256)
 * @param {String} [params.diHash] - 선택(원문 DI의 SHA-256)
 * @param {String|ObjectId} [params.userId] - 선택(가입 전이면 생략)
 * @param {String} [params.phoneHash] - 선택(User.phone의 SHA-256)
 * @param {String} [params.carrier] - 선택
 */
PassIdentitySchema.statics.upsertByCI = async function ({
  ciHash,
  diHash,
  userId,
  phoneHash,
  carrier,
}) {
  if (!ciHash) throw new Error('ciHash is required');

  const now = new Date();
  const existing = await this.findOne({ ciHash });

  if (!existing) {
    // 신규 생성
    const doc = await this.create({
      ciHash,
      ...(diHash ? { diHash } : {}),
      ...(phoneHash ? { phoneHash } : {}),
      ...(carrier ? { carrier } : {}),
      ...(userId ? { userId: new Types.ObjectId(userId) } : {}),
      firstVerifiedAt: now,
      lastVerifiedAt: now,
      status: 'active',
    });
    return doc;
  }

  // 기존 문서 업데이트
  // userId 바인딩 규칙: 이미 연결된 경우 동일인만 허용
  if (userId) {
    const newUid = new Types.ObjectId(userId);
    if (existing.userId && String(existing.userId) !== String(newUid)) {
      throw new Error('CI is already bound to a different user');
    }
    if (!existing.userId) {
      existing.userId = newUid; // 최초 바인딩
    }
  }

  if (diHash) existing.diHash = diHash;
  if (phoneHash) existing.phoneHash = phoneHash;
  if (carrier) existing.carrier = carrier;

  existing.lastVerifiedAt = now;
  await existing.save();
  return existing;
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

/**
 * CI가 아직 미연결 상태일 때만 userId 바인딩
 * (경합 상황에서 1:1 보장; 이미 다른 유저에 묶여 있으면 예외)
 */
PassIdentitySchema.statics.linkUserIfVacant = async function (ciHash, userId) {
  if (!ciHash) throw new Error('ciHash is required');
  if (!userId) throw new Error('userId is required');

  const updated = await this.findOneAndUpdate(
    { ciHash, $or: [{ userId: null }, { userId: { $exists: false } }] },
    { $set: { userId: new Types.ObjectId(userId), lastVerifiedAt: new Date() } },
    { new: true }
  );

  if (updated) return updated;

  // 이미 연결된 경우 동일인만 허용
  const current = await this.findOne({ ciHash }).lean();
  if (!current) throw new Error('CI not found');
  if (current.userId && String(current.userId) !== String(userId)) {
    throw new Error('CI is already bound to a different user');
  }
  return current; // 이미 동일 유저에 연결된 상태
};

/** 편의: 원문 CI를 받아 해시 계산 후 조회 */
PassIdentitySchema.statics.findByRawCI = async function (rawCI) {
  if (!rawCI) return null;
  const ciHash = sha256Hex(rawCI);
  return this.findOne({ ciHash });
};

module.exports = mongoose.model('PassIdentity', PassIdentitySchema);
