const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  answeredAt: { type: Date, default: Date.now },
}, { _id: false });

const certPrepSessionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepTest',
    required: true,
    index: true,
  },
  locale: {
    type: String,
    enum: ['vi', 'en'],
    required: true,
  },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'abandoned'],
    default: 'in_progress',
    index: true,
  },
  questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CertPrepQuestion' }],
  answers: { type: [answerSchema], default: [] },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  score: { type: Number, default: null },
  passed: { type: Boolean, default: null },
  correctCount: { type: Number, default: null },
  answeredCount: { type: Number, default: null },
  timeSpentSeconds: { type: Number, default: 0 },
  configSnapshot: {
    timeLimitMinutes: { type: Number, default: 50 },
    questionCount: { type: Number, default: 45 },
    passingScore: { type: Number, default: 700 },
    allowRetake: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: null },
    name: { type: String, default: '' },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    levelId: { type: String, default: '' },
    levelTitle: { type: String, default: '' },
    /** immediate = hiện đáp án khi làm; after_submit = chỉ sau nộp */
    feedbackMode: {
      type: String,
      enum: ['immediate', 'after_submit'],
      default: 'immediate',
    },
  },
  /** Frozen question+key copy at finalize. Review must use this, never live questions. */
  questionSnapshot: { type: Array, default: undefined },
}, { timestamps: true });

certPrepSessionSchema.index({ studentId: 1, testId: 1, status: 1 });

module.exports = mongoose.model('CertPrepSession', certPrepSessionSchema);
