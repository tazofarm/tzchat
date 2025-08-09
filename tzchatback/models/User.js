// backend/models/User.js

const mongoose = require('mongoose');

// ✅ User 스키마 정의
const userSchema = new mongoose.Schema({
  // [1] 기본 사용자 정보
  username: { type: String, required: true, unique: true },   // 아이디 (고유)
  password: { type: String, required: true },                 // 비밀번호 (해시저장)
  nickname: { type: String, required: true, unique: true },   // 닉네임 (고유)
  birthyear: Number,                                          // 출생년도
  gender: String,                                             // 성별

  // [2] 사용자 프로필 정보
  region1:    { type: String, default: '미지정' },             // 지역1 (시/도)
  region2:    { type: String, default: '미지정' },             // 지역2 (시/군/구)
  preference: { type: String, default: '이성친구 - 일반' },    // 특징 (이성친구 등)
  selfintro:  { type: String, default: '' },                   // 자기소개

  // [3] 검색 조건
  search_birthyear1: { type: Number, default: null },          // 검색 출생년도 from
  search_birthyear2: { type: Number, default: null },          // 검색 출생년도 to
  search_region1:    { type: String, default: '전체' },         // 검색 지역1 (기존 유지)
  search_region2:    { type: String, default: '전체' },         // 검색 지역2 (기존 유지)
  search_preference: { type: String, default: '이성친구 - 전체' }, // 검색 특징

  // ✅ ✅ ✅ [추가] 다중 검색 지역 필드
  search_regions: [
    {
      region1: { type: String, required: true },               // 예: '서울'
      region2: { type: String, required: true }                // 예: '강남구' 또는 '전체'
    }
  ],

  // [4] 기타 정보
  profileImage: String,                                      // 프로필 이미지 파일명
  createdAt:    { type: Date, default: Date.now },           // 가입 시각
  last_login:   { type: Date, default: null },               // 마지막 로그인 시각

  // [5] 친구/차단 목록
  friendlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 친구목록
  blocklist:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 차단목록

  // [6] Emergency 매칭 시스템
  emergency: {
    type: {
      isActive:    { type: Boolean, default: false },        // 긴급 매칭 활성화 여부
      activatedAt: { type: Date, default: null },            // ON 시각
    },
    default: () => ({ isActive: false, activatedAt: null })  // 기본값 보장
  }
}, {
  // [7] timestamps 옵션: createdAt, updatedAt 자동 관리
  timestamps: true
});

// ✅ 모델 내보내기
module.exports = mongoose.model('User', userSchema);
