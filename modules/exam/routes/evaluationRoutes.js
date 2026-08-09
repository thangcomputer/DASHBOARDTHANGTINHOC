const express = require('express');
const { evaluationRepository } = require('../repositories');
const Evaluation = require('../models/Evaluation'); // Temp for new Evaluation
const Teacher = require('../../teacher/models/Teacher');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');

const router = express.Router();
const evaluationController = require('../controllers/EvaluationController');

// ─── ADMIN lấy danh sách phản hồi mật ──────────────────────────────────────
router.get('/admin', authMiddleware,evaluationController.get_admin);

// ─── Lấy Review Công khai của Giáo viên ────────────────────────────────────
router.get('/teacher/:teacherId', authMiddleware,evaluationController.get_teacher_teacherId);

// ─── Học viên gửi hoặc cập nhật đánh giá ───────────────────────────────────
router.post('/', authMiddleware,evaluationController.post_root);

// ─── Đánh dấu đã đọc đánh giá ───────────────────────────────────────────────
router.post('/:id/read', authMiddleware,evaluationController.post_id_read);

module.exports = router;

