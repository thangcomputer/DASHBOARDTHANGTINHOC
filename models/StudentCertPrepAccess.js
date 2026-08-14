const mongoose = require('mongoose');

const studentCertPrepAccessSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepCourse',
    required: true,
  },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  grantedBy: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

studentCertPrepAccessSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
studentCertPrepAccessSchema.index({ studentId: 1, courseId: 1, isActive: 1 });

module.exports = mongoose.model('StudentCertPrepAccess', studentCertPrepAccessSchema);
