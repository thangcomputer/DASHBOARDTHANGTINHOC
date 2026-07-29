/**
 * Ledger service — append-only accounting (Phase 10 / ADR 0001).
 * Financial revenue = Σ signedAmount (payment − refund). Soft-delete course không đụng ledger.
 */
const LedgerEntry = require('../models/LedgerEntry');
const { writeAudit } = require('./auditLogService');
const logger = require('../config/logger');

function signedOf(doc) {
  if (!doc) return 0;
  const amt = Number(doc.amount) || 0;
  if (doc.type === 'refund') return -Math.abs(amt);
  if (doc.type === 'adjustment' && doc.metadata?.direction === 'debit') return -Math.abs(amt);
  return Math.abs(amt);
}

/**
 * Insert ledger entry (idempotent theo idempotencyKey).
 * @returns {{ entry, created: boolean }}
 */
async function postEntry(payload) {
  const key = String(payload.idempotencyKey || '').trim();
  if (!key) {
    const err = new Error('Thiếu idempotencyKey cho ledger');
    err.status = 400;
    throw err;
  }
  const amount = Math.abs(Number(payload.amount) || 0);
  if (!(amount > 0) && payload.type !== 'adjustment') {
    const err = new Error('Số tiền ledger phải > 0');
    err.status = 400;
    throw err;
  }

  try {
    const entry = await LedgerEntry.create({
      idempotencyKey: key,
      type: payload.type,
      amount,
      currency: payload.currency || 'VND',
      status: 'posted',
      studentId: payload.studentId || null,
      branchId: payload.branchId || null,
      tenantId: payload.tenantId || null,
      enrollmentId: payload.enrollmentId ? String(payload.enrollmentId) : '',
      invoiceId: payload.invoiceId || null,
      courseName: payload.courseName || '',
      source: payload.source || 'system',
      sourceRef: payload.sourceRef || '',
      note: String(payload.note || '').slice(0, 500),
      metadata: payload.metadata || {},
      postedAt: payload.postedAt || new Date(),
      postedBy: payload.postedBy || '',
      postedByRole: payload.postedByRole || '',
      reversesEntryId: payload.reversesEntryId || null,
    });
    return { entry, created: true };
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await LedgerEntry.findOne({ idempotencyKey: key });
      return { entry: existing, created: false };
    }
    throw err;
  }
}

/**
 * Payment settled → credit ledger.
 */
async function settlePayment({
  student,
  amount,
  invoice = null,
  enrollmentId = null,
  courseName = '',
  source = 'admin_pay',
  sourceRef = '',
  idempotencyKey,
  actor = {},
  note = '',
  metadata = {},
  reqMeta = {},
}) {
  const amt = Math.abs(Number(amount) || 0);
  if (!(amt > 0)) return { entry: null, created: false };

  const key = idempotencyKey
    || `payment:${source}:${student?._id || 'x'}:${sourceRef || invoice?._id || Date.now()}`;

  const { entry, created } = await postEntry({
    idempotencyKey: key,
    type: 'payment',
    amount: amt,
    studentId: student?._id || null,
    branchId: student?.branchId || reqMeta.branchId || null,
    tenantId: student?.tenantId || null,
    enrollmentId,
    invoiceId: invoice?._id || null,
    courseName: courseName || student?.course || '',
    source,
    sourceRef: sourceRef || invoice?.maHoaDon || '',
    note,
    metadata,
    postedBy: actor.id || '',
    postedByRole: actor.role || '',
  });

  if (created) {
    try {
      await writeAudit({
        action: 'payment.settle',
        actorUserId: actor.id || '',
        actorRole: actor.role || '',
        branchId: student?.branchId || reqMeta.branchId || null,
        entityType: 'ledger',
        entityId: String(entry._id),
        studentId: student?._id || null,
        oldValue: {},
        newValue: {
          amount: amt,
          source,
          sourceRef: entry.sourceRef,
          idempotencyKey: key,
        },
        ip: reqMeta.ip || '',
        userAgent: reqMeta.userAgent || '',
      });
    } catch (err) {
      logger.warn('[ledger] audit settle: %s', err.message);
    }
  }

  return { entry, created };
}

/**
 * Refund = reversal entry mới (không xóa payment gốc / Invoice).
 */
async function postRefund({
  student,
  amount,
  originalEntryId = null,
  courseName = '',
  sourceRef = '',
  idempotencyKey,
  actor = {},
  note = '',
  metadata = {},
  reqMeta = {},
}) {
  const amt = Math.abs(Number(amount) || 0);
  if (!(amt > 0)) {
    const err = new Error('Số tiền hoàn phải > 0');
    err.status = 400;
    throw err;
  }

  const key = idempotencyKey
    || `refund:${student?._id || 'x'}:${sourceRef || Date.now()}`;

  const { entry, created } = await postEntry({
    idempotencyKey: key,
    type: 'refund',
    amount: amt,
    studentId: student?._id || null,
    branchId: student?.branchId || reqMeta.branchId || null,
    tenantId: student?.tenantId || null,
    courseName: courseName || student?.course || '',
    source: 'refund',
    sourceRef,
    note,
    metadata,
    postedBy: actor.id || '',
    postedByRole: actor.role || '',
    reversesEntryId: originalEntryId || null,
  });

  if (created) {
    try {
      await writeAudit({
        action: 'payment.refund',
        actorUserId: actor.id || '',
        actorRole: actor.role || '',
        branchId: student?.branchId || reqMeta.branchId || null,
        entityType: 'ledger',
        entityId: String(entry._id),
        studentId: student?._id || null,
        oldValue: {},
        newValue: {
          amount: amt,
          reversesEntryId: originalEntryId,
          note,
        },
        ip: reqMeta.ip || '',
        userAgent: reqMeta.userAgent || '',
      });
    } catch (err) {
      logger.warn('[ledger] audit refund: %s', err.message);
    }
  }

  return { entry, created };
}

/**
 * Σ financial revenue từ ledger (không phụ thuộc Course.deletedAt).
 */
async function sumFinancialRevenue({
  branchId = null,
  from = null,
  to = null,
  studentId = null,
} = {}) {
  const match = { status: 'posted' };
  if (branchId) match.branchId = branchId;
  if (studentId) match.studentId = studentId;
  if (from || to) {
    match.postedAt = {};
    if (from) match.postedAt.$gte = new Date(from);
    if (to) match.postedAt.$lte = new Date(to);
  }

  const rows = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let payments = 0;
  let refunds = 0;
  let adjustments = 0;
  let paymentCount = 0;
  let refundCount = 0;

  for (const r of rows) {
    if (r._id === 'payment') {
      payments = r.total;
      paymentCount = r.count;
    } else if (r._id === 'refund') {
      refunds = r.total;
      refundCount = r.count;
    } else if (r._id === 'adjustment') {
      adjustments = r.total;
    }
  }

  const net = payments - refunds; // adjustment xử lý riêng nếu cần
  return {
    payments,
    refunds,
    adjustments,
    net,
    paymentCount,
    refundCount,
  };
}

/**
 * Báo cáo đối soát: ledger vs invoice totals (cùng kỳ).
 */
async function reconciliationReport({ branchId = null, from = null, to = null } = {}) {
  const Invoice = require('../models/Invoice');
  const ledger = await sumFinancialRevenue({ branchId, from, to });

  const invMatch = {};
  if (from || to) {
    invMatch.createdAt = {};
    if (from) invMatch.createdAt.$gte = new Date(from);
    if (to) invMatch.createdAt.$lte = new Date(to);
  }
  // Invoice không có branchId — lọc qua student nếu có branch
  let invoiceTotal = 0;
  let invoiceCount = 0;
  if (branchId) {
    const Student = require('../models/Student');
    const ids = await Student.find({ branchId }).select('_id').lean();
    const studentIds = ids.map((s) => s._id);
    invMatch.hocVien = { $in: studentIds };
  }
  const invAgg = await Invoice.aggregate([
    { $match: invMatch },
    {
      $group: {
        _id: null,
        total: { $sum: '$hocPhi' },
        count: { $sum: 1 },
      },
    },
  ]);
  if (invAgg[0]) {
    invoiceTotal = invAgg[0].total || 0;
    invoiceCount = invAgg[0].count || 0;
  }

  return {
    ledger,
    invoices: { total: invoiceTotal, count: invoiceCount },
    /** Chênh lệch payments ledger vs invoice (refund không nằm trên Invoice) */
    deltaPaymentsVsInvoices: ledger.payments - invoiceTotal,
    policy: 'Financial SoT = LedgerEntry; soft-delete course không ảnh hưởng net',
  };
}

/** Pure helper — soft-delete course không đổi Σ ledger (dùng trong test). */
function financialRevenueUnaffectedByCourseDelete(ledgerNetBefore, ledgerNetAfter) {
  return Number(ledgerNetBefore) === Number(ledgerNetAfter);
}

module.exports = {
  postEntry,
  settlePayment,
  postRefund,
  sumFinancialRevenue,
  reconciliationReport,
  signedOf,
  financialRevenueUnaffectedByCourseDelete,
};
