const mongoose = require('mongoose');

const videoCoursePurchaseSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  courseId: { type: String, required: true, index: true },
  courseTitle: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending', index: true },
  paymentSessionId: { type: String, default: '' },
  ref: { type: String, default: '' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

videoCoursePurchaseSchema.index({ studentId: 1, courseId: 1, status: 1 });
videoCoursePurchaseSchema.index({ paymentSessionId: 1 });

module.exports = mongoose.model('VideoCoursePurchase', videoCoursePurchaseSchema);
