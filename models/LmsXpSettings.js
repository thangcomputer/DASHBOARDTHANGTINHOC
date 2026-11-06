const mongoose = require('mongoose');

/** Một bản cấu hình XP học bài. Không đụng SystemSettings hay điểm luyện tập. */
const lmsXpSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  videoRatio: { type: Number, default: 0.9 },
  amounts: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  badges: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.models.LmsXpSettings || mongoose.model('LmsXpSettings', lmsXpSettingsSchema);
