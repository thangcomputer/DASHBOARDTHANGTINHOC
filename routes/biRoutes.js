const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter } = require('../middleware/auth');
const biService = require('../services/biService');
const logger = require('../config/logger');

// Admin / staff (branchFilter da gioi han chi nhanh)
const guard = [authMiddleware, branchFilter, (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'staff' || req.user?.id === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Khong co quyen BI' });
}];

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