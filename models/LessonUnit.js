const mongoose = require('mongoose');

const lessonUnitSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonSubject', required: true, index: true },
  title: { type: String, required: true, trim: true },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

lessonUnitSchema.index({ subjectId: 1, sortOrder: 1 });

module.exports = mongoose.model('LessonUnit', lessonUnitSchema);
