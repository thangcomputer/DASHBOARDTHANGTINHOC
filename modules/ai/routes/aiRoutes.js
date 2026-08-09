const express = require('express');
const router = express.Router();
const aiController = require('../controllers/AiController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const aiService = require('../services/aiService');
const logger = require('../../../config/logger');
const { sensitiveFlowLimiter } = require('../../../middleware/authRateLimit');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), sensitiveFlowLimiter];

router.get('/status', guard,aiController.get_status);

router.post('/quiz', guard,aiController.post_quiz);

router.post('/notification-draft', guard,aiController.post_notification_draft);

router.post('/summarize', guard,aiController.post_summarize);

router.post('/complete', guard,aiController.post_complete);

module.exports = router;