'use strict';

const mongoose = require('mongoose');

const qaThreadMessageSchema = new mongoose.Schema(
  {
    authorId: { type: String, default: '' },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * LMS lesson Q&A — server SoT (replaces localStorage-only tab).
 */
const lmsLessonQaSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    courseTitle: { type: String, default: '' },
    lessonId: { type: String, required: true, index: true },
    lessonTitle: { type: String, default: '' },
    /** Snapshot so Support can open video without Settings lookup failures */
    videoUrl: { type: String, default: '' },
    videoDuration: { type: Number, default: 0 },
    /** student | teacher — which LMS surface asked */
    audience: { type: String, enum: ['student', 'teacher'], default: 'student', index: true },
    askerId: { type: String, required: true, index: true },
    askerRole: { type: String, enum: ['student', 'teacher', 'admin', 'staff'], default: 'student' },
    askerName: { type: String, default: 'Học viên' },
    assignedTeacherId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, default: '', trim: true, maxlength: 5000 },
    /** Seconds in lesson video when the question was asked (for Support/staff review). */
    atSec: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['open', 'answered'], default: 'open', index: true },
    answer: { type: String, default: '', trim: true, maxlength: 8000 },
    answeredBy: { type: String, default: null },
    answeredByName: { type: String, default: '' },
    answeredByRole: { type: String, default: '' },
    answeredAt: { type: Date, default: null },
    /** Follow-up dialogue after the first staff answer (and staff follow-ups). */
    thread: { type: [qaThreadMessageSchema], default: [] },
  },
  { timestamps: true }
);

lmsLessonQaSchema.index({ courseId: 1, createdAt: -1 });
lmsLessonQaSchema.index({ status: 1, createdAt: -1 });

// Hot-reload safe: patch paths if model was compiled earlier without atSec/videoUrl/thread
let LmsLessonQa = mongoose.models.LmsLessonQa;
if (!LmsLessonQa) {
  LmsLessonQa = mongoose.model('LmsLessonQa', lmsLessonQaSchema);
} else {
  const patch = {};
  if (!LmsLessonQa.schema.path('atSec')) patch.atSec = { type: Number, default: 0, min: 0 };
  if (!LmsLessonQa.schema.path('videoUrl')) patch.videoUrl = { type: String, default: '' };
  if (!LmsLessonQa.schema.path('videoDuration')) patch.videoDuration = { type: Number, default: 0 };
  if (!LmsLessonQa.schema.path('thread')) patch.thread = { type: [qaThreadMessageSchema], default: [] };
  if (Object.keys(patch).length) LmsLessonQa.schema.add(patch);
}

module.exports = LmsLessonQa;
