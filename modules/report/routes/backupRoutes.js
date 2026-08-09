const express = require('express');
const router = express.Router();
const backupController = require('../controllers/BackupController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const logger = require('../../../config/logger');
const backupService = require('../services/backupService');
const { enqueue } = require('../../../services/queue/jobQueue');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];

// GET /api/backups/stats
router.get('/stats', guard,backupController.get_stats);

// GET /api/backups
router.get('/', guard,backupController.get_root);

// POST /api/backups — tao backup (async qua queue)
router.post('/', guard,backupController.post_root);

// GET /api/backups/:id/download
router.get('/:id/download', guard,backupController.get_id_download);

// DELETE /api/backups/:id
router.delete('/:id', guard,backupController.delete_id);

module.exports = router;