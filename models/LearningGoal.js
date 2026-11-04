const mongoose = require('mongoose');

/** Mục tiêu học do học viên tự đặt (1 tuần / 1 tháng / 3 tháng × số giờ mỗi ngày). */
const learningGoalSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  period: { type: String, enum: ['week', 'month', 'quarter'], required: true },
  hoursPerDay: { type: Number, required: true, min: 1, max: 5 },
  startedAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.models.LearningGoal || mongoose.model('LearningGoal', learningGoalSchema);
