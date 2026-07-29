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
  if (doc.type === 'salary' || doc.type === 'bonus' || doc.type === 'expense') return -Math.abs(amt);
  if (doc.type === 'discount' || doc.type === 'coupon') return -Math.abs(amt);
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
      teacherId: payload.teacherId || null,
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
    || `payment:${source}:${student?._id || 'x'}:${sourceRef || invoice?._id || 'missing-ref'}`;
  if (!idempotencyKey && !(sourceRef || invoice?._id)) {
    logger.warn('[ledger] settlePayment missing stable sourceRef/invoice — key may collide');
  }

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

  // Trùng idempotencyKey chỉ OK khi cùng HV + số tiền + cùng enrollment (nếu đang gắn enrollment).
  // Tránh: đăng ký lại khóa / key cũ không enrollmentId → không ghi PAYMENT mới nhưng enrollment vẫn paid.
  if (!created && entry) {
    const sameStudent = String(entry.studentId || '') === String(student?._id || '');
    const sameAmt = Math.abs(Number(entry.amount) || 0) === amt;
    const wantEnr = enrollmentId ? String(enrollmentId) : '';
    const gotEnr = entry.enrollmentId ? String(entry.enrollmentId) : '';
    const sameType = entry.type === 'payment' && entry.status === 'posted';
    const sameEnr = wantEnr ? gotEnr === wantEnr : true;
    if (!(sameStudent && sameAmt && sameType && sameEnr)) {
      const err = new Error(
        'Ledger idempotency trùng nhưng khác enrollment/số tiền — từ chối ghi im lặng',
      );
      err.status = 409;
      err.code = 'LEDGER_IDEMPOTENCY_COLLISION';
      throw err;
    }
  }

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
  enrollmentId = null,
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
    || `refund:${student?._id || 'x'}:${sourceRef || 'missing-ref'}`;
  if (!idempotencyKey && !sourceRef) {
    logger.warn('[ledger] postRefund missing stable sourceRef — key may collide');
  }

  const { entry, created } = await postEntry({
    idempotencyKey: key,
    type: 'refund',
    amount: amt,
    studentId: student?._id || null,
    branchId: student?.branchId || reqMeta.branchId || null,
    tenantId: student?.tenantId || null,
    enrollmentId: enrollmentId || metadata.enrollmentId || '',
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
    try {
      await issueCreditNoteForRefund({
        student,
        amount: amt,
        ledgerEntry: entry,
        enrollmentId: enrollmentId || metadata.enrollmentId || '',
        courseName: courseName || student?.course || '',
        reason: note,
        originalInvoiceId: metadata.originalInvoiceId || null,
        actor,
      });
    } catch (err) {
      logger.error('[ledger] credit note on refund FAILED — void refund entry: %s', err.message);
      try {
        await voidLedgerEntry({
          entryId: entry._id,
          reason: `CreditNote fail: ${err.message}`,
          actor,
          createReversal: true,
        });
      } catch (voidErr) {
        logger.error('[ledger] void after CN fail: %s', voidErr.message);
      }
      throw err;
    }
  }

  return { entry, created };
}

/**
 * Σ financial revenue từ ledger (không phụ thuộc Course.deletedAt).
 * P0: Dashboard/BI SoT = payments − refunds.
 */
async function sumFinancialRevenue({
  branchId = null,
  from = null,
  to = null,
  studentId = null,
} = {}) {
  const mongoose = require('mongoose');
  const match = { status: 'posted' };
  if (branchId) {
    match.branchId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;
  }
  if (studentId) {
    match.studentId = mongoose.Types.ObjectId.isValid(studentId)
      ? new mongoose.Types.ObjectId(studentId)
      : studentId;
  }
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
  let costs = 0;
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
    } else if (r._id === 'salary' || r._id === 'bonus' || r._id === 'expense') {
      costs += r.total;
    }
  }

  const net = payments - refunds;
  const profit = net - costs;
  return {
    payments,
    refunds,
    adjustments,
    costs,
    net,
    profit,
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

function toObjectId(id) {
  if (!id) return null;
  const mongoose = require('mongoose');
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Danh sách sổ cái (paginated).
 */
async function listLedgerEntries({
  branchId = null,
  studentId = null,
  teacherId = null,
  type = null,
  from = null,
  to = null,
  status = 'posted',
  page = 1,
  limit = 50,
} = {}) {
  const match = {};
  if (status) match.status = status;
  if (branchId) match.branchId = toObjectId(branchId);
  if (studentId) match.studentId = toObjectId(studentId);
  if (teacherId) match.teacherId = toObjectId(teacherId);
  if (type) {
    const types = String(type).split(',').map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) match.type = types[0];
    else if (types.length > 1) match.type = { $in: types };
  }
  if (from || to) {
    match.postedAt = {};
    if (from) match.postedAt.$gte = new Date(from);
    if (to) match.postedAt.$lte = new Date(to);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * lim;

  const [items, total] = await Promise.all([
    LedgerEntry.find(match)
      .sort({ postedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    LedgerEntry.countDocuments(match),
  ]);

  return {
    items: items.map((e) => ({
      ...e,
      signedAmount: signedOf(e),
    })),
    total,
    page: pageNum,
    limit: lim,
    pages: Math.ceil(total / lim) || 1,
  };
}

/**
 * Ghi PAYMENT còn thiếu cho enrollment đã paid (active) — thường gặp sau đăng ký lại
 * khi settlePayment trả created:false do trùng idempotency mà UI vẫn giữ paid + HĐ.
 * Chỉ match theo enrollmentId (không soft-match courseName — tránh gắn nhầm payment khóa đã hủy).
 */
async function healOrphanEnrollmentPayments(student) {
  if (!student?._id) return { healed: 0 };
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const paidActive = enrollments.filter((e) => {
    const st = String(e.status || 'active');
    if (st === 'cancelled' || st === 'refunded') return false;
    const paid = e.paid === true || e.paid === 'Đã đóng phí' || e.paid === 'true' || e.paid === 1;
    return paid && (Number(e.price) || 0) > 0 && e._id;
  });
  if (!paidActive.length) return { healed: 0 };

  const payments = await LedgerEntry.find({
    studentId: student._id,
    type: 'payment',
    status: 'posted',
  }).select('enrollmentId amount').lean();

  const covered = new Set(
    payments
      .map((p) => String(p.enrollmentId || '').trim())
      .filter(Boolean),
  );

  let healed = 0;
  for (const enr of paidActive) {
    const enrId = String(enr._id);
    if (covered.has(enrId)) continue;
    const amount = Number(enr.price) || 0;
    try {
      const { created } = await settlePayment({
        student,
        amount,
        enrollmentId: enrId,
        courseName: enr.courseName || '',
        source: 'heal_orphan_enrollment',
        sourceRef: `heal:${student._id}:${enrId}`,
        idempotencyKey: `payment:heal:${student._id}:${enrId}`,
        note: `Heal PAYMENT thiếu cho khóa ${enr.courseName || enrId}`,
      });
      if (created) {
        healed += 1;
        covered.add(enrId);
        logger.warn(
          '[ledger] healed orphan PAYMENT student=%s enrollment=%s amount=%s',
          student._id,
          enrId,
          amount,
        );
      }
    } catch (err) {
      logger.error(
        '[ledger] heal orphan PAYMENT failed student=%s enrollment=%s: %s',
        student._id,
        enrId,
        err.message,
      );
    }
  }
  return { healed };
}

/**
 * Student Finance Card — 5 chỉ tiêu TO-BE (+ outstanding).
 */
async function getStudentFinanceCard(studentId) {
  const Student = require('../models/Student');
  const student = await Student.findById(studentId)
    .select('name enrollments branchId paid paidAmount course price tenantId')
    .lean();
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  // Tự heal trước khi cộng KPI — đóng lệch "HĐ có / enrollment paid / Ledger thiếu"
  try {
    await healOrphanEnrollmentPayments(student);
  } catch (err) {
    logger.warn('[ledger] heal on finance card: %s', err.message);
  }

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const registeredFee = enrollments.reduce((s, e) => s + (Number(e.price) || 0), 0)
    || (Number(student.price) || 0);

  const ACTIVE = new Set(['active', 'completed', 'paused', 'pending_payment', 'Đang học', 'Hoàn thành']);
  const activeCourseValue = enrollments.length
    ? enrollments
      .filter((e) => {
        const st = String(e.status || 'active');
        return st !== 'cancelled' && st !== 'refunded' && (ACTIVE.has(st) || !e.status);
      })
      .reduce((s, e) => s + (Number(e.price) || 0), 0)
    : (student.paid ? 0 : (Number(student.price) || 0));

  const ledger = await sumFinancialRevenue({ studentId });
  const ledgerPayments = ledger.payments || 0;
  const refundedCashOut = ledger.refunds || 0;
  const netCollected = Math.max(0, ledgerPayments - refundedCashOut);
  // Tiền đã thu còn gắn khóa hiệu lực (hủy ≠ vẫn "đã thanh toán" trên card)
  const activePaidCash = enrollments.length
    ? enrollments
      .filter((e) => {
        const st = String(e.status || 'active');
        if (st === 'cancelled' || st === 'refunded') return false;
        return e.paid === true || e.paid === 'Đã đóng phí' || e.paid === 'true' || e.paid === 1;
      })
      .reduce((s, e) => s + (Number(e.price) || 0), 0)
    : (student.paid ? (Number(student.price) || 0) : 0);
  // Còn phải đóng = giá khóa còn hiệu lực − đã thu trên khóa active
  const outstanding = Math.max(0, activeCourseValue - activePaidCash);

  const { items: lines } = await listLedgerEntries({
    studentId,
    type: 'payment,refund,discount,coupon,adjustment',
    limit: 100,
  });

  return {
    studentId: String(student._id),
    studentName: student.name || '',
    branchId: student.branchId || null,
    registeredFee,
    /** UI "Đã thanh toán" = chỉ khóa còn hiệu lực đã thu (không tính khóa đã hủy) */
    paidCashIn: activePaidCash,
    /** Gross ledger (mọi PAYMENT từng ghi) — đối soát */
    ledgerPayments,
    refundedCashOut,
    activeCourseValue,
    netCollected,
    outstanding,
    source: 'ledger',
    lines,
    enrollments: enrollments.map((e) => ({
      id: String(e._id || ''),
      courseName: e.courseName || '',
      price: Number(e.price) || 0,
      status: e.status || 'active',
      paid: !!e.paid,
      refundedAmount: Number(e.refundedAmount) || 0,
    })),
  };
}

/**
 * Chi lương GV → Ledger salary (Transaction = voucher UI).
 */
async function postSalary({
  teacher,
  amount,
  transaction = null,
  branchId = null,
  sourceRef = '',
  idempotencyKey,
  actor = {},
  note = '',
  metadata = {},
}) {
  const amt = Math.abs(Number(amount) || 0);
  if (!(amt > 0)) {
    const err = new Error('Số tiền lương phải > 0');
    err.status = 400;
    throw err;
  }
  const txId = transaction?._id || metadata.transactionId || '';
  const key = idempotencyKey
    || `salary:tx:${txId || 'missing'}`;

  return postEntry({
    idempotencyKey: key,
    type: 'salary',
    amount: amt,
    teacherId: teacher?._id || teacher?.id || null,
    branchId: branchId || teacher?.branchId || null,
    source: 'teacher_pay',
    sourceRef: sourceRef || (txId ? `tx:${txId}` : ''),
    note: note || `Chi lương ${teacher?.name || ''}`.trim(),
    metadata: {
      ...metadata,
      transactionId: String(txId || ''),
      teacherName: teacher?.name || '',
    },
    postedBy: actor.id || actor.name || '',
    postedByRole: actor.role || 'admin',
  });
}

/**
 * Void dòng ledger: status=void + dòng đảo (adjustment) nếu cần đối soát.
 * Không hard-delete.
 */
async function voidLedgerEntry({
  entryId,
  reason = '',
  actor = {},
  createReversal = true,
}) {
  const entry = await LedgerEntry.findById(entryId);
  if (!entry) {
    const err = new Error('Không tìm thấy dòng ledger');
    err.status = 404;
    throw err;
  }
  if (entry.status === 'void') {
    return { entry, created: false, reversal: null };
  }

  entry.status = 'void';
  entry.metadata = {
    ...(entry.metadata || {}),
    voidReason: String(reason || '').slice(0, 300),
    voidedAt: new Date().toISOString(),
    voidedBy: actor.id || actor.name || '',
  };
  await entry.save();

  let reversal = null;
  if (createReversal && Number(entry.amount) > 0) {
    const direction = entry.type === 'payment' || entry.type === 'adjustment'
      ? 'debit'
      : 'credit';
    const { entry: rev, created } = await postEntry({
      idempotencyKey: `void:reversal:${entry._id}`,
      type: 'adjustment',
      amount: entry.amount,
      studentId: entry.studentId,
      teacherId: entry.teacherId,
      branchId: entry.branchId,
      tenantId: entry.tenantId,
      enrollmentId: entry.enrollmentId,
      invoiceId: entry.invoiceId,
      courseName: entry.courseName,
      source: 'void',
      sourceRef: `void:${entry._id}`,
      note: `Void #${entry._id}: ${reason || 'void'}`.slice(0, 500),
      metadata: {
        direction: entry.type === 'refund' || entry.type === 'salary' || entry.type === 'bonus' || entry.type === 'expense'
          ? 'credit'
          : direction,
        voidsEntryId: String(entry._id),
      },
      postedBy: actor.id || '',
      postedByRole: actor.role || '',
      reversesEntryId: entry._id,
    });
    reversal = { entry: rev, created };
  }

  return { entry, created: true, reversal };
}

/**
 * Discount / coupon event trên ledger.
 */
async function postDiscount({
  student,
  amount,
  kind = 'discount',
  enrollmentId = null,
  courseName = '',
  sourceRef = '',
  idempotencyKey,
  actor = {},
  note = '',
  metadata = {},
}) {
  const type = kind === 'coupon' ? 'coupon' : 'discount';
  const amt = Math.abs(Number(amount) || 0);
  if (!(amt > 0)) {
    const err = new Error('Số tiền giảm giá phải > 0');
    err.status = 400;
    throw err;
  }
  const key = idempotencyKey
    || `${type}:${student?._id || 'x'}:${sourceRef || enrollmentId || 'missing'}`;
  return postEntry({
    idempotencyKey: key,
    type,
    amount: amt,
    studentId: student?._id || null,
    branchId: student?.branchId || null,
    enrollmentId: enrollmentId || '',
    courseName: courseName || student?.course || '',
    source: type,
    sourceRef,
    note,
    metadata,
    postedBy: actor.id || '',
    postedByRole: actor.role || '',
  });
}

/**
 * Tạo CreditNote + gắn ledger refund (P3).
 */
async function issueCreditNoteForRefund({
  student,
  amount,
  ledgerEntry = null,
  enrollmentId = '',
  courseName = '',
  reason = '',
  originalInvoiceId = null,
  actor = {},
}) {
  const CreditNote = require('../models/CreditNote');
  const amt = Math.abs(Number(amount) || 0);
  if (!(amt > 0)) return null;

  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const n = await CreditNote.countDocuments();
  const maChungTu = `CN${ym}-${String(n + 1).padStart(4, '0')}`;

  try {
    return await CreditNote.create({
      maChungTu,
      studentId: student?._id || null,
      branchId: student?.branchId || null,
      originalInvoiceId: originalInvoiceId || null,
      ledgerEntryId: ledgerEntry?._id || null,
      enrollmentId: enrollmentId ? String(enrollmentId) : '',
      courseName: courseName || '',
      amount: amt,
      reason: String(reason || '').slice(0, 500),
      status: 'issued',
      issuedBy: actor.id || actor.name || '',
      issuedAt: new Date(),
    });
  } catch (err) {
    logger.error('[ledger] credit note create: %s', err.message);
    throw err;
  }
}

/**
 * Rebuild FinanceDailySnapshot từ Ledger (khoảng ngày).
 */
async function rebuildDailySnapshots({ from = null, to = null, branchId = null } = {}) {
  const FinanceDailySnapshot = require('../models/FinanceDailySnapshot');
  const match = { status: 'posted' };
  if (branchId) match.branchId = toObjectId(branchId);
  if (from || to) {
    match.postedAt = {};
    if (from) match.postedAt.$gte = new Date(from);
    if (to) match.postedAt.$lte = new Date(to);
  }

  const rows = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$postedAt' } },
          branchId: '$branchId',
          type: '$type',
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  for (const r of rows) {
    const dateKey = r._id.dateKey;
    const bId = r._id.branchId ? String(r._id.branchId) : 'null';
    const key = `${dateKey}|${bId}`;
    if (!map.has(key)) {
      map.set(key, {
        dateKey,
        branchId: r._id.branchId || null,
        payments: 0,
        refunds: 0,
        costs: 0,
        paymentCount: 0,
        refundCount: 0,
        salaryCount: 0,
      });
    }
    const slot = map.get(key);
    const t = r._id.type;
    if (t === 'payment') {
      slot.payments += r.total;
      slot.paymentCount += r.count;
    } else if (t === 'refund') {
      slot.refunds += r.total;
      slot.refundCount += r.count;
    } else if (t === 'salary' || t === 'bonus' || t === 'expense') {
      slot.costs += r.total;
      if (t === 'salary') slot.salaryCount += r.count;
    }
  }

  let upserted = 0;
  for (const slot of map.values()) {
    const net = slot.payments - slot.refunds;
    const profit = net - slot.costs;
    await FinanceDailySnapshot.findOneAndUpdate(
      { dateKey: slot.dateKey, branchId: slot.branchId },
      {
        $set: {
          payments: slot.payments,
          refunds: slot.refunds,
          net,
          costs: slot.costs,
          profit,
          paymentCount: slot.paymentCount,
          refundCount: slot.refundCount,
          salaryCount: slot.salaryCount,
          rebuiltAt: new Date(),
        },
      },
      { upsert: true }
    );
    upserted += 1;
  }

  return { upserted, days: map.size };
}

/**
 * Sync cache paid/paidAmount từ Ledger cho 1 HV (P4).
 */
async function syncStudentFinanceCache(studentId) {
  const Student = require('../models/Student');
  const student = await Student.findById(studentId);
  if (!student) return null;
  const ledger = await sumFinancialRevenue({ studentId });
  student.paidAmount = ledger.net;
  // paid flag: còn khóa active đã thu (không chỉ dựa paidAmount)
  const list = Array.isArray(student.enrollments) ? student.enrollments : [];
  if (list.length) {
    student.paid = list.some((e) => e.status !== 'cancelled' && e.paid === true);
  } else {
    student.paid = ledger.net > 0;
  }
  await student.save();
  return {
    paidAmount: student.paidAmount,
    paid: student.paid,
    ledger,
  };
}

/**
 * Doanh thu thuần theo khóa (PAYMENT − REFUND) từ Ledger.
 */
async function revenueByCourseFromLedger({
  branchId = null,
  from = null,
  to = null,
  limit = 8,
} = {}) {
  const mongoose = require('mongoose');
  const match = {
    status: 'posted',
    type: { $in: ['payment', 'refund'] },
  };
  if (branchId) {
    match.branchId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;
  }
  if (from || to) {
    match.postedAt = {};
    if (from) match.postedAt.$gte = new Date(from);
    if (to) match.postedAt.$lte = new Date(to);
  }

  return LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$courseName', 'Khác'] },
        payments: {
          $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
        },
        refunds: {
          $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] },
        },
        paymentCount: {
          $sum: { $cond: [{ $eq: ['$type', 'payment'] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        course: '$_id',
        count: '$paymentCount',
        revenue: { $subtract: ['$payments', '$refunds'] },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: Math.max(1, Number(limit) || 8) },
  ]);
}

/**
 * Net revenue theo ngày (PAYMENT − REFUND) từ Ledger — cho BI trend.
 */
async function listNetRevenueByDay({
  branchId = null,
  from = null,
  to = null,
} = {}) {
  const mongoose = require('mongoose');
  const match = {
    status: 'posted',
    type: { $in: ['payment', 'refund'] },
  };
  if (branchId) {
    match.branchId = mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;
  }
  if (from || to) {
    match.postedAt = {};
    if (from) match.postedAt.$gte = new Date(from);
    if (to) match.postedAt.$lte = new Date(to);
  }

  return LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$postedAt' } },
        payments: {
          $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
        },
        refunds: {
          $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        dateKey: '$_id',
        revenue: { $subtract: ['$payments', '$refunds'] },
      },
    },
  ]);
}

module.exports = {
  postEntry,
  settlePayment,
  postRefund,
  postSalary,
  postDiscount,
  voidLedgerEntry,
  listLedgerEntries,
  getStudentFinanceCard,
  healOrphanEnrollmentPayments,
  sumFinancialRevenue,
  revenueByCourseFromLedger,
  listNetRevenueByDay,
  reconciliationReport,
  issueCreditNoteForRefund,
  rebuildDailySnapshots,
  syncStudentFinanceCache,
  signedOf,
  financialRevenueUnaffectedByCourseDelete,
};
