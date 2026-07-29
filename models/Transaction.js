const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Người nhận (Giảng viên)
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  teacherName: {
    type: String,
    required: true,
  },
  teacherPhone: {
    type: String,
    default: '',
  },

  // Thông tin giao dịch
  amount: {
    type: Number,
    required: [true, 'Số tiền là bắt buộc'],
    min: 0,
  },
  description: {
    type: String,
    default: '',
    // VD: "Thù lao 8 buổi dạy tháng 3/2026"
  },
  month: {
    type: String,
    default: '',
    // VD: "Tháng 3/2026"
  },

  // Trạng thái
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  },

  // Admin xác nhận
  confirmedBy: {
    type: String,
    default: 'Admin',
  },
  confirmedAt: {
    type: Date,
  },

  // Thông tin ngân hàng
  bankName: { type: String, default: '' },
  bankAccount: { type: String, default: '' },

  // Ghi chú
  note: { type: String, default: '' },

  /** Thưởng sao cộng kèm (VNĐ) — tách khỏi lương cứng × buổi */
  starBonusAmount: { type: Number, default: 0, min: 0 },
  /** Các tháng YYYY-MM đã chi thưởng trong phiếu này */
  starBonusMonths: { type: [String], default: [] },

  // Idempotency (tránh double-pay khi retry)
  idempotencyKey: { type: String, default: null },

  // Chi nhánh
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null,
  },
  branchCode: { type: String, default: '' },
}, {
  timestamps: true,
});

// Index cho truy vấn nhanh
transactionSchema.index({ teacherId: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ branchId: 1, status: 1 });
transactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Transaction', transactionSchema);
