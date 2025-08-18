// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['open', 'warned', 'blocked', 'dismissed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
