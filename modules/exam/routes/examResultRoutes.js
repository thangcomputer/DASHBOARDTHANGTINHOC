const express    = require('express');
const router     = express.Router();
const { examResultRepository } = require('../repositories');
const ExamResult = require('../models/ExamResult'); // Temp for new ExamResult
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const NotificationService = require('../../notification/services/NotificationService');
const logger = require('../../../config/logger');

// GET /api/exam-results — lấy tất cả (hoặc lọc theo type)
router.get('/', authMiddleware,examResultController.get_root);

// POST /api/exam-results — thêm kết quả thi mới
router.post('/', authMiddleware,examResultController.post_root);

// PUT /api/exam-results/:id — cập nhật (chấm điểm)
router.put('/:id', authMiddleware,examResultController.put_id);

// DELETE /api/exam-results/:id — xóa
router.delete('/:id', authMiddleware,examResultController.delete_id);

module.exports = router;
