/**
 * financeRoutes — Ledger SoT (P0–P4).
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, checkAnyPermission, checkPermission, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { policyShadowFinance } = require('../middleware/policyShadowFinance');
const {
  sumFinancialRevenue,
  listLedgerEntries,
  getStudentFinanceCard,
  voidLedgerEntry,
  reconciliationReport,
  rebuildDailySnapshots,
  syncStudentFinanceCache,
  postDiscount,
  healOrphanEnrollmentPayments,
} = require('../services/ledgerService');
const Student = require('../models/Student');
const logger = require('../config/logger');
const { isLedgerSot } = require('../utils/financeFlags');

const readGuard = (action) => [
  authMiddleware,
  branchFilter,
  policyShadowFinance(action),
  checkAnyPermission(PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE),
];

const manageGuard = (action) => [
  authMiddleware,
  branchFilter,
  policyShadowFinance(action),
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
];

function resolveBranchId(req) {
  const q = req.query.branchId;
  if (req.branchFilter?.branchId) return String(req.branchFilter.branchId);
  if (q && q !== 'all') return String(q);
  return null;
}

function actorOf(req) {
  return {
    id: req.user?.id || req.user?._id || '',
    name: req.user?.name || '',
    role: req.user?.role || '',
  };
}

// GET /api/finance/summary
router.get('/summary', readGuard('summary'), async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const from = req.query.from || null;
    const to = req.query.to || null;
    const studentId = req.query.studentId || null;

    const ledger = await sumFinancialRevenue({ branchId, from, to, studentId });

    return res.json({
      success: true,
      data: {
        source: 'ledger',
        ledgerSot: isLedgerSot(),
        branchId: branchId || 'all',
        from,
        to,
        payments: ledger.payments,
        refunds: ledger.refunds,
        net: ledger.net,
        costs: ledger.costs,
        profit: ledger.profit,
        adjustments: ledger.adjustments,
        paymentCount: ledger.paymentCount,
        refundCount: ledger.refundCount,
      },
    });
  } catch (err) {
    logger.error('[FINANCE] summary error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// GET /api/finance/ledger
router.get('/ledger', readGuard('ledger_list'), async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const data = await listLedgerEntries({
      branchId,
      studentId: req.query.studentId || null,
      teacherId: req.query.teacherId || null,
      type: req.query.type || null,
      from: req.query.from || null,
      to: req.query.to || null,
      status: req.query.status || 'posted',
      page: req.query.page || 1,
      limit: req.query.limit || 50,
    });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[FINANCE] ledger error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// GET /api/finance/students/:id — card 5 chỉ tiêu TO-BE
router.get('/students/:id', readGuard('student_card'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('branchId').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    if (req.branchFilter?.branchId) {
      const allowed = String(student.branchId || '') === String(req.branchFilter.branchId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem HV chi nhánh khác' });
      }
    }
    const card = await getStudentFinanceCard(req.params.id);
    return res.json({ success: true, data: card });
  } catch (err) {
    const status = err.status || 500;
    logger.error('[FINANCE] student card error:', err);
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// POST /api/finance/students/:id/heal-orphans — admin reconcile only (not on GET card)
router.post('/students/:id/heal-orphans', manageGuard('heal_orphans'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    if (req.branchFilter?.branchId) {
      const allowed = String(student.branchId || '') === String(req.branchFilter.branchId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Không có quyền heal HV chi nhánh khác' });
      }
    }
    const result = await healOrphanEnrollmentPayments(student);
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// POST /api/finance/ledger/:id/void
router.post('/ledger/:id/void', manageGuard('ledger_void'), async (req, res) => {
  try {
    const result = await voidLedgerEntry({
      entryId: req.params.id,
      reason: req.body?.reason || '',
      actor: actorOf(req),
      createReversal: req.body?.createReversal !== false,
    });
    return res.json({
      success: true,
      message: result.created ? 'Đã void dòng ledger' : 'Dòng đã void trước đó',
      data: result,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// POST /api/finance/discount — ghi discount/coupon
router.post('/discount', manageGuard('discount'), async (req, res) => {
  try {
    const { studentId, amount, kind, enrollmentId, courseName, note, sourceRef } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Thiếu studentId' });
    }
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    const { entry, created } = await postDiscount({
      student,
      amount,
      kind: kind === 'coupon' ? 'coupon' : 'discount',
      enrollmentId,
      courseName,
      sourceRef: sourceRef || `discount:${studentId}:${enrollmentId || 'x'}`,
      actor: actorOf(req),
      note: note || '',
    });
    return res.json({ success: true, created, data: entry });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// GET /api/finance/reconcile
router.get('/reconcile', manageGuard('reconcile'), async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const report = await reconciliationReport({
      branchId,
      from: req.query.from || null,
      to: req.query.to || null,
    });
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// POST /api/finance/snapshots/rebuild
router.post('/snapshots/rebuild', manageGuard('snapshots_rebuild'), async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const result = await rebuildDailySnapshots({
      branchId,
      from: req.body?.from || req.query.from || null,
      to: req.body?.to || req.query.to || null,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[FINANCE] snapshot rebuild:', err);
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

// POST /api/finance/students/:id/sync-cache — recompute paidAmount từ Ledger
router.post('/students/:id/sync-cache', manageGuard('sync_cache'), async (req, res) => {
  try {
    const data = await syncStudentFinanceCache(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
});

module.exports = router;
