const mongoose = require('mongoose');

/** Tổng XP và chuỗi ngày luyện tập liên tục của học viên. */
const dailyPracticeProfileSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  xpTotal: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastPlayedDay: { type: String, default: '' }, // YYYY-MM-DD giờ VN
  sessionsCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.DailyPracticeProfile || mongoose.model('DailyPracticeProfile', dailyPracticeProfileSchema);
