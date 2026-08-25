const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  ref: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'expired'], default: 'pending' },
  studentName: { type: String, default: '' },
  courseName: { type: String, default: '' },
  courseId: { type: mongoose.Schema.Types.ObjectId, default: null },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchCode: { type: String, default: '' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  paidAmount: { type: Number, default: 0 },
  /** tuition (mặc định) | video_course — không đụng enrollment học phí */
  kind: { type: String, enum: ['tuition', 'video_course'], default: 'tuition' },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoCoursePurchase', default: null },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Tự động xóa sau 24h (86400 giây)
});

paymentSessionSchema.index({ ref: 1, status: 1 });
paymentSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentSession', paymentSessionSchema);
