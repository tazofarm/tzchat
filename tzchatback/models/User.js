// backend/models/User.js
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
  selfintro: { type: String, default: '' },

  // [3] 검색 조건
  search_birthyear1: { type: Number, default: null },
  search_birthyear2: { type: Number, default: null },
  search_region1: { type: String, default: '전체' },
  search_region2: { type: String, default: '전체' },
  search_preference: { type: String, default: '이성친구 - 전체' },

  // [추가] 다중 검색 지역
  search_regions: [{ region1: { type: String, required: true }, region2: { type: String, required: true } }],

  // [4] 기타
  profileImage: String,
  createdAt: { type: Date, default: Date.now },
  last_login: { type: Date, default: null },

  // [5] 친구/차단
  friendlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blocklist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // [6] Emergency
  emergency: {
    type: { isActive: { type: Boolean, default: false }, activatedAt: { type: Date, default: null } },
    default: () => ({ isActive: false, activatedAt: null })
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
