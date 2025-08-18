// models/Notice.js
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
