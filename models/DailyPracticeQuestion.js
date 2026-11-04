const mongoose = require('mongoose');

/**
 * Câu hỏi luyện tập hằng ngày. Dữ liệu đáp án theo dạng:
 * - mcq: options + correctIndex
 * - truefalse: answerBool
 * - order: items (đúng thứ tự)
 * - match: pairs [{ left, right }]
 * - fill: text có chỗ trống dạng {{từ}} + distractors (từ gây nhiễu)
 * - sort: groups [{ name, items }]
 */
const dailyPracticeQuestionSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyPracticeTopic', required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  type: { type: String, enum: ['mcq', 'truefalse', 'order', 'match', 'fill', 'sort'], required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  source: { type: String, enum: ['manual', 'ai', 'starter'], default: 'manual' },
  prompt: { type: String, required: true, trim: true, maxlength: 600 },
  imageUrl: { type: String, default: '' },
  explanation: { type: String, default: '', trim: true, maxlength: 800 },
  hint: { type: String, default: '', trim: true, maxlength: 300 },
  options: { type: [String], default: undefined },
  correctIndex: { type: Number, default: undefined },
  answerBool: { type: Boolean, default: undefined },
  items: { type: [String], default: undefined },
  pairs: { type: [{ _id: false, left: String, right: String }], default: undefined },
  text: { type: String, default: undefined },
  distractors: { type: [String], default: undefined },
  groups: { type: [{ _id: false, name: String, items: [String] }], default: undefined },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

dailyPracticeQuestionSchema.index({ topicId: 1, difficulty: 1, status: 1 });

module.exports = mongoose.models.DailyPracticeQuestion || mongoose.model('DailyPracticeQuestion', dailyPracticeQuestionSchema);
