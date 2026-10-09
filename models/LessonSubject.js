const mongoose = require('mongoose');

const lessonSubjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  examSubjectId: { type: String, default: '', trim: true, lowercase: true },
  summary: { type: String, default: '' },
  unlockMode: { type: String, enum: ['sequential', 'open'], default: 'sequential' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

lessonSubjectSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('LessonSubject', lessonSubjectSchema);
