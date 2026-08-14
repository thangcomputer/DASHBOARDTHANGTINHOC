const mongoose = require('mongoose');

const certPrepEnrollmentMappingSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  certPrepCourseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepCourse',
    required: true,
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' },
}, { timestamps: true });

certPrepEnrollmentMappingSchema.index({ courseId: 1 }, { unique: true });
certPrepEnrollmentMappingSchema.index({ certPrepCourseId: 1, isActive: 1 });

module.exports = mongoose.model('CertPrepEnrollmentMapping', certPrepEnrollmentMappingSchema);
