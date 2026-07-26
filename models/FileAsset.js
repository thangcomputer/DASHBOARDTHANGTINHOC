const mongoose = require('mongoose');

const fileAssetSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  category: {
    type: String,
    enum: ['messages', 'assignments', 'training', 'invoices', 'images', 'general', 'popup', 'signature', 'logo'],
    required: true,
    index: true,
  },
  /** Public URL path, e.g. /uploads/messages/xxx.pdf */
  url: { type: String, required: true },
  /** Relative disk path under uploads/, e.g. messages/xxx.pdf */
  diskPath: { type: String, required: true },
  uploadedBy: { type: String, default: '' },
  uploadedByRole: { type: String, default: '' },
  relatedType: { type: String, default: '' },
  relatedId: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'expired', 'deleted'],
    default: 'active',
    index: true,
  },
  expiresAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

fileAssetSchema.index({ category: 1, createdAt: -1 });
fileAssetSchema.index({ uploadedBy: 1, createdAt: -1 });
fileAssetSchema.index({ expiresAt: 1, status: 1 });
fileAssetSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FileAsset', fileAssetSchema);