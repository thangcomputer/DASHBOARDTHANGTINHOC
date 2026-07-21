/**
 * Branch.js — Chi nhánh / Cơ sở đào tạo
 */
const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên chi nhánh là bắt buộc'],
    trim: true,
    unique: true,
  },
  code: {
    // Mã ngắn dùng trong nội dung chuyển khoản: "CS1", "CS2"...
    type: String,
    required: [true, 'Mã chi nhánh là bắt buộc'],
    trim: true,
    uppercase: true,
    unique: true,
    maxlength: 8,
  },
  address: { type: String, default: '' },
  phone:   { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  // Multi-tenant (Phase 15–16): chi nhánh thuộc tổ chức
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null,
    index: true,
  },
}, { timestamps: true });

BranchSchema.index({ isActive: 1, name: 1 });
BranchSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('Branch', BranchSchema);
