const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter } = require('../middleware/auth');
const { policyShadowBI } = require('../middleware/policyShadowBI');
const { biCutoverGate } = require('../middleware/biCutoverGate');
const biService = require('../services/biService');
const logger = require('../config/logger');

/**
 * Phase 7.26 — Controlled cutover for LIVE /api/bi ONLY.
 *
 * Flow: auth → branchFilter (DATA SCOPE) → policyShadowBI → biCutoverGate → handler
 * Legacy MANAGE_FINANCE|VIEW_BRANCH_REVENUE gate retained inside biCutoverGate.
 * Aggregation / CSV remain handler-owned via overview service.
 * modules/finance BiController is unmounted — not migrated.
 */
const guard = (action) => [
  authMiddleware,
  branchFilter,
  policyShadowBI(action),
  biCutoverGate(action),
];

router.get('/overview', guard('overview'), async (req, res) => {
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

router.get('/export', guard('export'), async (req, res) => {
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
