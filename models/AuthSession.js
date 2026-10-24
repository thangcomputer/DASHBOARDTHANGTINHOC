const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  clientType: { type: String, enum: ['mobile'], required: true },
  platform: { type: String, enum: ['android', 'ios'], required: true },
  deviceLabel: { type: String, default: '' },
  appVersion: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  createdAt: { type: Date, required: true, default: Date.now },
  lastUsedAt: { type: Date, required: true, default: Date.now },
  absoluteExpiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revocationReason: { type: String, default: '' },
  refreshFamilyId: { type: String, required: true },
  currentRefreshJtiHash: { type: String, required: true },
}, { versionKey: false });

authSessionSchema.index({ userId: 1, role: 1, revokedAt: 1, lastUsedAt: -1 });
authSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.AuthSession
  || mongoose.model('AuthSession', authSessionSchema);
