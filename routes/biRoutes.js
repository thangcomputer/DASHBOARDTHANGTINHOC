const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter, checkAnyPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const biService = require('../services/biService');
const logger = require('../config/logger');

// Cùng quyền với Báo cáo doanh thu / analytics
const guard = [
  authMiddleware,
  checkAnyPermission(PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE),
  branchFilter,
];

router.get('/overview', guard, async (req, res) => {
  try {
    const data = await biService.getOverview({
      period: req.query.period || '1m',
      branchFilter: req.branchFilter || {},
      queryBranch: req.query.branchId || 'all',
    });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[BI] overview:', err);
    res.status(500).json({ success: false, message: err.message || 'Loi server' });
  }
});

router.get('/export', guard, async (req, res) => {
  try {
    const data = await biService.getOverview({
      period: req.query.period || '1m',
      branchFilter: req.branchFilter || {},
      queryBranch: req.query.branchId || 'all',
    });
    const csv = biService.overviewToCsv(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bi-overview-' + (req.query.period || '1m') + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    logger.error('[BI] export:', err);
    res.status(500).json({ success: false, message: err.message || 'Loi server' });
  }
});

module.exports = router;