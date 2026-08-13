'use strict';

const mongoose = require('mongoose');

/**
 * LMS lesson Q&A — server SoT (replaces localStorage-only tab).
 */
const lmsLessonQaSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    courseTitle: { type: String, default: '' },
    lessonId: { type: String, required: true, index: true },
    lessonTitle: { type: String, default: '' },
    /** student | teacher — which LMS surface asked */
    audience: { type: String, enum: ['student', 'teacher'], default: 'student', index: true },
    askerId: { type: String, required: true, index: true },
    askerRole: { type: String, enum: ['student', 'teacher', 'admin', 'staff'], default: 'student' },
    askerName: { type: String, default: 'Học viên' },
    assignedTeacherId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, default: '', trim: true, maxlength: 5000 },
    status: { type: String, enum: ['open', 'answered'], default: 'open', index: true },
    answer: { type: String, default: '', trim: true, maxlength: 8000 },
    answeredBy: { type: String, default: null },
    answeredByName: { type: String, default: '' },
    answeredByRole: { type: String, default: '' },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

lmsLessonQaSchema.index({ courseId: 1, createdAt: -1 });
lmsLessonQaSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.LmsLessonQa || mongoose.model('LmsLessonQa', lmsLessonQaSchema);
