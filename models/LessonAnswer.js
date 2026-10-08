const mongoose = require('mongoose');

/** Bài làm từng câu — chỉ học viên xem lại. API tiến độ admin không đọc collection này. */
const lessonAnswerSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: mongoose.Schema.Types.Mixed, default: null },
  correct: { type: Boolean, default: null },
  explanation: { type: String, default: '' },
}, { timestamps: true });

lessonAnswerSchema.index({ studentId: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('LessonAnswer', lessonAnswerSchema);
