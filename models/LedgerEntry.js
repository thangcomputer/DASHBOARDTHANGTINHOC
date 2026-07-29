/**
 * LedgerEntry — sổ cái tài chính append-only.
 * Soft-delete course / hủy TT không được xóa dòng đã posted.
 */
const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: [
        'payment',
        'refund',
        'adjustment',
        'salary',
        'bonus',
        'expense',
        'discount',
        'coupon',
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: { type: String, default: 'VND', maxlength: 8 },
    status: {
      type: String,
      enum: ['posted', 'void'],
      default: 'posted',
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      index: true,
    },
    enrollmentId: { type: String, default: '', maxlength: 64 },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    courseName: { type: String, default: '', trim: true, maxlength: 200 },
    source: { type: String, default: 'system', maxlength: 64 },
    sourceRef: { type: String, default: '', maxlength: 120 },
    note: { type: String, default: '', maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    postedAt: { type: Date, default: Date.now, index: true },
    postedBy: { type: String, default: '' },
    postedByRole: { type: String, default: '' },
    reversesEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null,
    },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ idempotencyKey: 1 }, { unique: true });
ledgerEntrySchema.index({ studentId: 1, type: 1, postedAt: -1 });
ledgerEntrySchema.index({ branchId: 1, postedAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
