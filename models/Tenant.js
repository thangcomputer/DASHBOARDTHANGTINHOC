const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 16,
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'trial'],
    default: 'active',
    index: true,
  },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  maxBranches: { type: Number, default: 50 },
  notes: { type: String, default: '' },
  settings: {
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '' },
  },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

tenantSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Tenant', tenantSchema);