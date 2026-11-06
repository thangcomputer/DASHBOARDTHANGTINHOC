const mongoose = require('mongoose');

/** XP học bài của LMS. Tách khỏi DailyPracticeProfile (điểm luyện tập hằng ngày). */
const lmsLearnerProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  xpTotal: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastStudyDay: { type: String, default: '' },
  streakStartedOn: { type: String, default: '' },
  levelUps: {
    type: [{
      level: Number,
      title: String,
      at: Date,
    }],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.models.LmsLearnerProgress || mongoose.model('LmsLearnerProgress', lmsLearnerProgressSchema);
