// backend/models/User/User.js
// ------------------------------------------------------------
// User 모델
// - 기존 구조 유지 + 휴대폰 정규화/해시 자동화
// - 프로필 이미지 다중 관리
// - friendlist/blocklist 기본값 보강
// - 응답 변환 시 민감정보 제거
// - 탈퇴 상태 정합성 훅
// - 포인트 지갑 및 가입/등급 변경 보너스 반영
// - PASS 해시는 User에는 '참조용(select:false)'으로만 유지
//   ※ CI/DI의 '정본(고유성)'은 PassIdentity에서 관리합니다.
// ------------------------------------------------------------
const mongoose = require('mongoose');
const crypto = require('crypto');
const retention = require('@/config/retention'); // DELETION_GRACE_DAYS
const {
  getDailyHeartGrant,
  getHeartCap,
  isHeartAccumulable,
  getPrevGrantTimeKST,
  getSignupBonus,
  getLevelChangeBonus,
} = require('@/config/points');

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
// 유틸
// ────────────────────────────────────────────────────────────
/** 한국 번호 E.164 정규화
 *  - '+82' 또는 타국가 '+' 시작 → 그대로
 *  - '0' 시작 → '+82' + 나머지
 *  - '82'로 시작(플러스 없음) → '+' 붙여 정규화
 *  - 그 외 숫자만 주어진 경우 → '+82' 접두
 *  ※ 실제 서비스에서는 libphonenumber-js 사용 권장
 */
function normalizePhoneKR(raw = '') {
  const clean = String(raw).replace(/[^\d+]/g, '');
  if (!clean) return '';
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('0')) return '+82' + clean.slice(1);
  if (clean.startsWith('82')) return '+' + clean;
  return '+82' + clean;
}
function sha256Hex(text = '') {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

// ────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // [0] 권한/상태
    role: { type: String, enum: ['user', 'master'], default: 'user' },
    suspended: { type: Boolean, default: false },

    // [1] 기본 정보
    username: { type: String, required: true },                // 인덱스는 하단에서 일괄
    password: { type: String, required: true, select: false }, // 기본 응답 제외
    nickname: { type: String, required: true },                // 인덱스는 하단에서 일괄
    birthyear: Number,
    gender: String,

    // [2] 프로필
    region1: { type: String, default: '미지정' },
    region2: { type: String, default: '미지정' },
    preference: { type: String, default: '이성친구 - 일반' },
    selfintro: { type: String, default: '' },

    // 프로필 이미지 다중 관리
    profileImages: { type: [ProfileImageSchema], default: [] },
    profileMain:   { type: String, default: '' },

    // [3] 검색 조건
    search_birthyear1: { type: Number, default: null },
    search_birthyear2: { type: Number, default: null },
    search_region1: { type: String, default: '전체' },
    search_region2: { type: String, default: '전체' },
    search_preference: { type: String, default: '이성친구 - 전체' },

    // 유료회원 관련
    user_level: { 
      type: String, 
      enum: ['베타회원', '일반회원', '라이트회원', '프리미엄회원'],
      default: '베타회원'
    },
    refundCountTotal: { type: Number, default: 0, min: 0 },

    // [신규] 포인트 지갑
    heart: { type: Number, default: 0, min: 0 }, // 하트(무료/일일지급)
    star:  { type: Number, default: 0, min: 0 }, // 스타(보상/출석·이벤트)
    ruby:  { type: Number, default: 0, min: 0 }, // 루비(유료/구매)
    lastDailyGrantAt: { type: Date, default: null }, // 마지막 하트 지급 기준시각(KST 11:00)

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
    // 휴대폰/연락처 해시
    // ────────────────────────────────────────────────────────
    /** phone: 선택 입력
     *  - 필드 레벨 unique/sparse 미지정(중복 인덱스 경고 방지)
     *  - 인덱스는 하단에서 partial unique로 정의
     */
    phone: {
      type: String,
      required: false,
      default: undefined, // 미입력 시 undefined로 유지
      trim: true,
    },
    /** phoneHash: 응답 기본 제외, 인덱스는 하단에서 정의 */
    phoneHash: {
      type: String,
      select: false, // 기본 응답에서 제외
    },  // SHA-256(E.164)

    localContactHashes: {
      type: [String],
      default: [],
      select: false, // 기본 응답에서 제외
    }, // SHA-256(E.164) 배열

    // 스위치: "ON"/"OFF"
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
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // ────────────────────────────────────────────────────────
    // PASS 해시 (참조용; 정본/고유성은 PassIdentity에서 관리)
    // ────────────────────────────────────────────────────────
    ciHash: { type: String, select: false },
    diHash: { type: String, select: false },
  },
  {
    timestamps: true,
  }
);

// ────────────────────────────────────────────────────────────
// 응답 변환: 민감정보 제거
// ────────────────────────────────────────────────────────────
function removeSensitive(doc, ret) {
  try {
    delete ret.password;
    // select:false 필드는 기본적으로 내려가지 않지만,
    // 혹시나 변환 과정에서 포함되면 제거
    delete ret.phoneHash;
    delete ret.ciHash;
    delete ret.diHash;
    delete ret.localContactHashes;
    return ret;
  } catch (_) {
    return ret;
  }
}
userSchema.set('toJSON',  { transform: (_, ret) => removeSensitive(_, ret) });
userSchema.set('toObject', { transform: (_, ret) => removeSensitive(_, ret) });

// ────────────────────────────────────────────────────────────
// 인덱스
// ────────────────────────────────────────────────────────────
userSchema.index({ status: 1, deletionDueAt: 1 });
userSchema.index({ isDeleted: 1, deletionDueAt: 1 });

// username / nickname 유니크
userSchema.index({ username: 1 }, { unique: true, name: 'username_1' });
userSchema.index({ nickname: 1 }, { unique: true, name: 'nickname_1' });

// 운영상 필요 시
userSchema.index({ isDeleted: 1 });
userSchema.index({ deletedAt: 1 });

// phone: partial unique (값 있을 때만 유니크)
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true, $ne: '' } },
    name: 'phone_1',
  }
);

// phoneHash: 값 있을 때만 유니크(sparse)
//  - 연락처 제외/매칭을 위한 고속 비교용
userSchema.index({ phoneHash: 1 }, { unique: true, sparse: true, name: 'phoneHash_1' });

// PASS 해시: 조회 최적화용 일반 인덱스(고유성은 PassIdentity가 보장)
userSchema.index({ ciHash: 1 }, { sparse: true, name: 'ciHash_idx' });
userSchema.index({ diHash: 1 }, { sparse: true, name: 'diHash_idx' });

// 등급별 리스트/집계용
userSchema.index({ user_level: 1 });

// ────────────────────────────────────────────────────────────
// 메서드/훅
// ────────────────────────────────────────────────────────────

// 탈퇴 신청/취소
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

// 저장 전: 탈퇴 정합성
userSchema.pre('save', function(next) {
  try {
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

// 저장 전: 회원 등급 변경 시 기본 하트 갱신
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('user_level')) {
      const level = this.user_level || '일반회원';
      const base = getDailyHeartGrant(level);
      const cap = getHeartCap(level);
      const accum = isHeartAccumulable(level);

      let nextHeart = base;
      if (accum && Number.isFinite(cap) && cap >= 0) {
        nextHeart = Math.min(nextHeart, cap);
      }
      this.heart = Math.max(0, nextHeart);
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][level-change] error:', e);
    next(e);
  }
});

// 저장 전: 휴대폰 정규화 + phoneHash 자동 생성/동기화
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('phone')) {
      const raw = this.phone;

      // 비었으면 제거
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        this.phone = undefined;
        this.phoneHash = undefined;
        return next();
      }

      const normalized = normalizePhoneKR(raw);
      if (!normalized) {
        return next(new Error('유효한 휴대폰 번호가 아닙니다.'));
      }
      this.phone = normalized;
      this.phoneHash = sha256Hex(normalized);
    } else if (!this.phoneHash && this.phone) {
      // 기존 문서 백필
      const normalized = normalizePhoneKR(this.phone);
      if (normalized) {
        this.phone = normalized;
        this.phoneHash = sha256Hex(normalized);
      } else {
        this.phone = undefined;
        this.phoneHash = undefined;
      }
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][phone] error:', e);
    next(e);
  }
});

// 가입 훅: 스타/루비 보너스 + 일일지급 기준시각 셋업
userSchema.pre('save', function(next) {
  try {
    if (this.isNew) {
      const level = this.user_level || '일반회원';
      const bonus = getSignupBonus(level) || {};
      const addStar = Number(bonus.star || 0);
      const addRuby = Number(bonus.ruby || 0);

      this.star = Math.max(0, (Number(this.star || 0) + addStar));
      this.ruby = Math.max(0, (Number(this.ruby || 0) + addRuby));

      // 다음 11:00부터 일일 지급이 시작되도록, 기준시각을 "직전 11:00 KST"로 설정
      this.lastDailyGrantAt = getPrevGrantTimeKST(new Date());
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][signup-bonus] error:', e);
    next(e);
  }
});

// 등급 변경 보너스(신규 문서 제외)
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('user_level') && !this.isNew) {
      const level = this.user_level || '일반회원';
      const bonus = getLevelChangeBonus(level) || {};
      const addStar = Number(bonus.star || 0);
      const addRuby = Number(bonus.ruby || 0);

      this.star = Math.max(0, (Number(this.star || 0) + addStar));
      this.ruby = Math.max(0, (Number(this.ruby || 0) + addRuby));
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][level-change-bonus] error:', e);
    next(e);
  }
});

// 스태틱: 기존 데이터 일괄 백필용(옵션)
userSchema.statics.backfillPhoneHash = async function() {
  const batch = await this.find({
    $or: [ { phoneHash: { $exists: false } }, { phoneHash: null } ]
  }).select('_id phone phoneHash');

  for (const doc of batch) {
    const normalized = normalizePhoneKR(doc.phone || '');
    if (!normalized) {
      doc.phone = undefined;
      doc.phoneHash = undefined;
      await doc.save();
      continue;
    }
    doc.phone = normalized;
    doc.phoneHash = sha256Hex(normalized);
    await doc.save();
  }
};

module.exports = mongoose.model('User', userSchema);
