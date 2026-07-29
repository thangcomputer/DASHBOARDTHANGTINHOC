/**
 * PasswordProvisionLog — lịch sử cấp mật khẩu (không lưu plaintext).
 * ADR / Phase 2.
 */
const mongoose = require('mongoose');

const PasswordProvisionLogSchema = new mongoose.Schema(
  {
    targetUserId: { type: String, required: true, index: true },
    targetRole: { type: String, enum: ['student', 'teacher'], required: true },
    targetName: { type: String, default: '' },
    mode: { type: String, enum: ['manual', 'auto'], required: true },
    actorUserId: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    channelsQueued: {
      zalo: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      notification: { type: Boolean, default: false },
    },
    queueJobId: { type: String, default: '' },
    ip: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

PasswordProvisionLogSchema.index({ createdAt: -1 });
PasswordProvisionLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model('PasswordProvisionLog', PasswordProvisionLogSchema);
