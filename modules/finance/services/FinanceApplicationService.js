'use strict';
const Student = require('./../../student/models/Student');
const logger = require('./../../../config/logger');
const { isLedgerSot } = require('./../../../utils/financeFlags');

/**
 * financeRoutes — Ledger SoT (P0–P4).
 */
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

class FinanceApplicationService {
  async get_summary(data) {
  try {
    const branchId = resolveBranchId(req);
    const from = data.from || null;
    const to = data.to || null;
    const studentId = data.studentId || null;

    const ledger = await sumFinancialRevenue({ branchId, from, to, studentId });

    return { _status: 200, _body: ({
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
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async get_ledger(data) {
  try {
    const branchId = resolveBranchId(req);
    const data = await listLedgerEntries({
      branchId,
      studentId: data.studentId || null,
      teacherId: data.teacherId || null,
      type: data.type || null,
      from: data.from || null,
      to: data.to || null,
      status: data.status || 'posted',
      page: data.page || 1,
      limit: data.limit || 50,
    });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[FINANCE] ledger error:', err);
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async get_students_id(data) {
  try {
    const student = await Student.findById(data.id).select('branchId').lean();
    if (!student) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
    }
    if (data.branchFilter?.branchId) {
      const allowed = String(student.branchId || '') === String(data.branchFilter.branchId);
      if (!allowed) {
        return { _status: 403, _body: ({ success: false, message: 'Không có quyền xem HV chi nhánh khác' });
      }
    }
    const card = await getStudentFinanceCard(data.id);
    return { _status: 200, _body: ({ success: true, data: card });
  } catch (err) {
    const status = err.status || 500;
    logger.error('[FINANCE] student card error:', err);
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async post_ledger_id_void(data) {
  try {
    const result = await voidLedgerEntry({
      entryId: data.id,
      reason: data.body?.reason || '',
      actor: actorOf(req),
      createReversal: data.body?.createReversal !== false,
    });
    return { _status: 200, _body: ({
      success: true,
      message: result.created ? 'Đã void dòng ledger' : 'Dòng đã void trước đó',
      data: result,
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async post_discount(data) {
  try {
    const { studentId, amount, kind, enrollmentId, courseName, note, sourceRef } = data.body || {};
    if (!studentId) {
      return { _status: 400, _body: ({ success: false, message: 'Thiếu studentId' });
    }
    const student = await Student.findById(studentId);
    if (!student) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
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
    return { _status: 200, _body: ({ success: true, created, data: entry });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async get_reconcile(data) {
  try {
    const branchId = resolveBranchId(req);
    const report = await reconciliationReport({
      branchId,
      from: data.from || null,
      to: data.to || null,
    });
    return { _status: 200, _body: ({ success: true, data: report });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async post_snapshots_rebuild(data) {
  try {
    const branchId = resolveBranchId(req);
    const result = await rebuildDailySnapshots({
      branchId,
      from: data.body?.from || data.from || null,
      to: data.body?.to || data.to || null,
    });
    return { _status: 200, _body: ({ success: true, data: result });
  } catch (err) {
    logger.error('[FINANCE] snapshot rebuild:', err);
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi server' });
  }
}

  async post_students_id_sync_cache(data) {
  try {
    const data = await syncStudentFinanceCache(data.id);
    if (!data) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
    }
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message || 'Lỗi server' });
  }
}

}

module.exports = new FinanceApplicationService();
