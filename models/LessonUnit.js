const mongoose = require('mongoose');

const lessonVideoSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  url: { type: String, default: '' },
  antiSeek: { type: Boolean },
}, { _id: false });

const lessonContentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
}, { _id: false });

const lessonUnitSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonSubject', required: true, index: true },
  title: { type: String, required: true, trim: true },
  videoUrl: { type: String, default: '' },
  note: { type: String, default: '' },
  videos: { type: [lessonVideoSchema], default: [] },
  contents: { type: [lessonContentSchema], default: [] },
  contentOrder: { type: [String], default: [] },
  antiSeek: { type: Boolean, default: true },
  isPreviewAllowed: { type: Boolean, default: false },
  timeLimitSec: { type: Number, default: 0, min: 0, max: 3600 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

lessonUnitSchema.index({ subjectId: 1, sortOrder: 1 });

module.exports = mongoose.model('LessonUnit', lessonUnitSchema);
