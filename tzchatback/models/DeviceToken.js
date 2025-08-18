// /server/models/DeviceToken.js
// -------------------------------------------------------------
// ✅ 사용자별 디바이스 토큰 저장 모델
// - userId: 소유자
// - token: FCM 토큰
// - platform: 'android' | 'ios' | 'web'
// - app: 'tzchat' 등 앱 구분 필요시
// -------------------------------------------------------------
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const deviceTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    app: { type: String, default: 'tzchat' },
    appVersion: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model('DeviceToken', deviceTokenSchema);
