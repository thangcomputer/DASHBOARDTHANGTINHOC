/**
 * RewardPayout — phiếu thưởng GV (draft → approved → paid | cancelled).
 */
const mongoose = require('mongoose');

const RewardPayoutSchema = new mongoose.Schema(
  {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardRule',
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,
    },
    teacherName: { type: String, default: '' },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    /** Khóa kỳ: 2026-07 | 2026-Q3 | 2026 */
    periodKey: { type: String, required: true, index: true },
    periodType: {
      type: String,
      enum: ['month', 'quarter', 'year'],
      required: true,
    },
    metric: { type: String, default: 'pct_5star' },
    totalRatings: { type: Number, default: 0 },
    fiveStarCount: { type: Number, default: 0 },
    pct5Star: { type: Number, default: 0 },
    thresholdPct: { type: Number, default: 0 },
    minRatings: { type: Number, default: 0 },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid', 'cancelled', 'rejected'],
      default: 'draft',
      index: true,
    },
    /** Chống double payout cùng rule+teacher+period */
    idempotencyKey: { type: String, required: true, unique: true },
    ledgerEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null,
    },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    paidBy: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

RewardPayoutSchema.index({ teacherId: 1, periodKey: 1, status: 1 });
RewardPayoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('RewardPayout', RewardPayoutSchema);
