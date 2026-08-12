const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true, default: 0 },
  explanation: { type: String, default: '' },
});

const SubmissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, default: '' },
  studentPhone: { type: String, default: '' },
  answers: [{ type: Number }],
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['passed', 'failed'], default: 'passed' },
  /** Thoát / reload giữa giờ → rớt */
  forfeit: { type: Boolean, default: false },
  exitReason: { type: String, default: '' },
});

const LessonQuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  courseName: { type: String, default: '' },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  teacherName: { type: String, default: '' },
  targetStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  timeLimitMinutes: { type: Number, default: 15, min: 1 },
  startTime: { type: Date, default: Date.now },
  deadline: { type: Date, default: null },
  questions: [QuestionSchema],
  submissions: [SubmissionSchema],
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, {
  timestamps: true
});

LessonQuizSchema.index({ teacherId: 1, createdAt: -1 });
LessonQuizSchema.index({ courseName: 1, status: 1 });
LessonQuizSchema.index({ targetStudentIds: 1 });

module.exports = mongoose.model('LessonQuiz', LessonQuizSchema);
