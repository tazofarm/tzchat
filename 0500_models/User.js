// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nickname: { type: String, required: true, unique: true },
    birthyear: { type: Number, required: true },
    gender: { type: String, required: true },
    region1: { type: String, required: true },
    region2: { type: String, required: true },
    preference: { type: String, required: true },
    selfintro: { type: String, default: "" }, // 장문 자기소개 설정
    selfpremium: { type: Number, default : 0 },

    searchpreference: { type: String, default: "이성1" },
    searchbirthyear1: { type: mongoose.Schema.Types.Mixed, default: "전체" },
    searchbirthyear2: { type: mongoose.Schema.Types.Mixed, default: "전체" },
    searchregion1: { type: String, default: "전체" },
    searchregion2: { type: String, default: "전체" },

    friendlist: { type: [String], default: [] }, // 친구 리스트
    blocklist: { type: [String], default: [] }, // 차단 리스트

    // ✅ 프로필 이미지 필드 추가
    profileImage: {
        type: String,
        default: function () {
            return this.gender === 'female'
                ? '/images/default_woman.jpg'
                : '/images/default_man.jpg';
        }
    },

    // 추가된 채팅 관련 필드
    created_at: { type: Date, default: Date.now },
    last_login: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;