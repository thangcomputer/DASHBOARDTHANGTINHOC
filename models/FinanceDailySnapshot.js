/**
 * FinanceDailySnapshot — pre-aggregate theo ngày/chi nhánh từ Ledger (rebuild được).
 * Không phải SoT độc lập.
 */
const mongoose = require('mongoose');

const financeDailySnapshotSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    payments: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    costs: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    paymentCount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
    salaryCount: { type: Number, default: 0 },
    rebuiltAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

financeDailySnapshotSchema.index(
  { dateKey: 1, branchId: 1 },
  { unique: true }
);

module.exports = mongoose.model('FinanceDailySnapshot', financeDailySnapshotSchema);
