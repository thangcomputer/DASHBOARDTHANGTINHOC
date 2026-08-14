const mongoose = require('mongoose');

const certPrepLevelSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepCourse',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Tên level không được để trống'],
    trim: true,
  },
  subtitle: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

certPrepLevelSchema.index({ courseId: 1, sortOrder: 1 });

module.exports = mongoose.model('CertPrepLevel', certPrepLevelSchema);
