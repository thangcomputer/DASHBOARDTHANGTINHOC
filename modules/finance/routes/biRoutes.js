const express = require('express');
const router = express.Router();
const biController = require('../controllers/BiController');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const biService = require('../services/biService');
const logger = require('../../../config/logger');

// Cùng quyền với Báo cáo doanh thu / analytics
const guard = [
  authMiddleware,
  authorize(NEW_PERMISSIONS.FINANCE_VIEW),
  branchFilter,
];

router.get('/overview', guard,biController.get_overview);

router.get('/export', guard,biController.get_export);

module.exports = router;