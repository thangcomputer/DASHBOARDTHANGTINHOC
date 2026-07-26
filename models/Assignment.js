const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  courseId: { type: String, required: true }, // string course name or ID
  // null / không có: bài giao cho cả lớp (dữ liệu cũ); có giá trị: chỉ học viên đó thấy và nộp
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: false, default: null },
  // Optional: nếu giáo viên tạo thì có teacherId; nếu admin/staff tạo thì teacherId có thể null
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: false, default: null },

  // Người giao bài (để HV biết admin hay GV giao)
  assignedById:   { type: String, default: '' },
  assignedByRole: { type: String, default: '' }, // 'admin' | 'staff' | 'teacher'
  assignedByName: { type: String, default: '' },

  title: { type: String, required: true },
  description: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, {
  timestamps: true
});

AssignmentSchema.index({ courseId: 1, createdAt: -1 });
AssignmentSchema.index({ studentId: 1, status: 1 });
AssignmentSchema.index({ teacherId: 1, createdAt: -1 });

module.exports = mongoose.model('Assignment', AssignmentSchema);
