/**
 * TeacherAssignmentSegment — lịch sử phân công GV theo enrollment (Phase 7).
 * Buổi completed giữ teacherId trên Schedule; segment ghi khoảng thời gian phụ trách.
 */
const mongoose = require('mongoose');

const TeacherAssignmentSegmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    enrollmentId: { type: String, default: '', index: true },
    courseName: { type: String, default: '', trim: true },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true,
    },
    teacherName: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null, index: true },
    /** Số buổi đã hoàn thành (của khóa) tại thời điểm bắt đầu segment */
    completedSessionsAtStart: { type: Number, default: 0, min: 0 },
    actorId: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    reason: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

TeacherAssignmentSegmentSchema.index({ studentId: 1, courseName: 1, endedAt: 1 });
TeacherAssignmentSegmentSchema.index({ teacherId: 1, endedAt: 1 });

module.exports = mongoose.model('TeacherAssignmentSegment', TeacherAssignmentSegmentSchema);
