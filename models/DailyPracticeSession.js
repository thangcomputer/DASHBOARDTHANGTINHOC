const mongoose = require('mongoose');

/** Một lượt chơi luyện tập hằng ngày (tối đa 10 câu). */
const dailyPracticeSessionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeTopic', required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeQuestion' }],
  hintsUsed: [{ type: mongoose.Schema.Types.ObjectId }],
  answers: [{
    _id: false,
    questionId: mongoose.Schema.Types.ObjectId,
    correct: Boolean,
    hintUsed: Boolean,
    xp: Number,
    answeredAt: Date,
  }],
  status: { type: String, enum: ['in_progress', 'finished'], default: 'in_progress' },
  xp: { type: Number, default: 0 },
  bonusXp: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  day: { type: String, default: '' }, // YYYY-MM-DD giờ VN lúc hoàn thành
  finishedAt: { type: Date, default: null },
}, { timestamps: true });

dailyPracticeSessionSchema.index({ studentId: 1, createdAt: -1 });
dailyPracticeSessionSchema.index({ status: 1, finishedAt: 1 });
dailyPracticeSessionSchema.index({ day: 1, status: 1 });

module.exports = mongoose.models.DailyPracticeSession || mongoose.model('DailyPracticeSession', dailyPracticeSessionSchema);
