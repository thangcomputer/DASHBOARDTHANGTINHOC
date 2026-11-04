const mongoose = require('mongoose');

/** Vị trí học gần nhất của học viên (môn → buổi → mục), dùng chung web + mobile để "Học tiếp". */
const studyResumePointSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, required: true },
  courseId: { type: String, default: '' },
  sectionId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.StudyResumePoint || mongoose.model('StudyResumePoint', studyResumePointSchema);
