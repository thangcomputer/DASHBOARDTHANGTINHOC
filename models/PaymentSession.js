const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  ref: { type: String, required: true },
  amount: { type: Number, required: true },
  originalAmount: { type: Number, default: 0 },
  referralDiscountVnd: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'paid', 'expired'], default: 'pending' },
  studentName: { type: String, default: '' },
  courseName: { type: String, default: '' },
  courseId: { type: mongoose.Schema.Types.ObjectId, default: null },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchCode: { type: String, default: '' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  paidAmount: { type: Number, default: 0 },
  /** tuition (mặc định) | video_course | course_purchase | dewskill_class | admin_enrollment | subscription_renewal | daily_practice_xp | ai_package */
  kind: {
    type: String,
    enum: ['tuition', 'video_course', 'course_purchase', 'dewskill_class', 'admin_enrollment', 'subscription_renewal', 'daily_practice_xp', 'ai_package'],
    default: 'tuition',
  },
  /** Gói gia hạn tài khoản (subscription_renewal), mã gói XP (daily_practice_xp) hoặc gói AI (ai_package). */
  plan: { type: String, default: '' },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoCoursePurchase', default: null },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
  totalSessions: { type: Number, default: 12 },
  teacherAlert: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Tự động xóa sau 24h (86400 giây)
});

paymentSessionSchema.index({ ref: 1, status: 1 });
paymentSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentSession', paymentSessionSchema);
