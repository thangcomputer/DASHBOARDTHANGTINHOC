const mongoose = require('mongoose');

/** Mã kích hoạt gói tài khoản HV - admin phát hành theo lô, mỗi mã dùng một lần. */
const activationCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  plan: { type: String, enum: ['1m', '3m', '6m', '12m', 'lifetime'], required: true },
  status: { type: String, enum: ['unused', 'used', 'revoked'], default: 'unused', index: true },
  batchId: { type: String, default: '', index: true },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  createdBy: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  usedByName: { type: String, default: '' },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

activationCodeSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.ActivationCode || mongoose.model('ActivationCode', activationCodeSchema);
