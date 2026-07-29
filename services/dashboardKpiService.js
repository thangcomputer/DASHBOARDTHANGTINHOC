/**
 * Dashboard KPI — tách Operational vs Financial (Phase 14 / ADR 0001).
 *
 * Operational: catalog đang bán, HV active, lịch hôm nay… (có thể loại soft-deleted course)
 * Financial: Σ LedgerEntry (payment − refund) — soft-delete course KHÔNG làm giảm
 */
const Course = require('../models/Course');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const { activeCourseFilter } = require('./courseLifecycleService');
const { sumPaidRevenue } = require('./revenueAggregate');
const { sumFinancialRevenue, financialRevenueUnaffectedByCourseDelete } = require('./ledgerService');
const { getQueueMode } = require('./queue/jobQueue');
const DomainOutbox = require('../models/DomainOutbox');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/** Nhãn nguồn KPI — UI/API bắt buộc phân biệt */
const KPI_SOURCES = Object.freeze({
  OPERATIONAL: 'operational',
  FINANCIAL_LEDGER: 'financial_ledger',
  OPERATIONAL_ENROLLMENT: 'operational_enrollment', // revenueAggregate / enrollment paid (không phải sổ cái)
});

/**
 * Pure: soft-delete course chỉ ảnh hưởng ops catalog, không ảnh hưởng financial net.
 */
function applySoftDeleteToOpsCatalog(courses = []) {
  return (courses || []).filter((c) => !c.deletedAt);
}

function assertKpisNotMixed(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const ops = payload.operational;
  const fin = payload.financial;
  if (!ops || !fin) return false;
  if (ops.source === fin.source) return false;
  if (fin.source !== KPI_SOURCES.FINANCIAL_LEDGER) return false;
  if (ops.source !== KPI_SOURCES.OPERATIONAL) return false;
  // financial không được lấy từ Course.price × count
  if (fin.derivedFrom === 'course_price_times_count') return false;
  return true;
}

/**
 * Pure notify load-test accuracy: N gửi cùng eventId → 1 unique (idempotent).
 */
function simulateNotifyIdempotentLoad({ total = 100, eventId = 'load:test' } = {}) {
  const seen = new Set();
  let delivered = 0;
  let duplicates = 0;
  for (let i = 0; i < total; i += 1) {
    const key = `${eventId}::receiver`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    delivered += 1;
  }
  return {
    attempted: total,
    delivered,
    duplicates,
    accurate: delivered === 1 && duplicates === total - 1,
  };
}

/**
 * Báo cáo độ chính xác: financial trước/sau soft-delete phải khớp.
 */
function reportAccuracyAfterCourseSoftDelete({ ledgerNetBefore, ledgerNetAfter, opsCatalogBefore, opsCatalogAfter }) {
  const financialOk = financialRevenueUnaffectedByCourseDelete(ledgerNetBefore, ledgerNetAfter);
  const opsChanged = Number(opsCatalogAfter) < Number(opsCatalogBefore); // ẩn khóa đã xóa
  return {
    financialUnchanged: financialOk,
    operationalCatalogReduced: opsChanged,
    accurate: financialOk === true,
    message: financialOk
      ? 'OK: soft-delete không lệch sổ cái; catalog ops có thể giảm'
      : 'FAIL: financial net bị đổi sau soft-delete',
  };
}

async function buildOperationalKpis({ branchFilter = {} } = {}) {
  const bf = { ...branchFilter };
  const courseFilter = activeCourseFilter(bf.branchId ? { branchId: bf.branchId } : {});

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [
    activeCourses,
    softDeletedCourses,
    activeStudents,
    teachersActive,
    schedulesToday,
    enrollmentOpsRevenue,
  ] = await Promise.all([
    Course.countDocuments(courseFilter),
    Course.countDocuments({
      ...(bf.branchId ? { branchId: bf.branchId } : {}),
      deletedAt: { $ne: null },
    }),
    Student.countDocuments({
      ...bf,
      status: { $nin: ['Nghỉ học', 'Bảo lưu'] },
    }),
    Teacher.countDocuments(bf),
    Schedule.countDocuments({
      ...bf,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['scheduled', 'completed'] },
    }),
    sumPaidRevenue({ branchFilter: bf }),
  ]);

  return {
    source: KPI_SOURCES.OPERATIONAL,
    label: 'Vận hành (catalog / học viên / lịch)',
    activeCourses,
    softDeletedCourses,
    activeStudents,
    teachersActive,
    schedulesToday,
    /** Doanh thu enrollment — KPI bán hàng, KHÔNG phải sổ cái */
    enrollmentPaidTotal: enrollmentOpsRevenue.total || 0,
    enrollmentPaidSource: KPI_SOURCES.OPERATIONAL_ENROLLMENT,
    note: 'enrollmentPaidTotal có thể khác financial.ledgerNet; soft-delete course ẩn khỏi activeCourses',
  };
}

async function buildFinancialKpis({ branchId = null, from = null, to = null } = {}) {
  const ledger = await sumFinancialRevenue({ branchId, from, to });
  return {
    source: KPI_SOURCES.FINANCIAL_LEDGER,
    label: 'Tài chính (Ledger append-only)',
    derivedFrom: 'ledger_entries',
    payments: ledger.payments,
    refunds: ledger.refunds,
    ledgerNet: ledger.net,
    paymentCount: ledger.paymentCount,
    refundCount: ledger.refundCount,
    note: 'Soft-delete course không làm giảm ledgerNet; chỉ refund/reversal mới giảm',
  };
}

async function getQueueMetrics() {
  const mode = getQueueMode();
  let outboxPending = 0;
  let outboxFailed = 0;
  try {
    [outboxPending, outboxFailed] = await Promise.all([
      DomainOutbox.countDocuments({ status: 'pending' }),
      DomainOutbox.countDocuments({ status: 'failed' }),
    ]);
  } catch (err) {
    logger.warn('[dashboardKpi] outbox metrics: %s', err.message);
  }
  return {
    queueMode: mode,
    outboxPending,
    outboxFailed,
    healthy: mode === 'inline' || mode === 'bullmq',
  };
}

/**
 * Archive audit cũ (không DELETE — ADR append-only). Ẩn khỏi query mặc định.
 */
async function archiveOldAuditLogs({ olderThanDays = 90, limit = 5000 } = {}) {
  const days = Math.max(1, Number(olderThanDays) || 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const max = Math.min(20000, Math.max(1, Number(limit) || 5000));
  const ids = await AuditLog.find({
    at: { $lt: cutoff },
    $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
  })
    .select('_id')
    .sort({ at: 1 })
    .limit(max)
    .lean();

  if (!ids.length) {
    return { cutoff, matched: 0, archived: 0 };
  }

  const result = await AuditLog.updateMany(
    { _id: { $in: ids.map((d) => d._id) } },
    { $set: { archivedAt: new Date() } },
  );

  return {
    cutoff,
    matched: ids.length,
    archived: result.modifiedCount || 0,
  };
}

async function buildDashboardKpis({ branchFilter = {}, branchId = null, from = null, to = null } = {}) {
  const bf = { ...branchFilter };
  if (branchId && !bf.branchId) bf.branchId = branchId;

  const [operational, financial, queue] = await Promise.all([
    buildOperationalKpis({ branchFilter: bf }),
    buildFinancialKpis({
      branchId: bf.branchId || branchId || null,
      from,
      to,
    }),
    getQueueMetrics(),
  ]);

  const payload = {
    operational,
    financial,
    queue,
    generatedAt: new Date().toISOString(),
  };

  payload.meta = {
    kpisSeparated: assertKpisNotMixed(payload),
    policy: 'Dashboard must not mix Course.price×count into financial.ledgerNet',
  };

  return payload;
}

module.exports = {
  KPI_SOURCES,
  applySoftDeleteToOpsCatalog,
  assertKpisNotMixed,
  simulateNotifyIdempotentLoad,
  reportAccuracyAfterCourseSoftDelete,
  buildOperationalKpis,
  buildFinancialKpis,
  getQueueMetrics,
  archiveOldAuditLogs,
  buildDashboardKpis,
};
