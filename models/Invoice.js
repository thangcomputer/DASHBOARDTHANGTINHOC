const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  maHoaDon: {
    type: String,
    unique: true,
    required: true
  },
  hocVien: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  hoTen: {
    type: String,
    required: true
  },
  khoaHoc: {
    type: String,
    required: true
  },
  hocPhi: {
    type: Number,
    required: true
  },
  ngayXuat: {
    type: Date,
    default: Date.now
  },
  ghiChu: {
    type: String,
    trim: true
  },
  // P3 ERP fields (optional / backward-compatible)
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
    index: true,
  },
  enrollmentId: { type: String, default: '', maxlength: 64 },
  ledgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerEntry',
    default: null,
  },
  docType: {
    type: String,
    enum: ['invoice', 'credit'],
    default: 'invoice',
    index: true,
  },
  status: {
    type: String,
    enum: ['issued', 'void'],
    default: 'issued',
    index: true,
  },
  originalInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null,
  },
}, {
  timestamps: true
});

invoiceSchema.index({ hocVien: 1, createdAt: -1 });
invoiceSchema.index({ createdAt: -1 });

// Tự động tạo mã hóa đơn
invoiceSchema.pre('save', async function () {
  if (!this.maHoaDon) {
    const count = await mongoose.model('Invoice').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.maHoaDon = `HD${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
