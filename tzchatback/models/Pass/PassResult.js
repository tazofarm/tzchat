// backend/models/Pass/PassResult.js
const mongoose = require('mongoose');

const PassResultSchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, default: 'Danal' },
    status: { type: String, enum: ['pending', 'success', 'fail'], default: 'pending', index: true },
    failCode: { type: String, default: null },

    name: { type: String, default: '' }, // 마스킹된 이름 권장
    birthyear: { type: Number, default: null },
    gender: { type: String, enum: ['man', 'woman', ''], default: '' },
    phone: { type: String, default: '' }, // E.164
    carrier: { type: String, default: '' },

    ciHash: { type: String, index: true },
    diHash: { type: String, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    rawMasked: { type: Object, default: {} },
  },
  { timestamps: true }
);

PassResultSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PassResult', PassResultSchema);
