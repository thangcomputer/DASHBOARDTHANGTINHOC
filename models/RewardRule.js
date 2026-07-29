/**
 * RewardRule — cấu hình thưởng GV theo % rating (Phase 12).
 */
const mongoose = require('mongoose');

const RewardRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    metric: {
      type: String,
      enum: ['pct_5star'],
      default: 'pct_5star',
    },
    /** Ngưỡng % đạt (vd 80) */
    thresholdPct: { type: Number, required: true, min: 0, max: 100 },
    /** Số rating approved tối thiểu trong kỳ */
    minRatings: { type: Number, required: true, min: 1, default: 10 },
    /** Số tiền thưởng khi đạt (VND) */
    amount: { type: Number, required: true, min: 0 },
    period: {
      type: String,
      enum: ['month', 'quarter', 'year'],
      default: 'month',
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: '' },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

RewardRuleSchema.index({ active: 1, period: 1, branchId: 1 });

module.exports = mongoose.model('RewardRule', RewardRuleSchema);
