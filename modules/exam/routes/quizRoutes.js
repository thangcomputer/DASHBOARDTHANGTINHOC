const express = require('express');
const router = express.Router();
const quizController = require('../controllers/QuizController');
const { lessonQuizRepository } = require('../repositories');
const LessonQuiz = require('../models/LessonQuiz'); // Temp for new LessonQuiz
const Student = require('../../student/models/Student');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const logger = require('../../../config/logger');

// ── GET /api/quizzes/teacher: Lấy danh sách trắc nghiệm do giảng viên tạo ─────
router.get('/teacher', authMiddleware,quizController.get_teacher);

// ── POST /api/quizzes/create: Giảng viên tạo bài trắc nghiệm mới ──────────────
router.post('/create', authMiddleware,quizController.post_create);

// ── DELETE /api/quizzes/:id: Giảng viên xóa bài trắc nghiệm ────────────────────
router.delete('/:id', authMiddleware,quizController.delete_id);

// ── GET /api/quizzes/student: Lấy danh sách trắc nghiệm được giao cho Học viên ─
router.get('/student', authMiddleware,quizController.get_student);

// ── GET /api/quizzes/:id: Học viên mở bài thi trắc nghiệm (Room Exam View) ────
router.get('/:id', authMiddleware,quizController.get_id);

// ── POST /api/quizzes/:id/submit: Nộp bài trắc nghiệm & Chấm điểm tự động ──────
router.post('/:id/submit', authMiddleware,quizController.post_id_submit);

// ── GET /api/quizzes/admin/all: Admin xem toàn bộ lịch sử tạo bài trắc nghiệm của tất cả giảng viên ─
router.get('/admin/all', authMiddleware,quizController.get_admin_all);

module.exports = router;
