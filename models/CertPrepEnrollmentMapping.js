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

// 1 LMS course → nhiều chương trình CertPrep (vd. IC3 → SPARK + GS6)
certPrepEnrollmentMappingSchema.index({ courseId: 1, certPrepCourseId: 1 }, { unique: true });
certPrepEnrollmentMappingSchema.index({ courseId: 1, isActive: 1 });
certPrepEnrollmentMappingSchema.index({ certPrepCourseId: 1, isActive: 1 });

module.exports = mongoose.model('CertPrepEnrollmentMapping', certPrepEnrollmentMappingSchema);
