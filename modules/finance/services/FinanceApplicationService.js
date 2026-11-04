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
function resolveBranchId(data) {
  const q = data.query?.branchId || data.branchId;
  if (data.branchFilter?.branchId) return String(data.branchFilter.branchId);
  if (q && q !== 'all') return String(q);
  return null;
}
function actorOf(data) {
  return {
    id: data.currentUser?.id || data.currentUser?._id || '',
    name: data.currentUser?.name || '',
    role: data.currentUser?.role || '',
  };
}
// GET /api/finance/summary

class FinanceApplicationService {
  async get_summary(data) {
  try {
    const branchId = resolveBranchId(data);
    const from = data.from || null;
    const to = data.to || null;
    const studentId = data.studentId || null;

    const ledger = await sumFinancialRevenue({ branchId, from, to, studentId });

    return { _status: 200, _body: {
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
    } };
  } catch (err) {
    logger.error('[FINANCE] summary error:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async get_ledger(data) {
  try {
    const branchId = resolveBranchId(data);
    const entries = await listLedgerEntries({
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
    return { _status: 200, _body: { success: true, data: entries } };
  } catch (err) {
    logger.error('[FINANCE] ledger error:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async get_students_id(data) {
  try {
    const student = await Student.findById(data.id).select('branchId').lean();
    if (!student) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy học viên' } };
    }
    if (data.branchFilter?.branchId) {
      const allowed = String(student.branchId || '') === String(data.branchFilter.branchId);
      if (!allowed) {
        return { _status: 403, _body: { success: false, message: 'Không có quyền xem HV chi nhánh khác' } };
      }
    }
    const card = await getStudentFinanceCard(data.id);
    return { _status: 200, _body: { success: true, data: card } };
  } catch (err) {
    const status = err.status || 500;
    logger.error('[FINANCE] student card error:', err);
    return { _status: status, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async post_ledger_id_void(data) {
  try {
    const result = await voidLedgerEntry({
      entryId: data.id,
      reason: data.body?.reason || '',
      actor: actorOf(data),
      createReversal: data.body?.createReversal !== false,
    });
    return { _status: 200, _body: {
      success: true,
      message: result.created ? 'Đã void dòng ledger' : 'Dòng đã void trước đó',
      data: result,
    } };
  } catch (err) {
    const status = err.status || 500;
    return { _status: status, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async post_discount(data) {
  try {
    const { studentId, amount, kind, enrollmentId, courseName, note, sourceRef } = data.body || {};
    if (!studentId) {
      return { _status: 400, _body: { success: false, message: 'Thiếu studentId' } };
    }
    const student = await Student.findById(studentId);
    if (!student) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy học viên' } };
    }
    const { entry, created } = await postDiscount({
      student,
      amount,
      kind: kind === 'coupon' ? 'coupon' : 'discount',
      enrollmentId,
      courseName,
      sourceRef: sourceRef || `discount:${studentId}:${enrollmentId || 'x'}`,
      actor: actorOf(data),
      note: note || '',
    });
    return { _status: 200, _body: { success: true, created, data: entry } };
  } catch (err) {
    const status = err.status || 500;
    return { _status: status, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async get_reconcile(data) {
  try {
    const branchId = resolveBranchId(data);
    const report = await reconciliationReport({
      branchId,
      from: data.from || null,
      to: data.to || null,
    });
    return { _status: 200, _body: { success: true, data: report } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async post_snapshots_rebuild(data) {
  try {
    const branchId = resolveBranchId(data);
    const result = await rebuildDailySnapshots({
      branchId,
      from: data.body?.from || data.from || null,
      to: data.body?.to || data.to || null,
    });
    return { _status: 200, _body: { success: true, data: result } };
  } catch (err) {
    logger.error('[FINANCE] snapshot rebuild:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

  async post_students_id_sync_cache(data) {
  try {
    const result = await syncStudentFinanceCache(data.id);
    if (!result) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy học viên' } };
    }
    return { _status: 200, _body: { success: true, data: result } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: err.message || 'Lỗi server' } };
  }
}

}

module.exports = new FinanceApplicationService();
