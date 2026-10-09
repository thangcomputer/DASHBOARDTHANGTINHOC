const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
}, { _id: false });

const optionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: '' },
}, { _id: false });

const lessonItemSchema = new mongoose.Schema({
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonUnit', required: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonSubject', required: true, index: true },
  videoId: { type: String, default: '' },
  type: { type: String, enum: ['image_view', 'hotspot', 'mcq', 'multi', 'match', 'drag', 'written'], required: true },
  sortOrder: { type: Number, default: 0 },
  prompt: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imageName: { type: String, default: '', maxlength: 255 },
  caption: { type: String, default: '' },
  region: { type: regionSchema, default: undefined },
  options: { type: [optionSchema], default: undefined },
  correctOptionId: { type: String, default: '' },
  correctOptionIds: { type: [String], default: undefined },
  pairs: {
    type: [{
      id: { type: String, required: true },
      left: { type: String, default: '' },
      right: { type: String, default: '' },
    }],
    default: undefined,
  },
  timeLimitSec: { type: Number, default: 0, min: 0, max: 3600 },
  rubric: { type: String, default: '' },
  modelAnswer: { type: String, default: '' },
  explanation: { type: String, default: '' },
}, { timestamps: true });

lessonItemSchema.index({ unitId: 1, sortOrder: 1 });

module.exports = mongoose.model('LessonItem', lessonItemSchema);
