const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  // Giảng viên đặt lịch
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  teacherName: { type: String, required: true },

  // Học viên
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },
  studentName: { type: String, required: true },

  // Lịch
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // "19:00"
  endTime:   { type: String, default: '' },   // "21:00"

  // Thông tin học
  course: { type: String, required: true },
  linkHoc: { type: String, default: '' }, // Google Meet / Zoom

  // Trạng thái
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled',
  },

  /**
   * Xác nhận điểm danh của HV (sau cửa sổ 10s hủy của GV).
   * none → pending (chờ HV) → accepted | disputed → admin_approved | admin_rejected
   * Chỉ khi accepted/admin_approved (kèm status=completed) mới tính buổi/lương.
   */
  studentConfirmStatus: {
    type: String,
    enum: ['none', 'pending', 'accepted', 'disputed', 'admin_approved', 'admin_rejected'],
    default: 'none',
  },
  studentConfirmRequestedAt: { type: Date, default: null },
  studentConfirmedAt: { type: Date, default: null },
  attendanceDisputeResolvedAt: { type: Date, default: null },
  attendanceDisputeResolvedBy: { type: String, default: '' },
  /** Điểm / ghi chú tạm khi chờ HV xác nhận (chưa ghi enrollment). */
  attendancePendingGrade: { type: Number, default: null },
  attendancePendingNote: { type: String, default: '' },
  /** Buổi thứ N dự kiến (preview) lúc GV gửi xác nhận. */
  sessionOrdinalPreview: { type: Number, default: null },
  sessionTotalPreview: { type: Number, default: null },

  // Thanh toán
  is_paid_to_teacher: { type: Boolean, default: false }, 
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
  },

  // Nhắc nhở
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: { type: Date },

  note: { type: String, default: '' },
  studentNote: { type: String, default: '' },
  hasUnreadStudentNote: { type: Boolean, default: false },
  /** Thời điểm thao tác hủy ca (không phải ngày học). */
  cancelledAt: { type: Date, default: null },

  // Chi nhánh
  branchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchCode: { type: String, default: '' },
}, {
  timestamps: true,
});

scheduleSchema.index({ teacherId: 1, date: 1 });
scheduleSchema.index({ studentId: 1, date: 1 });
scheduleSchema.index({ studentId: 1, status: 1 });
scheduleSchema.index({ studentId: 1, status: 1, createdAt: -1 });
scheduleSchema.index({ studentId: 1, studentConfirmStatus: 1 });
scheduleSchema.index({ studentConfirmStatus: 1, status: 1 });
scheduleSchema.index({ branchId: 1, date: 1 });
scheduleSchema.index({ branchId: 1, status: 1 });
scheduleSchema.index({ status: 1, date: 1 });

// ✅ CHỐNG RACE CONDITION: Đảm bảo không trùng lịch Giảng viên
// partialFilter dùng $in (Mongo không hỗ trợ $ne/$not trong partial index)
scheduleSchema.index(
  { teacherId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['scheduled', 'completed', 'no_show'] } } }
);

module.exports = mongoose.model('Schedule', scheduleSchema);
