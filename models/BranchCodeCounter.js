/**
 * BranchCodeCounter — sequence atomic cho display code theo (role, branch).
 * ADR 0002: HV/GV/AD/ST + branchCode.
 */
const mongoose = require('mongoose');

const BranchCodeCounterSchema = new mongoose.Schema(
  {
    rolePrefix: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['HV', 'GV', 'AD', 'ST'],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    branchCode: { type: String, required: true, uppercase: true, trim: true },
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

BranchCodeCounterSchema.index({ rolePrefix: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('BranchCodeCounter', BranchCodeCounterSchema);
