const mongoose = require('mongoose');

const certPrepCourseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên khóa không được để trống'],
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  logoUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

certPrepCourseSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('CertPrepCourse', certPrepCourseSchema);
