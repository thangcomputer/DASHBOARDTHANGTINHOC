/**
 * LedgerEntry — sổ cái bất biến (ADR 0001 / Phase 10).
 * Chỉ INSERT; không UPDATE/DELETE số tiền đã posted.
 */
const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema(
  {
    /** Unique business key — chống double webhook / double settle */
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ['payment', 'refund', 'adjustment'],
      required: true,
      index: true,
    },
    /** Luôn dương; dấu lấy từ type (payment +, refund −) */
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: { type: String, default: 'VND' },
    status: {
      type: String,
      enum: ['posted'],
      default: 'posted',
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
    enrollmentId: { type: String, default: '' },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    courseName: { type: String, default: '' },
    source: {
      type: String,
      enum: ['admin_pay', 'enrollment_pay', 'sepay', 'session', 'refund', 'adjustment', 'system', 'reward', 'payroll'],
      default: 'system',
      index: true,
    },
    sourceRef: { type: String, default: '', index: true },
    note: { type: String, default: '', maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    postedAt: { type: Date, default: Date.now, index: true },
    postedBy: { type: String, default: '' },
    postedByRole: { type: String, default: '' },
    /** Liên kết reversal → entry gốc (refund) */
    reversesEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null,
    },
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ branchId: 1, postedAt: -1 });
LedgerEntrySchema.index({ type: 1, postedAt: -1 });
LedgerEntrySchema.index({ studentId: 1, postedAt: -1 });

/** Signed amount cho báo cáo: payment +, refund − */
LedgerEntrySchema.virtual('signedAmount').get(function signedAmount() {
  const amt = Number(this.amount) || 0;
  if (this.type === 'refund') return -Math.abs(amt);
  if (this.type === 'adjustment') {
    const dir = this.metadata?.direction;
    if (dir === 'debit') return -Math.abs(amt);
  }
  return Math.abs(amt);
});

LedgerEntrySchema.set('toJSON', { virtuals: true });
LedgerEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
