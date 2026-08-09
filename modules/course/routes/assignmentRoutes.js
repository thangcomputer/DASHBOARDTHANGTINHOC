const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { assignmentRepository } = require('../repositories');
const Assignment = require('../models/Assignment'); // Temp for new Assignment
const { submissionRepository } = require('../repositories');
const Submission = require('../models/Submission'); // Temp for new Submission
const Student = require('../../student/models/Student');
const Teacher = require('../../teacher/models/Teacher');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const logger = require('../../../config/logger');
const { normalizeMulterFile } = require('../../../utils/escapeRegex');

const router = express.Router();
const assignmentController = require('../controllers/AssignmentController');

async function assignmentHasGradedSubmission(assignmentId) {
  const n = await submissionRepository.count({ assignmentId, status: 'graded' });
  return n > 0;
}

function normCourseLabel(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Lấy teacherId theo đúng khóa enrollment (fallback teacher root). */
function resolveTeacherIdsForStudentCourse(student, courseName) {
  const ids = [];
  const want = normCourseLabel(courseName);
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments : [];
  enrollments.forEach((e) => {
    if (want && normCourseLabel(e.courseName || e.course) !== want) return;
    const tid = e.teacherId?._id || e.teacherId;
    if (tid) ids.push(String(tid));
  });
  if (!ids.length && student?.teacherId) {
    ids.push(String(student.teacherId._id || student.teacherId));
  }
  return [...new Set(ids.filter(Boolean))];
}

// Tự động tạo thư mục uploads/assignments nếu chưa có
const uploadDir = path.join(__dirname, '..', 'uploads', 'assignments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer cho Bài tập (Giới hạn 3MB)
const ALLOWED_ASSIGNMENT_EXT = new Set([
  '.zip', '.rar', '.tar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png',
]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = ALLOWED_ASSIGNMENT_EXT.has(rawExt) ? rawExt : '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeField = String(file.fieldname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeField}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // Giới hạn 3MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_ASSIGNMENT_EXT.has(ext)) {
      return cb(new Error('Định dạng file không được phép. Chỉ hỗ trợ ZIP/RAR/PDF/DOC/XLS/PPT/JPG/PNG.'));
    }
    const mime = String(file.mimetype || '').toLowerCase();
    const okMime = /^(application\/(zip|x-(rar|7z)-compressed|x-tar|pdf|msword|vnd\.|octet-stream)|image\/(jpeg|png))/.test(mime);
    if (!okMime) {
      return cb(new Error('MIME type không khớp định dạng cho phép.'));
    }
    cb(null, true);
  }
});

// ─── Tải file đính kèm/nộp bài chung ─────────────────────────────────────────
router.post('/upload', authMiddleware, upload.single('file'),assignmentController.post_upload);

// Error handling cho multer lỗi kích thước
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File tải lên quá lớn. Xin vui lòng giới hạn dưới 3MB!' });
    }
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// ─── Lấy danh sách giao bài (Theo Course) ──────────────────────────────────
router.get('/course/:courseId', authMiddleware,assignmentController.get_course_courseId);

// ─── Lấy Bài tập cho Học viên (Kèm Submission cá nhân) ─────────────────────
router.get('/student/:studentId/course/:courseId', authMiddleware,assignmentController.get_student_studentId_course_courseId);

// ─── Giáo viên tạo bài tập ─────────────────────────────────────────────────
router.post('/', authMiddleware,assignmentController.post_root);

// ─── Giáo viên cập nhật bài tập ────────────────────────────────────────────
router.put('/:id', authMiddleware,assignmentController.put_id);

// ─── Giáo viên xóa bài tập ─────────────────────────────────────────────────
router.delete('/:id', authMiddleware,assignmentController.delete_id);

// ─── Học viên nộp bài ──────────────────────────────────────────────────────
router.post('/:id/submit', authMiddleware,assignmentController.post_id_submit);

// ─── Giáo viên chấm điểm ───────────────────────────────────────────────────
router.put('/submissions/:submissionId/grade', authMiddleware,assignmentController.put_submissions_submissionId_grade);

module.exports = router;
