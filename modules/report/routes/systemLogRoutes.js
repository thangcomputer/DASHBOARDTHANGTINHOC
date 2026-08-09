const express = require('express');
const router = express.Router();
const systemLogController = require('../controllers/SystemLogController');
const { systemLogRepository } = require('../../report/repositories');
const { systemLogRepository } = require('../../report/repositories');
const SystemLog = require('../../report/models/SystemLog'); // Temp for new SystemLog // Temp for new SystemLog
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const {
  SYSTEM_LOG_VISIBLE_ACTIONS,
  isVisibleSystemLogAction,
} = require('../../../constants/systemLogActions');

// GET /api/system-logs — chỉ các hành động trong allowlist
router.get('/', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE),systemLogController.get_root);

// POST /api/system-logs — ghi tay (xuất báo cáo client-side, …)
router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE),systemLogController.post_root);

// DELETE /api/system-logs/:id
router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE),systemLogController.delete_id);

module.exports = router;
