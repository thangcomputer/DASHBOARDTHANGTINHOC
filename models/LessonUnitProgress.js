const mongoose = require('mongoose');

const lessonUnitProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  videoDone: { type: Boolean, default: false },
  noteDone: { type: Boolean, default: false },
  completedVideoIds: { type: [String], default: [] },
  completedNoteIds: { type: [String], default: [] },
  practiceDone: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

lessonUnitProgressSchema.index({ studentId: 1, unitId: 1 }, { unique: true });
lessonUnitProgressSchema.index({ subjectId: 1, studentId: 1 });

module.exports = mongoose.model('LessonUnitProgress', lessonUnitProgressSchema);
