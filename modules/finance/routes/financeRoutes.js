/**
 * financeRoutes — Ledger SoT (P0–P4).
 */
const express = require('express');
const router = express.Router();
const financeController = require('../controllers/FinanceController');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const {
  sumFinancialRevenue,
  listLedgerEntries,
  getStudentFinanceCard,
  voidLedgerEntry,
  reconciliationReport,
  rebuildDailySnapshots,
  syncStudentFinanceCache,
  postDiscount,
} = require('../services/ledgerService');
const Student = require('../../student/models/Student');
const logger = require('../../../config/logger');
const { isLedgerSot } = require('../../../utils/financeFlags');

const guard = [
  authMiddleware,
  authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE), ...legacyMapping.resolve(PERMISSIONS.VIEW_BRANCH_REVENUE)),
  branchFilter,
];

const manageGuard = [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter];
const voidGuard = [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE), branchFilter];
const paymentGuard = [authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE), branchFilter];

function resolveBranchId(req) {
  const q = req.query.branchId;
  if (req.branchFilter?.branchId) return String(req.branchFilter.branchId);
  if (q && q !== 'all') return String(q);
  return null;
}

function actorOf(req) {
  return {
    id: req.currentUser?.id || req.currentUser?._id || '',
    name: req.currentUser?.name || '',
    role: req.currentUser?.role || '',
  };
}

// GET /api/finance/summary
router.get('/summary', guard,financeController.get_summary);

// GET /api/finance/ledger
router.get('/ledger', guard,financeController.get_ledger);

// GET /api/finance/students/:id — card 5 chỉ tiêu TO-BE
router.get('/students/:id', guard,financeController.get_students_id);

// POST /api/finance/ledger/:id/void
router.post('/ledger/:id/void', voidGuard,financeController.post_ledger_id_void);

// POST /api/finance/discount — ghi discount/coupon
router.post('/discount', paymentGuard,financeController.post_discount);

// GET /api/finance/reconcile
router.get('/reconcile', manageGuard,financeController.get_reconcile);

// POST /api/finance/snapshots/rebuild
router.post('/snapshots/rebuild', manageGuard,financeController.post_snapshots_rebuild);

// POST /api/finance/students/:id/sync-cache — recompute paidAmount từ Ledger
router.post('/students/:id/sync-cache', manageGuard,financeController.post_students_id_sync_cache);

module.exports = router;
