const mongoose = require('mongoose');

const certPrepTestSchema = new mongoose.Schema({
  levelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CertPrepLevel',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Tên bài kiểm tra không được để trống'],
    trim: true,
  },
  locale: {
    type: String,
    enum: ['vi', 'en'],
    required: true,
  },
  timeLimitMinutes: {
    type: Number,
    default: 50,
    min: [1, 'Thời gian phải lớn hơn 0'],
  },
  questionCount: {
    type: Number,
    default: 45,
    min: [1, 'Số câu phải lớn hơn 0'],
  },
  passingScore: {
    type: Number,
    default: 700,
    min: [0, 'Điểm đạt không hợp lệ'],
    max: [1000, 'Điểm đạt không được vượt 1000'],
  },
  allowRetake: { type: Boolean, default: true },
  /** null = không giới hạn số lần làm */
  maxAttempts: { type: Number, default: null, min: 1 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

certPrepTestSchema.index({ levelId: 1, locale: 1, sortOrder: 1 });

module.exports = mongoose.model('CertPrepTest', certPrepTestSchema);
