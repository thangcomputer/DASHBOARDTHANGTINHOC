const mongoose = require('mongoose');

/** Mỗi lần cộng XP học bài. sourceKey chặn cộng trùng. */
const lmsXpGrantSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: 'lesson_unit' },
  sourceKey: { type: String, required: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.models.LmsXpGrant || mongoose.model('LmsXpGrant', lmsXpGrantSchema);
