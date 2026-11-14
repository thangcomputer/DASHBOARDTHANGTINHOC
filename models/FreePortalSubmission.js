const mongoose = require('mongoose');

/** Bài nộp của tài khoản miễn phí cho bài tập Free Portal (tách biệt hoàn toàn khỏi Assignment/Submission theo khóa). */
const freePortalSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: String, required: true, trim: true, maxlength: 120 },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedFileUrl: { type: String, required: true, trim: true, maxlength: 1000 },
  fileName: { type: String, default: '', trim: true, maxlength: 260 },
  status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

freePortalSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
freePortalSubmissionSchema.index({ studentId: 1, submittedAt: -1 });

module.exports = mongoose.models.FreePortalSubmission
  || mongoose.model('FreePortalSubmission', freePortalSubmissionSchema);
