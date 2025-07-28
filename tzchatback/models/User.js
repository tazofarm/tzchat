// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  nickname: { type: String, required: true, unique: true },
  birthyear: Number,
  gender: String,


   // 사용자 정보
  region1: { type: String, default: '미지정' },
  region2: { type: String, default: '미지정' },
  preference: { type: String, default: '이성친구 - 일반' },
  selfintro: { type: String, default: '' },

  // 검색 조건
  search_birthyear1: { type: String, default: '전체' },
  search_birthyear2: { type: String, default: '전체' },
  search_region1: { type: String, default: '전체' },
  search_region2: { type: String, default: '전체' },
  search_preference: { type: String, default: '이성친구 - 전체' },


  profileImage: String,
  createdAt: { type: Date, default: Date.now },
  last_login: { type: Date, default: null },



 //친구 


 
  friendlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blocklist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],


  
}

,
  {
    timestamps: true, // ✅ 여기로 분리
  }
);

module.exports = mongoose.model('User', userSchema);
