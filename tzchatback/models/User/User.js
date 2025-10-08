// backend/models/User/User.js
// ------------------------------------------------------------
// User 모델
// - 기존 구조 최대한 유지
// - [신규] 프로필 이미지 다중 관리
// - [보강] 배열 필드 default: [] 지정 (⚠ friendlist/blocklist 위치 수정)
// - [보강] 응답 변환 시 password 제거
// - [보강] 탈퇴 호환 필드 추가 (isDeleted, deletedAt) + 메서드 + 정합성 훅
// - [신규] 휴대폰 E.164 정규화 + phoneHash 자동 생성, 조회 최소화(select:false)
// ------------------------------------------------------------
const mongoose = require('mongoose');
const crypto = require('crypto');
const retention = require('@/config/retention'); // DELETION_GRACE_DAYS 사용

// ────────────────────────────────────────────────────────────
// [서브스키마] 프로필 이미지 문서 구조
// ────────────────────────────────────────────────────────────
const ProfileImageSchema = new mongoose.Schema(
  {
    id:        { type: String, required: true },
    kind:      { type: String, enum: ['avatar', 'gallery'], default: 'gallery' },
    aspect:    { type: Number, default: 0.8 },
    urls: {
      thumb:   { type: String, required: true },
      medium:  { type: String, required: true },
      full:    { type: String, required: true },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ────────────────────────────────────────────────────────────
// [유틸] 한국 기본 E.164 정규화 (+ 국제번호면 그대로)
// ※ 실제 서비스에선 libphonenumber-js 사용 권장
// ────────────────────────────────────────────────────────────
function normalizePhoneKR(raw = '') {
  const clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  return '+82' + clean;
}

function sha256Hex(text = '') {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

const userSchema = new mongoose.Schema(
  {
    // [0] 권한/상태
    role: { type: String, enum: ['user', 'master'], default: 'user' },
    suspended: { type: Boolean, default: false },

    // [1] 기본 정보
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nickname: { type: String, required: true, unique: true },
    birthyear: Number,
    gender: String,

    // [2] 프로필
    region1: { type: String, default: '미지정' },
    region2: { type: String, default: '미지정' },
    preference: { type: String, default: '이성친구 - 일반' },
    selfintro: { type: String, default: '' },

    // [신규] 프로필 이미지 다중 관리
    profileImages: { type: [ProfileImageSchema], default: [] },
    profileMain:   { type: String, default: '' },

    // [3] 검색 조건
    search_birthyear1: { type: Number, default: null },
    search_birthyear2: { type: Number, default: null },
    search_region1: { type: String, default: '전체' },
    search_region2: { type: String, default: '전체' },
    search_preference: { type: String, default: '이성친구 - 전체' },

    // 유료회원 관련
    user_level: { type: String, default: '일반회원' },
    refundCountTotal: { type: Number, default: 0, min: 0 },

    // 다중 검색 지역
    search_regions: {
      type: [{
        region1: { type: String, required: true },
        region2: { type: String, required: true }
      }],
      default: []
    },

    // [4] 기타
    profileImage: String,
    last_login: { type: Date, default: null },

    // [5] 친구/차단
    friendlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },
    blocklist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },

    // [6] Emergency
    emergency: {
      type: {
        isActive: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null }
      },
      default: () => ({ isActive: false, activatedAt: null })
    },

    // ────────────────────────────────────────────────────────
    // [신규] 내 전화번호/해시/주소록 해시
    // ────────────────────────────────────────────────────────
    phone: {
      type: String,
      unique: true,
      required: true, // 계정 식별/인증에 사용
    },   // E.164 (예: +821012345678)

    phoneHash: {
      type: String,
      unique: true,
      index: true,
      select: false, // 기본 응답에서 제외
    },  // SHA-256(E.164)

    localContactHashes: {
      type: [String],
      default: [],
      select: false, // 기본 응답에서 제외
    }, // SHA-256(E.164) 배열

    // 추가사항 (스페셜) — 스위치: "ON"/"OFF" (문자열)
    // ※ 프론트/라우터는 search_*만 사용
    search_disconnectLocalContacts: { type: String, default: 'OFF' },
    search_allowFriendRequests:     { type: String, default: 'OFF' },
    search_allowNotifications:      { type: String, default: 'OFF' },
    search_onlyWithPhoto:           { type: String, default: 'OFF' },
    search_matchPremiumOnly:        { type: String, default: 'OFF' },

    // 결혼유무
    marriage: { type: String, default: '미혼' },
    search_marriage: { type: String, default: '전체' },

    // [7] 누적 카운터
    sentRequestCountTotal: { type: Number, default: 0, min: 0 },
    receivedRequestCountTotal: { type: Number, default: 0, min: 0 },
    acceptedChatCountTotal: { type: Number, default: 0, min: 0 },

    // [탈퇴 관리 필드 - 기본 체계]
    status: { type: String, enum: ['active', 'pendingDeletion', 'deleted'], default: 'active' },
    deletionRequestedAt: { type: Date, default: null },
    deletionDueAt: { type: Date, default: null },

    // [탈퇴 관리 필드 - 호환용]
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성/관리
  }
);

// ===== 응답 변환 시 비밀번호 제거 =====
function removeSensitive(doc, ret) {
  try {
    delete ret.password;
    return ret;
  } catch (_) {
    return ret;
  }
}
userSchema.set('toJSON',  { transform: (_, ret) => removeSensitive(_, ret) });
userSchema.set('toObject', { transform: (_, ret) => removeSensitive(_, ret) });

// ===== 인덱스 (탈퇴 만기 스캔 최적화 + phoneHash)
// - phoneHash는 기존 데이터에 null/undefined가 있을 수 있으므로 sparse 권장
userSchema.index({ status: 1, deletionDueAt: 1 });
userSchema.index({ isDeleted: 1, deletionDueAt: 1 });
userSchema.index({ phoneHash: 1 }, { unique: true, sparse: true });

// ===== 인스턴스 메서드: 탈퇴 신청/취소
userSchema.methods.requestDeletion = function() {
  const now = new Date();
  this.status = 'pendingDeletion';
  this.deletionRequestedAt = now;
  this.deletedAt = now;                 // 호환 필드 동기화
  this.isDeleted = true;                // 호환 필드 동기화
  const days = retention?.DELETION_GRACE_DAYS ?? 14;
  this.deletionDueAt = new Date(now.getTime() + days * 86400000);
};

userSchema.methods.cancelDeletion = function() {
  this.status = 'active';
  this.deletionRequestedAt = null;
  this.deletionDueAt = null;
  this.deletedAt = null;                // 호환 필드 동기화
  this.isDeleted = false;               // 호환 필드 동기화
};

// ===== 정합성 훅: 저장 전 필드간 상태 동기화 (탈퇴 관련)
userSchema.pre('save', function(next) {
  try {
    // status 기준으로 호환 필드 유지
    if (this.status === 'pendingDeletion' || this.status === 'deleted') {
      this.isDeleted = true;
      if (!this.deletedAt) {
        this.deletedAt = this.deletionRequestedAt || new Date();
      }
      if (!this.deletionDueAt && this.status === 'pendingDeletion') {
        const days = retention?.DELETION_GRACE_DAYS ?? 14;
        this.deletionDueAt = new Date(Date.now() + days * 86400000);
      }
    } else {
      // active
      this.isDeleted = false;
      if (!this.deletionRequestedAt) this.deletedAt = null;
      if (!this.deletionRequestedAt) this.deletionDueAt = null;
    }
    next();
  } catch (e) {
    console.error('[User.pre.save] error:', e);
    next(e);
  }
});

// ===== 정합성 훅: 저장 전 휴대폰 정규화 + phoneHash 자동 생성/동기화
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('phone')) {
      const normalized = normalizePhoneKR(this.phone);
      if (!normalized) {
        return next(new Error('유효한 휴대폰 번호가 아닙니다.'));
      }
      this.phone = normalized;
      this.phoneHash = sha256Hex(normalized);
    } else if (!this.phoneHash && this.phone) {
      // 기존 문서 백필
      const normalized = normalizePhoneKR(this.phone);
      this.phone = normalized;
      this.phoneHash = sha256Hex(normalized);
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][phone] error:', e);
    next(e);
  }
});

// ===== 스태틱: 기존 데이터 일괄 백필용(옵션)
userSchema.statics.backfillPhoneHash = async function() {
  const batch = await this.find({ $or: [ { phoneHash: { $exists: false } }, { phoneHash: null } ] }).select('_id phone phoneHash');
  for (const doc of batch) {
    const normalized = normalizePhoneKR(doc.phone || '');
    if (!normalized) continue;
    doc.phone = normalized;
    doc.phoneHash = sha256Hex(normalized);
    await doc.save();
  }
};

module.exports = mongoose.model('User', userSchema);
