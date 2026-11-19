const mongoose = require('mongoose');

const DEFAULT_NOTIFICATION_PREFERENCES = {
  scheduleReminders: true,
  scheduleChanges: true,
  messages: true,
  calls: true,
  adminAnnouncements: true,
  assignmentsAndQuizzes: true,
  financeAndCourses: true,
  reminderOffsetsMinutes: [1440, 60, 15],
};

const notificationPreferencesSchema = new mongoose.Schema({
  scheduleReminders: { type: Boolean, default: true },
  scheduleChanges: { type: Boolean, default: true },
  messages: { type: Boolean, default: true },
  calls: { type: Boolean, default: true },
  adminAnnouncements: { type: Boolean, default: true },
  assignmentsAndQuizzes: { type: Boolean, default: true },
  financeAndCourses: { type: Boolean, default: true },
  reminderOffsetsMinutes: {
    type: [Number],
    default: () => [1440, 60, 15],
  },
}, { _id: false });

const mobilePushTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  sessionId: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  projectId: { type: String, default: '' },
  soundEnabled: { type: Boolean, default: true },
  enabled: { type: Boolean, default: true },
  preferences: {
    type: notificationPreferencesSchema,
    default: () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }),
  },
  updatedAt: { type: Date, default: Date.now },
});

mobilePushTokenSchema.index({ userId: 1, role: 1 });
mobilePushTokenSchema.index({ sessionId: 1 });

const MobilePushToken = mongoose.models.MobilePushToken
  || mongoose.model('MobilePushToken', mobilePushTokenSchema);

module.exports = MobilePushToken;
module.exports.DEFAULT_NOTIFICATION_PREFERENCES = DEFAULT_NOTIFICATION_PREFERENCES;
