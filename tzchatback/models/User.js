// backend/models/User.js
// ------------------------------------------------------------
// User 모델
// - 기존 구조 최대한 유지
// - [7] 누적 카운터 3종 추가:
//    1) sentRequestCountTotal     : 내가 "보낸" 친구 신청 누적합
//    2) receivedRequestCountTotal : 내가 "받은" 친구 신청 누적합
//    3) acceptedChatCountTotal    : "친구 신청 수락(채팅 생성)" 누적합
// ------------------------------------------------------------
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // [0] 권한/상태
  role: { type: String, enum: ['user', 'master'], default: 'user' },   // 관리자 권한
  suspended: { type: Boolean, default: false },                         // 계정 잠금 여부

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
  marriage: { type: String, default: '싱글' },
  selfintro: { type: String, default: '' },

  // [3] 검색 조건
  search_birthyear1: { type: Number, default: null },
  search_birthyear2: { type: Number, default: null },
  search_region1: { type: String, default: '전체' },
  search_region2: { type: String, default: '전체' },
  search_preference: { type: String, default: '이성친구 - 전체' },
  search_marriage: { type: String, default: '전체' },


 // 유료회원

  // [등급: 기본은 성별에 따라 회원가입 로직에서 세팅 권장]
  user_level: { type: String, default: '일반회원' },

  // [유료 관리용 누적 카운터]
  refundCountTotal: { type: Number, default: 0, min: 0 }, // 환불 남용 방지용


  // [추가] 다중 검색 지역
  search_regions: [{
    region1: { type: String, required: true },
    region2: { type: String, required: true }
  }],

  // [4] 기타
  profileImage: String,
  createdAt: { type: Date, default: Date.now }, // (참고) 아래 {timestamps:true}와 중복될 수 있으나 기존 유지
  last_login: { type: Date, default: null },

  // [5] 친구/차단
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

// 미리 만들어 놓는 샘플
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


  // [7] 누적 카운터 (★ 신규 추가: 이벤트 시점에 $inc로만 증가)
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
  }

}, { timestamps: true }); // createdAt/updatedAt 자동 관리(기존 유지)

module.exports = mongoose.model('User', userSchema);
