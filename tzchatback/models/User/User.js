// backend/models/User/User.js
// ------------------------------------------------------------
// User 모델
// - 기존 구조 최대한 유지
// - [신규] 프로필 이미지 다중 관리
// - [보강] 배열 필드 default: [] 지정 (⚠ friendlist/blocklist 위치 수정)
// - [보강] 응답 변환 시 password 제거
// - [보강] 탈퇴 호환 필드 추가 (isDeleted, deletedAt) + 메서드 + 정합성 훅
// - [신규] 휴대폰 E.164 정규화 + phoneHash 자동 생성, 조회 최소화(select:false)
// - [개정] phone 유니크 인덱스: partial index로 변경(값 있을 때만 유니크)
// - [개정] 필드 단위 unique/index 제거 → 스키마 하단에서 일괄 index 정의(중복 인덱스 경고 해소)
// - [신규] 포인트 지갑(heart/star/ruby) + lastDailyGrantAt 추가
// - [보강] 가입 보너스/등급변경 보너스 지급 (config/points 연동)
// - [신규] PASS 매핑용 해시(ciHash/diHash) 추가 (원문 저장 금지)
// ------------------------------------------------------------
const mongoose = require('mongoose');
const crypto = require('crypto');
const retention = require('@/config/retention'); // DELETION_GRACE_DAYS 사용
const {
  getDailyHeartGrant,
  getHeartCap,
  isHeartAccumulable,
  getPrevGrantTimeKST,
  getSignupBonus,
  getLevelChangeBonus,
} = require('@/config/points'); // ✅ 포인트 규칙

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
/** [유틸] 한국 기본 E.164 정규화 (+ 국제번호면 그대로)
 *  ※ 실제 서비스에선 libphonenumber-js 사용 권장
 */
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
    username: { type: String, required: true },        // ← 필드 레벨 unique 제거
    password: { type: String, required: true, select: false }, // 기본적으로 응답 제외

    nickname: { type: String, required: true },        // ← 필드 레벨 unique 제거
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
    // ※ 베타기간(정식 전): default '베타회원' → 베타 종료 후 마이그레이션 스크립트에서 '일반회원'로 일괄 전환
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
    lastDailyGrantAt: { type: Date, default: null }, // 마지막 하트 지급 기준시각(KST 11:00 경계)

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
    /** phone: 선택 입력(옵션).
     *  - 필드 레벨에서 unique/sparse 지정하지 않음(중복 인덱스 경고 방지).
     *  - 인덱스는 스키마 하단에서 partial index로 정의(값 있을 때만 유니크).
     */
    phone: {
      type: String,
      required: false,
      default: undefined, // ← null 대신 undefined로 두어 "미입력"시 수정 이벤트/검증 회피
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
    isDeleted: { type: Boolean, default: false }, // ← 필드 인덱스 제거
    deletedAt: { type: Date, default: null },     // ← 필드 인덱스 제거

    // ────────────────────────────────────────────────────────
    // [신규] PASS 매핑용 해시 (CI/DI 원문 저장 금지)
    // ────────────────────────────────────────────────────────
    ciHash: { type: String, select: false },
    diHash: { type: String, select: false },
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

// ===== 인덱스 (탈퇴 만기 스캔 최적화 + phone/phoneHash + user_level)
userSchema.index({ status: 1, deletionDueAt: 1 });
userSchema.index({ isDeleted: 1, deletionDueAt: 1 });

// username / nickname 유니크는 하단 일괄 정의
userSchema.index({ username: 1 }, { unique: true, name: 'username_1' });
userSchema.index({ nickname: 1 }, { unique: true, name: 'nickname_1' });

// 선택: 개별 isDeleted/deletedAt 인덱스(운영상 필요 시 유지)
userSchema.index({ isDeleted: 1 });
userSchema.index({ deletedAt: 1 });

// phone partial unique: 값 있을 때만 유니크
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $exists: true, $ne: '' } },
    name: 'phone_1',
  }
);

// phoneHash는 값 있을 때만 유니크
userSchema.index({ phoneHash: 1 }, { unique: true, sparse: true, name: 'phoneHash_1' });

// [신규] PASS 해시 인덱스
userSchema.index({ ciHash: 1 }, { unique: true, sparse: true, name: 'ciHash_1' });
userSchema.index({ diHash: 1 }, { sparse: true, name: 'diHash_1' });

// 등급별 리스트/집계용 (권장)
userSchema.index({ user_level: 1 });

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

// ===== 정합성 훅: 회원 등급 변경 시 기본 하트 개수로 갱신
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('user_level')) {
      const level = this.user_level || '일반회원';
      const base = getDailyHeartGrant(level); // 등급 기본 하트
      const cap = getHeartCap(level);
      const accum = isHeartAccumulable(level);

      // 정책: 등급 바뀌면 "기본 하트"로 세팅
      let nextHeart = base;

      // 누적 가능 + cap 존재 → cap 내에서 보정(보통 base <= cap이지만 안전 가드)
      if (accum && Number.isFinite(cap) && cap >= 0) {
        nextHeart = Math.min(nextHeart, cap);
      }

      this.heart = Math.max(0, nextHeart);
      // lastDailyGrantAt는 변경하지 않음(일일 지급 타이밍은 pointService 규칙 적용)
    }
    next();
  } catch (e) {
    console.error('[User.pre.save][level-change] error:', e);
    next(e);
  }
});

// ===== 정합성 훅: 저장 전 휴대폰 정규화 + phoneHash 자동 생성/동기화
userSchema.pre('save', function(next) {
  try {
    if (this.isModified('phone')) {
      const raw = this.phone;

      // 값이 비었으면(삭제/미입력) 필드 제거로 처리
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

// ===== 가입 훅: 신규 가입 시 보너스 지급 + 일일지급 기준 시각 셋업
// ※ 하트는 위의 '등급 변경 훅'에서 base로 셋팅되므로, 여기서는 스타/루비만 지급합니다.
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

// ===== 보너스 훅: 등급 변경 시 스타/루비 보너스 지급(신규 문서 제외)
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

// ===== 스태틱: 기존 데이터 일괄 백필용(옵션)
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
