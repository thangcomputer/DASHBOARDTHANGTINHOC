const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/CmsController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const workflowService = require('../services/workflowService');
const logger = require('../../../config/logger');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];

router.get('/definitions', guard, (req, res) => {
  res.json({ success: true, data: workflowService.listDefinitions() });
});

router.get('/', guard,cmsController.get_root);

router.post('/sync', guard,cmsController.post_sync);

router.get('/:id', guard,cmsController.get_id);

router.post('/', guard,cmsController.post_root);

router.post('/:id/advance', guard,cmsController.post_id_advance);

module.exports = router;