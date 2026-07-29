/**
 * Finance / Ledger API (Phase 10).
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const LedgerEntry = require('../models/LedgerEntry');
const {
  sumFinancialRevenue,
  reconciliationReport,
} = require('../services/ledgerService');
const logger = require('../config/logger');

function resolveBranchId(req) {
  if (req.branchFilter?.branchId) return req.branchFilter.branchId;
  if (req.query.branchId && req.query.branchId !== 'all') return req.query.branchId;
  return null;
}

// GET /api/finance/ledger/summary — Σ financial revenue từ ledger
router.get(
  '/ledger/summary',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const branchId = resolveBranchId(req);
      const { from, to, studentId } = req.query;
      const summary = await sumFinancialRevenue({
        branchId,
        from: from || null,
        to: to || null,
        studentId: studentId || null,
      });
      return res.json({ success: true, data: summary });
    } catch (err) {
      logger.error('[FINANCE] summary:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/finance/ledger/reconcile — đối soát ledger ↔ invoice
router.get(
  '/ledger/reconcile',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const branchId = resolveBranchId(req);
      const report = await reconciliationReport({
        branchId,
        from: req.query.from || null,
        to: req.query.to || null,
      });
      return res.json({ success: true, data: report });
    } catch (err) {
      logger.error('[FINANCE] reconcile:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/finance/ledger/entries — danh sách append-only (read)
router.get(
  '/ledger/entries',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const filter = {};
      const branchId = resolveBranchId(req);
      if (branchId) filter.branchId = branchId;
      if (req.query.type) filter.type = req.query.type;
      if (req.query.studentId) filter.studentId = req.query.studentId;

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const [rows, total] = await Promise.all([
        LedgerEntry.find(filter).sort({ postedAt: -1 }).skip(skip).limit(limit).lean({ virtuals: true }),
        LedgerEntry.countDocuments(filter),
      ]);

      const data = rows.map((r) => ({
        ...r,
        signedAmount: r.type === 'refund' ? -Math.abs(r.amount) : Math.abs(r.amount),
      }));

      return res.json({ success: true, data, total, page, limit });
    } catch (err) {
      logger.error('[FINANCE] entries:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
