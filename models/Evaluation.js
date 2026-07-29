const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  targetTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  enrollmentId: { type: String, default: '' },
  studentName: { type: String },
  teacherName: { type: String },
  courseName: { type: String },
  milestone: { type: String },
  type: { type: String, enum: ['teacher_rating', 'admin_feedback'], required: true },
  criteria: { type: Object },
  content: { type: String },
  /** Phase 11 / ADR 0003 — stars 1–5 */
  stars: { type: Number, default: null, min: 1, max: 5 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'hidden'],
    default: 'pending',
    index: true,
  },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  moderationNote: { type: String, default: '', maxlength: 500 },
  read: { type: Boolean, default: false },
  isReadByAdmin: { type: Boolean, default: false }
}, {
  timestamps: true
});

EvaluationSchema.index({ studentId: 1, createdAt: -1 });
EvaluationSchema.index({ targetTeacherId: 1, type: 1 });
EvaluationSchema.index({ type: 1, status: 1, createdAt: -1 });
EvaluationSchema.index({ type: 1, isReadByAdmin: 1, createdAt: -1 });
EvaluationSchema.index({ type: 1, read: 1 });
EvaluationSchema.index({ studentId: 1, targetTeacherId: 1, enrollmentId: 1, type: 1 });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
