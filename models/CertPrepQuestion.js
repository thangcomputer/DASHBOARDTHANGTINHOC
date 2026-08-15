const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
}, { _id: false });

const matchingItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
}, { _id: false });

const matchingPairSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  targetId: { type: String, required: true },
}, { _id: false });

/** Dòng nhận định Đúng/Sai trong bảng */
const trueFalseStatementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: '' },
  correct: { type: Boolean, required: true },
}, { _id: false });

const certPrepQuestionSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepTest',
    required: true,
    index: true,
  },
  locale: {
    type: String,
    enum: ['vi', 'en'],
    required: true,
  },
  type: {
    type: String,
    enum: ['single_choice', 'multiple_choice', 'matching', 'true_false_grid'],
    required: true,
  },
  questionText: { type: String, required: true, trim: true },
  questionImage: { type: String, default: '' },
  options: { type: [optionSchema], default: [] },
  correctAnswer: { type: Number, default: null },
  correctIndices: { type: [Number], default: [] },
  minSelect: { type: Number, default: null },
  matchingItems: { type: [matchingItemSchema], default: [] },
  matchingTargets: { type: [matchingItemSchema], default: [] },
  matchingPairs: { type: [matchingPairSchema], default: [] },
  statements: { type: [trueFalseStatementSchema], default: [] },
  hint: { type: String, default: '' },
  hintImage: { type: String, default: '' },
  explanation: { type: String, default: '' },
  explanationImage: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

certPrepQuestionSchema.index({ testId: 1, locale: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('CertPrepQuestion', certPrepQuestionSchema);
