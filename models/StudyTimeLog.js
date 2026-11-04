const mongoose = require('mongoose');

/**
 * Nhật ký học mỗi ngày (giờ Việt Nam): phút học từ heartbeat + bằng chứng học
 * (số câu đã trả lời, số video đã xem xong) do server ghi khi HV nộp bài / hoàn thành video.
 */
const studyTimeLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD theo Asia/Ho_Chi_Minh
  minutes: { type: Number, default: 0, min: 0 },
  questions: { type: Number, default: 0, min: 0 },
  videos: { type: Number, default: 0, min: 0 },
  lastBeatAt: { type: Date, default: null },
}, { timestamps: true });

studyTimeLogSchema.index({ studentId: 1, day: 1 }, { unique: true });
studyTimeLogSchema.index({ day: 1 }); // bảng xếp hạng tuần quét theo ngày cho toàn trung tâm

module.exports = mongoose.models.StudyTimeLog || mongoose.model('StudyTimeLog', studyTimeLogSchema);
