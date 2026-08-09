const express = require('express');
const { teachingGuideRepository } = require('../repositories');
const TeachingGuide = require('../models/TeachingGuide'); // Temp for new TeachingGuide
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const logger = require('../../../config/logger');

const router = express.Router();
const teachingGuideController = require('../controllers/TeachingGuideController');

// Lấy tất cả tài liệu đào tạo (cho Admin, Teacher, Student)
router.get('/', authMiddleware,teachingGuideController.get_root);

module.exports = router;
