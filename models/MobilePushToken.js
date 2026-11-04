const mongoose = require('mongoose');

const mobilePushTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  sessionId: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  projectId: { type: String, default: '' },
  soundEnabled: { type: Boolean, default: true },
  enabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

mobilePushTokenSchema.index({ userId: 1, role: 1 });
mobilePushTokenSchema.index({ sessionId: 1 });

module.exports = mongoose.models.MobilePushToken
  || mongoose.model('MobilePushToken', mobilePushTokenSchema);
