/**
 * CreditNote — chứng từ hoàn (không xóa HĐ gốc).
 * Liên kết Invoice gốc + Ledger REFUND.
 */
const mongoose = require('mongoose');

const creditNoteSchema = new mongoose.Schema(
  {
    maChungTu: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      maxlength: 40,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    originalInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    ledgerEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null,
    },
    enrollmentId: { type: String, default: '', maxlength: 64 },
    courseName: { type: String, default: '', maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['issued', 'void'],
      default: 'issued',
      index: true,
    },
    issuedBy: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

creditNoteSchema.index({ studentId: 1, createdAt: -1 });

creditNoteSchema.pre('save', async function () {
  if (!this.maChungTu) {
    const n = await mongoose.model('CreditNote').countDocuments();
    const d = new Date();
    const ym = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.maChungTu = `CN${ym}-${String(n + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('CreditNote', creditNoteSchema);
