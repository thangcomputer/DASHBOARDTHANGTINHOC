const mongoose = require('mongoose');

/** Lịch sử gia hạn gói tài khoản HV (mã kích hoạt / thanh toán / admin đặt tay). */
const subscriptionLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  source: { type: String, enum: ['code', 'payment', 'admin'], required: true },
  plan: { type: String, enum: ['1m', '3m', '6m', '12m', 'lifetime'], required: true },
  previousExpiresAt: { type: Date, default: null },
  previousPlan: { type: String, default: '' },
  newExpiresAt: { type: Date, default: null },
  code: { type: String, default: '' },
  paymentSessionId: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  actorId: { type: String, default: '' },
  actorName: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

subscriptionLogSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.models.SubscriptionLog || mongoose.model('SubscriptionLog', subscriptionLogSchema);
