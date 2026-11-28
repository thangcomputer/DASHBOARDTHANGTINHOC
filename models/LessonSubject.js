const mongoose = require('mongoose');

const lessonSubjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  examSubjectId: { type: String, default: '', trim: true, lowercase: true },
  summary: { type: String, default: '' },
  icon: { type: String, default: 'book', trim: true },
  color: { type: String, default: 'green', trim: true },
  unlockMode: { type: String, enum: ['sequential', 'open'], default: 'open' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

lessonSubjectSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('LessonSubject', lessonSubjectSchema);
