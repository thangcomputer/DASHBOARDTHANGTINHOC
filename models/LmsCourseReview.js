'use strict';

const mongoose = require('mongoose');

/**
 * Đánh giá khóa học video LMS (HV / GV) — server SoT.
 */
const lmsCourseReviewSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    courseTitle: { type: String, default: '' },
    audience: { type: String, enum: ['student', 'teacher'], default: 'student', index: true },
    reviewerId: { type: String, required: true, index: true },
    reviewerRole: { type: String, enum: ['student', 'teacher', 'admin', 'staff'], default: 'student' },
    reviewerName: { type: String, default: 'Học viên' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

lmsCourseReviewSchema.index({ courseId: 1, audience: 1, createdAt: -1 });
lmsCourseReviewSchema.index(
  { courseId: 1, audience: 1, reviewerId: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.LmsCourseReview || mongoose.model('LmsCourseReview', lmsCourseReviewSchema);
