const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userid: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true },
    gender: { type: String, enum: ['gender_man', 'gender_woman'], required: true },
    area_parent: { type: String, required: true },
    area_child: { type: String, required: true },
    partner_list: { type: [String], default: [] },
    block_list: { type: [String], default: [] },
    waiting_list: { type: [String], default: [] },
});

// 모델 생성
const User = mongoose.model('User', userSchema);

module.exports = User;