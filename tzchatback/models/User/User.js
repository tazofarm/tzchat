// backend/models/User/User.js
// ------------------------------------------------------------
// User 모델
// - 휴대폰 정규화/해시 자동화
// - ✅ 전화번호 중복 가입 허용 정책 반영: phone/phoneHash UNIQUE 제거
// - ✅ carrier / phoneVerifiedAt / phoneVerifiedBy 필드 추가 (프론트 표시/검증용)
// - ✅ phoneMasked / phoneFormatted 가상필드 제공 (프론트에서 기대하는 경우 대비)
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
/** 한국 번호 E.164 정규화 */
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

// E.164(+82...) → 010xxxxxxxx 형태로 변환(가능할 때만)
function toKRLocalDigits(e164 = '') {
  const p = String(e164 || '');
  if (!p) return '';
  if (p.startsWith('+82')) {
    // +8210xxxxxxxx → 010xxxxxxxx
    const rest = p.slice(3);
    if (!rest) return '';
    return '0' + rest;
  }
  return p;
}
function maskPhoneDigitsKR(localDigits = '') {
  // 010xxxxxxxx 또는 01x...
  const s = String(localDigits || '').replace(/[^\d]/g, '');
  if (s.length < 7) return s;
  // 마지막 2~4자리만 남기고 중간 마스킹
  // 010 + (중간) + (끝 2~4)
  const last = s.slice(-2);
  const head = s.slice(0, 3);
  const midLen = Math.max(0, s.length - head.length - last.length);
  return `${head} ${'*'.repeat(midLen)} ${last}`.replace(/\s+/g, ' ');
}

// ────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // [0] 권한/상태
    role: { type: String, enum: ['user', 'master'], default: 'user' },
    suspended: { type: Boolean, default: false },

    // [1] 기본 정보
    username: { type: String, required: true },
    password: { type: String, required: true, select: false },
    nickname: { type: String, required: true },
    birthyear: Number,
    gender: String,

    // [2] 프로필
    region1: { type: String, default: '미지정' },
    region2: { type: String, default: '미지정' },
    preference: { type: String, default: '이성친구 - 일반' },
    selfintro: { type: String, default: '' },

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

    // 포인트 지갑
    heart: { type: Number, default: 0, min: 0 },
    star:  { type: Number, default: 0, min: 0 },
    ruby:  { type: Number, default: 0, min: 0 },
    lastDailyGrantAt: { type: Date, default: null },

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
    // ✅ 휴대폰/통신사/검증 메타
    // ────────────────────────────────────────────────────────
    phone: {
      type: String,
      required: false,
      default: undefined,
      trim: true,
    },

    // ✅ 통신사: authRouter에서 넣고 있으니 스키마에 반드시 있어야 저장됨
    carrier: { type: String, default: '' },

    // ✅ 검증 메타(없으면 저장이 안되니 스키마에 추가)
    phoneVerifiedAt: { type: Date, default: null },
    phoneVerifiedBy: { type: String, default: '' }, // 'PASS' 등

    // 고속 비교용 해시(중복 허용 정책이므로 UNIQUE 금지)
    phoneHash: {
      type: String,
      select: false,
    },

    localContactHashes: {
      type: [String],
      default: [],
      select: false,
    },

    // 스위치들
    search_disconnectLocalContacts: { type: String, default: 'OFF' },
    search_allowFriendRequests:     { type: String, default: 'OFF' },
    search_allowNotifications:      { type: String, default: 'OFF' },
    search_onlyWithPhoto:           { type: String, default: 'OFF' },
    search_matchPremiumOnly:        { type: String, default: 'OFF' },

    marriage: { type: String, default: '미혼' },
    search_marriage: { type: String, default: '전체' },

    // [7] 누적 카운터
    sentRequestCountTotal: { type: Number, default: 0, min: 0 },
    receivedRequestCountTotal: { type: Number, default: 0, min: 0 },
    acceptedChatCountTotal: { type: Number, default: 0, min: 0 },

    // 탈퇴 관리
    status: { type: String, enum: ['active', 'pendingDeletion', 'deleted'], default: 'active' },
    deletionRequestedAt: { type: Date, default: null },
    deletionDueAt: { type: Date, default: null },

    // 호환용
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // PASS 해시 (참조용)
    ciHash: { type: String, select: false },
    diHash: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────────────────
// ✅ 가상필드: phoneFormatted / phoneMasked
// (프론트에서 me.phoneMasked / me.phoneFormatted 를 기대하는 경우 대비)
// ────────────────────────────────────────────────────────────
userSchema.virtual('phoneFormatted').get(function () {
  const local = toKRLocalDigits(this.phone || '');
  return local || '';
});
userSchema.virtual('phoneMasked').get(function () {
  const local = toKRLocalDigits(this.phone || '');
  if (!local) return '';
  return maskPhoneDigitsKR(local);
});

// ────────────────────────────────────────────────────────────
// 응답 변환: 민감정보 제거
// ────────────────────────────────────────────────────────────
function removeSensitive(_doc, ret) {
  try {
    delete ret.password;
    delete ret.phoneHash;
    delete ret.ciHash;
    delete ret.diHash;
    delete ret.localContactHashes;
    return ret;
  } catch (_) {
    return ret;
  }
}
userSchema.set('toJSON',  { virtuals: true, transform: removeSensitive });
userSchema.set('toObject', { virtuals: true, transform: removeSensitive });

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

// ✅ phone / phoneHash 는 “중복 허용” 정책: UNIQUE 제거하고 일반 인덱스만
userSchema.index(
  { phone: 1 },
  {
    name: 'phone_1',
    partialFilterExpression: { phone: { $exists: true, $ne: '' } },
  }
);
userSchema.index({ phoneHash: 1 }, { sparse: true, name: 'phoneHash_1' });

// PASS 해시 조회 최적화용
userSchema.index({ ciHash: 1 }, { sparse: true, name: 'ciHash_idx' });
userSchema.index({ diHash: 1 }, { sparse: true, name: 'diHash_idx' });

// 등급별
userSchema.index({ user_level: 1 });

// ────────────────────────────────────────────────────────────
// 메서드/훅
// ────────────────────────────────────────────────────────────
userSchema.methods.requestDeletion = function() {
  const now = new Date();
  this.status = 'pendingDeletion';
  this.deletionRequestedAt = now;
  this.deletedAt = now;
  this.isDeleted = true;
  const days = retention?.DELETION_GRACE_DAYS ?? 14;
  this.deletionDueAt = new Date(now.getTime() + days * 86400000);
};

userSchema.methods.cancelDeletion = function() {
  this.status = 'active';
  this.deletionRequestedAt = null;
  this.deletionDueAt = null;
  this.deletedAt = null;
  this.isDeleted = false;
};

// 탈퇴 정합성
userSchema.pre('save', function(next) {
  try {
    if (this.status === 'pendingDeletion' || this.status === 'deleted') {
      this.isDeleted = true;
      if (!this.deletedAt) this.deletedAt = this.deletionRequestedAt || new Date();
      if (!this.deletionDueAt && this.status === 'pendingDeletion') {
        const days = retention?.DELETION_GRACE_DAYS ?? 14;
        this.deletionDueAt = new Date(Date.now() + days * 86400000);
      }
    } else {
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

// 등급 변경 시 하트 갱신
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

// ✅ 휴대폰 정규화 + phoneHash 생성
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('phone')) {
      const raw = this.phone;

      if (raw === undefined || raw === null || String(raw).trim() === '') {
        this.phone = undefined;
        this.phoneHash = undefined;
        return next();
      }

      const normalized = normalizePhoneKR(raw);
      if (!normalized) return next(new Error('유효한 휴대폰 번호가 아닙니다.'));

      this.phone = normalized;
      this.phoneHash = sha256Hex(normalized);
    } else if (!this.phoneHash && this.phone) {
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

// 가입 보너스
userSchema.pre('save', function(next) {
  try {
    if (this.isNew) {
      const level = this.user_level || '일반회원';
      const bonus = getSignupBonus(level) || {};
      const addStar = Number(bonus.star || 0);
      const addRuby = Number(bonus.ruby || 0);

      this.star = Math.max(0, (Number(this.star || 0) + addStar));
      this.ruby = Math.max(0, (Number(this.ruby || 0) + addRuby));

      this.lastDailyGrantAt = getPrevGrantTimeKST(new Date());
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][signup-bonus] error:', e);
    next(e);
  }
});

// 등급 변경 보너스
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

// 백필 옵션
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
