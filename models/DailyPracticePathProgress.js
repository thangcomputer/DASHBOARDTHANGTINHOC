const mongoose = require('mongoose');

/** Tiến độ của học viên trên một chặng lộ trình luyện tập. */
const dailyPracticePathProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeTopic', required: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeUnit', required: true },
  completedSteps: { type: [String], default: [] },
  /** Tiến độ từng phần học: `${nodeKey}:${difficulty}:${sectionKey}` (ví dụ bai-1:easy:content). */
  completedSections: { type: [String], default: [] },
  watchedVideoIds: { type: [String], default: [] },
  /** Mốc video đã qua: `${videoId}:${checkId}`. */
  passedVideoChecks: { type: [String], default: [] },
  /** Qua bài kiểm tra chặng (hoặc kiểm tra vượt) → mở chặng kế tiếp. */
  completedAt: { type: Date, default: null },
  /** Đã nhận thưởng rương chặng (+UNIT_CHEST_REWARD_XP). */
  chestClaimedAt: { type: Date, default: null },
  testedOut: { type: Boolean, default: false },
}, { timestamps: true });

dailyPracticePathProgressSchema.index({ studentId: 1, unitId: 1 }, { unique: true });
dailyPracticePathProgressSchema.index({ studentId: 1, topicId: 1 });

module.exports = mongoose.models.DailyPracticePathProgress
  || mongoose.model('DailyPracticePathProgress', dailyPracticePathProgressSchema);
