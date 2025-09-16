// backend/models/User.js
// ------------------------------------------------------------
// User 모델
// - 기존 구조 최대한 유지
// - [신규] 프로필 이미지 다중 관리
//    * profileImages: [{ id, kind, aspect, urls:{thumb,medium,full}, createdAt }]
//    * profileMain  : String (대표 이미지의 id)
// - [7] 누적 카운터 3종 (기존 설명 유지)
// - [보강] 배열 필드 default: [] 지정 (null/undefined 방지)
// - [보강] 응답 변환 시 password 제거(toJSON/toObject transform)
// ------------------------------------------------------------
const mongoose = require('mongoose');

// ────────────────────────────────────────────────────────────
// [서브스키마] 프로필 이미지 문서 구조
//  - id: 파일 식별자(UUID hex 32자리 예상)
//  - kind: 'avatar' | 'gallery'  (대표용/갤러리용 구분)
//  - aspect: 1(1:1) 또는 0.8(=4/5) 등 서버 표준화 시 사용
//  - urls: 썸네일/중간/최대(최적화본) 상대경로 저장 (예: /uploads/profile/<userId>/<id>_thumb.jpg)
//  - createdAt: 등록 시각
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

const userSchema = new mongoose.Schema(
  {
    // [0] 권한/상태
    role: { type: String, enum: ['user', 'master'], default: 'user' }, // 관리자 권한
    suspended: { type: Boolean, default: false },                       // 계정 잠금 여부

    // [1] 기본 정보
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // ※ 보안: 응답 변환 시 제거(아래 transform 참고)
    nickname: { type: String, required: true, unique: true },
    birthyear: Number,
    gender: String, // 예: '남', '여' 등 (기존 값 유지)

    // [2] 프로필
    region1: { type: String, default: '미지정' },
    region2: { type: String, default: '미지정' },
    preference: { type: String, default: '이성친구 - 일반' },
    marriage: { type: String, default: '싱글' }, // 예: '싱글', '기혼', '돌싱' 등 (기존 값 유지)
    selfintro: { type: String, default: '' },

    // 🔽 [신규] 프로필 이미지 다중 관리 필드
    //  - profileImages: 썸네일/중간/풀 3종 URL을 가진 객체 배열
    //  - profileMain: 대표 이미지의 id (없으면 빈 문자열)
    profileImages: { type: [ProfileImageSchema], default: [] },
    profileMain:   { type: String, default: '' },

    // [3] 검색 조건
    search_birthyear1: { type: Number, default: null },
    search_birthyear2: { type: Number, default: null },
    search_region1: { type: String, default: '전체' },
    search_region2: { type: String, default: '전체' },
    search_preference: { type: String, default: '이성친구 - 전체' },
    search_marriage: { type: String, default: '전체' },

    // ===== 유료회원 관련 =====
    // [등급: 기본은 성별에 따라 회원가입 로직에서 세팅 권장]
    user_level: { type: String, default: '일반회원' },

    // [유료 관리용 누적 카운터]
    refundCountTotal: { type: Number, default: 0, min: 0 }, // 환불 남용 방지용

    // [추가] 다중 검색 지역 (보강: default: [])
    search_regions: [{
      region1: { type: String, required: true },
      region2: { type: String, required: true }
    }],

    // [4] 기타
    // (레거시 단일 프로필 이미지: 호환을 위해 남겨둠. 신규 로직은 profileImages/profileMain 사용)
    profileImage: String,
    // (참고) 아래 {timestamps:true}와 createdAt 중복 선언 가능하지만, 기존 구조 유지
    createdAt: { type: Date, default: Date.now },
    last_login: { type: Date, default: null },

    // [5] 친구/차단 (보강: default: [])
    friendlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blocklist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // [6] Emergency
    emergency: {
      type: {
        isActive: { type: Boolean, default: false },
        activatedAt: { type: Date, default: null }
      },
      default: () => ({ isActive: false, activatedAt: null })
    },

    // ===== 샘플/검색용 확장 필드 (기존 유지) =====
    example01: { type: String, default: '일반' },
    search_example01: { type: String, default: '전체' },

    example02: { type: String, default: '일반' },
    search_example02: { type: String, default: '전체' },

    example03: { type: String, default: '일반' },
    search_example03: { type: String, default: '전체' },

    example04: { type: String, default: '일반' },
    search_example04: { type: String, default: '전체' },

    example05: { type: String, default: '일반' },
    search_example05: { type: String, default: '전체' },

    example06: { type: String, default: '일반' },
    search_example06: { type: String, default: '전체' },

    // [7] 누적 카운터 (★ 이벤트 시점에 $inc로만 증가)
    //  - 친구 신청 생성 시:
    //       from(신청자).sentRequestCountTotal += 1
    //       to(수신자).receivedRequestCountTotal += 1
    //  - 친구 신청 "수락" 시(처음 accepted 될 때 1회만):
    //       당사자 두 명 모두 acceptedChatCountTotal += 1
    sentRequestCountTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    receivedRequestCountTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    acceptedChatCountTotal: {
      type: Number,
      default: 0,
      min: 0
    },

    // 🔽 [탈퇴 관리 필드]
    status: { type: String, enum: ['active', 'pendingDeletion', 'deleted'], default: 'active' },
    deletionRequestedAt: { type: Date, default: null },  // 탈퇴 신청 시각
    deletionDueAt: { type: Date, default: null },        // 영구 삭제 예정일
  },
  {
    timestamps: true // createdAt/updatedAt 자동 관리(기존 유지)
  }
);

// ===== [보강] 안전한 기본값 세팅 (배열 필드) =====
// null/undefined로 내려오는 경우를 방지하여 .push/.some 수행 시 오류 예방
if (!userSchema.path('friendlist').options.default) {
  userSchema.path('friendlist').options.default = [];
}
if (!userSchema.path('blocklist').options.default) {
  userSchema.path('blocklist').options.default = [];
}
if (!userSchema.path('search_regions').options.default) {
  userSchema.path('search_regions').options.default = [];
}
if (!userSchema.path('profileImages').options.default) {
  userSchema.path('profileImages').options.default = [];
}

// ===== [보강] 응답 변환 시 비밀번호 제거 =====
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

// (선택) 자주 조회되는 컬럼 인덱스 가이드
// userSchema.index({ username: 1 }, { unique: true }); // 이미 unique 옵션 존재
// userSchema.index({ nickname: 1 }, { unique: true }); // 이미 unique 옵션 존재
// ※ profileImages.id 조회가 잦다면 아래 인덱스를 고려할 수 있습니다.
// userSchema.index({ 'profileImages.id': 1 });

module.exports = mongoose.model('User', userSchema);
