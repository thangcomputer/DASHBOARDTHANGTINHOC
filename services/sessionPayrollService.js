/**
 * Session payroll — lương theo ownership buổi completed (Phase 13 / ADR 0004).
 *
 * Quy tắc:
 * - Chỉ status=completed tính lương (scheduled/cancelled/no_show không).
 * - teacherId trên Schedule = người sở hữu buổi (đổi GV không đổi completed cũ).
 * - Mỗi buổi chỉ được chi 1 lần (is_paid_to_teacher) → chống double-pay.
 * - Split 8/12: GV-A nhận 8, GV-B nhận 12 — không trùng session.
 */
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Transaction = require('../models/Transaction');
const {
  computeCompletedSplitByTeacher,
} = require('./teacherReassignmentService');
const { postEntry } = require('./ledgerService');
const { writeAudit } = require('./auditLogService');
const logger = require('../config/logger');

/**
 * Pure: chia số buổi + số tiền theo ownership (cùng rate/buổi).
 * @returns {{ split: Record<string, number>, amounts: Record<string, number>, totalSessions: number, totalAmount: number }}
 */
function computePayrollSplit(sessions, ratePerSession = 0) {
  const split = computeCompletedSplitByTeacher(sessions);
  const amounts = {};
  let totalSessions = 0;
  let totalAmount = 0;
  const rate = Math.max(0, Number(ratePerSession) || 0);
  for (const [tid, count] of Object.entries(split)) {
    const n = Number(count) || 0;
    const amt = n * rate;
    amounts[tid] = amt;
    totalSessions += n;
    totalAmount += amt;
  }
  return { split, amounts, totalSessions, totalAmount, ratePerSession: rate };
}

/**
 * Pure: đảm bảo không session nào được gán cho 2 GV trong cùng lần chi.
 * (Mỗi session 1 teacherId — double-pay = đánh dấu paid 2 lần.)
 */
function assertNoDoublePayClaim(sessions = []) {
  const seen = new Set();
  for (const s of sessions) {
    const id = String(s._id || s.id || '');
    if (!id) continue;
    if (seen.has(id)) {
      const err = new Error('Double-pay: cùng một buổi xuất hiện 2 lần trong claim');
      err.status = 409;
      err.code = 'PAYROLL_DOUBLE_CLAIM';
      throw err;
    }
    seen.add(id);
    if (s.is_paid_to_teacher === true || s.paymentStatus === 'paid') {
      const err = new Error(`Double-pay: buổi ${id} đã thanh toán rồi`);
      err.status = 409;
      err.code = 'PAYROLL_ALREADY_PAID';
      throw err;
    }
  }
  return true;
}

/**
 * Pure gate fixture: 8 buổi A + 12 buổi B → split đúng, không overlap.
 */
function assertSplitNoOverlap(sessionsA, sessionsB) {
  const setA = new Set((sessionsA || []).map((s) => String(s._id || s.id)));
  for (const s of sessionsB || []) {
    const id = String(s._id || s.id);
    if (setA.has(id)) {
      const err = new Error('BUG: session thuộc cả 2 GV — double-pay risk');
      err.status = 500;
      throw err;
    }
  }
  return true;
}

/**
 * Preview payroll cho 1 HV (sau đổi GV): split completed theo teacherId.
 */
async function previewStudentSessionPayroll(studentId, { ratePerSession = 0, courseName = null } = {}) {
  const filter = { studentId, status: 'completed' };
  if (courseName) filter.course = courseName;
  const sessions = await Schedule.find(filter)
    .select('teacherId status is_paid_to_teacher paymentStatus date')
    .lean();

  const unpaid = sessions.filter((s) => s.is_paid_to_teacher !== true);
  const paid = sessions.filter((s) => s.is_paid_to_teacher === true);

  const allSplit = computePayrollSplit(sessions, ratePerSession);
  const unpaidSplit = computePayrollSplit(unpaid, ratePerSession);
  const paidSplit = computePayrollSplit(paid, ratePerSession);

  return {
    studentId: String(studentId),
    totalCompleted: sessions.length,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    split: allSplit.split,
    unpaidSplit: unpaidSplit.split,
    unpaidAmounts: unpaidSplit.amounts,
    paidSplit: paidSplit.split,
    ratePerSession: allSplit.ratePerSession,
  };
}

/**
 * Preview nợ lương 1 GV (chỉ buổi completed + teacherId = GV + chưa paid).
 */
async function previewTeacherPendingPayroll(teacherId) {
  const teacher = await Teacher.findById(teacherId).select('name baseSalaryPerSession branchId').lean();
  if (!teacher) {
    const err = new Error('Không tìm thấy giảng viên');
    err.status = 404;
    throw err;
  }
  const pending = await Schedule.find({
    teacherId,
    status: 'completed',
    is_paid_to_teacher: { $ne: true },
  })
    .select('_id studentId date course is_paid_to_teacher')
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const rate = Number(teacher.baseSalaryPerSession) || 0;
  return {
    teacherId: String(teacherId),
    teacherName: teacher.name,
    pendingSessionsCount: pending.length,
    salaryPerSession: rate,
    unpaidAmount: pending.length * rate,
    sessionIds: pending.map((s) => String(s._id)),
  };
}

/**
 * Chi lương FIFO cho GV — atomic claim + Transaction + ledger.
 * Chỉ claim buổi có teacherId = GV (ownership) → đổi GV không double-pay sang GV mới.
 */
async function payTeacherSessions({
  teacherId,
  sessionsCount,
  amount,
  note = '',
  idempotencyKey = null,
  actor = {},
  reqMeta = {},
  io = null,
}) {
  const count = Number(sessionsCount) || 0;
  const payAmount = Number(amount) || 0;
  if (count <= 0) {
    const err = new Error('Số buổi thanh toán phải lớn hơn 0');
    err.status = 400;
    throw err;
  }
  if (payAmount <= 0) {
    const err = new Error('Số tiền thanh toán phải lớn hơn 0');
    err.status = 400;
    throw err;
  }
  if (payAmount > 500000000) {
    const err = new Error('Số tiền vượt giới hạn 500 triệu/lần');
    err.status = 400;
    throw err;
  }

  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey }).lean();
    if (existing) {
      return {
        paidSessions: count,
        markedSessions: 0,
        totalAmount: existing.amount,
        transaction: existing,
        idempotent: true,
      };
    }
  }

  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    const err = new Error('Không tìm thấy giảng viên');
    err.status = 404;
    throw err;
  }

  // Chỉ buổi thuộc ownership GV này — không lấy buổi của GV cũ/mới khác
  const pendingSessions = await Schedule.find({
    teacherId,
    status: 'completed',
    is_paid_to_teacher: { $ne: true },
  })
    .sort({ date: 1, createdAt: 1 })
    .limit(count)
    .lean();

  assertNoDoublePayClaim(pendingSessions);

  const sessionIds = pendingSessions.map((s) => s._id);
  let actualCount = 0;
  if (sessionIds.length > 0) {
    const claim = await Schedule.updateMany(
      {
        _id: { $in: sessionIds },
        teacherId, // ownership lock
        status: 'completed',
        is_paid_to_teacher: { $ne: true },
      },
      { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } },
    );
    actualCount = claim.modifiedCount || 0;
  }

  const now = new Date();
  const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  let transaction;
  try {
    transaction = await Transaction.create({
      teacherId,
      teacherName: teacher.name,
      teacherPhone: teacher.phone || '',
      amount: payAmount,
      description: note || `Thù lao ${count} buổi dạy (session payroll)`,
      month: monthLabel,
      status: 'confirmed',
      confirmedBy: actor.name || actor.id || 'Admin',
      confirmedAt: now,
      bankName: teacher.bankAccount?.bankName || '',
      bankAccount: teacher.bankAccount?.accountNumber || '',
      note: note || '',
      branchId: teacher.branchId || reqMeta.branchId || null,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  } catch (createErr) {
    if (actualCount > 0 && sessionIds.length > 0 && !(createErr?.code === 11000 && idempotencyKey)) {
      try {
        await Schedule.updateMany(
          { _id: { $in: sessionIds }, teacherId, is_paid_to_teacher: true },
          { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } },
        );
      } catch (rollbackErr) {
        logger.error('[sessionPayroll] rollback failed: %s', rollbackErr.message);
      }
    }
    if (createErr?.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).lean();
      if (existing) {
        return {
          paidSessions: count,
          markedSessions: actualCount,
          totalAmount: existing.amount,
          transaction: existing,
          idempotent: true,
        };
      }
    }
    throw createErr;
  }

  // Ledger debit (chi lương buổi)
  let ledgerEntryId = null;
  try {
    const { entry } = await postEntry({
      idempotencyKey: idempotencyKey
        ? `payroll:session:${idempotencyKey}`
        : `payroll:session:${transaction._id}`,
      type: 'adjustment',
      amount: payAmount,
      branchId: teacher.branchId || reqMeta.branchId || null,
      source: 'payroll',
      sourceRef: String(transaction._id),
      note: `Session payroll ${teacher.name} — ${actualCount} buổi`,
      metadata: {
        direction: 'debit',
        teacherId: String(teacherId),
        sessionIds: sessionIds.map(String),
        transactionId: String(transaction._id),
      },
      postedBy: actor.id || '',
      postedByRole: actor.role || '',
    });
    ledgerEntryId = entry?._id || null;
  } catch (ledErr) {
    logger.warn('[sessionPayroll] ledger: %s', ledErr.message);
  }

  try {
    await writeAudit({
      action: 'payroll.session_pay',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: teacher.branchId || reqMeta.branchId || null,
      entityType: 'transaction',
      entityId: String(transaction._id),
      teacherId,
      newValue: {
        amount: payAmount,
        requestedSessions: count,
        markedSessions: actualCount,
        sessionIds: sessionIds.map(String),
        ledgerEntryId,
      },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch { /* ignore */ }

  if (io) {
    io.emit('teacher:financeUpdated', {
      teacherId: String(teacherId),
      message: `Admin đã thanh toán ${payAmount.toLocaleString('vi-VN')}đ cho ${count} buổi.`,
    });
    io.emit('transactions:new', transaction);
  }

  return {
    paidSessions: count,
    markedSessions: actualCount,
    totalAmount: payAmount,
    transaction,
    ledgerEntryId,
    sessionIds: sessionIds.map(String),
    idempotent: false,
  };
}

/**
 * Scenario helper: sau reassign 8A/12B — verify pay A không đụng session B.
 */
function simulateReassignPayrollOwnership({
  teacherA,
  teacherB,
  completedByA = 8,
  scheduledByB = 12,
  ratePerSession = 100000,
}) {
  const sessions = [];
  for (let i = 0; i < completedByA; i += 1) {
    sessions.push({
      _id: `A${i}`,
      teacherId: teacherA,
      status: 'completed',
      is_paid_to_teacher: false,
    });
  }
  for (let i = 0; i < scheduledByB; i += 1) {
    sessions.push({
      _id: `B${i}`,
      teacherId: teacherB,
      status: 'scheduled',
      is_paid_to_teacher: false,
    });
  }
  // B dạy thêm completed sau này
  const bCompleted = [];
  for (let i = 0; i < scheduledByB; i += 1) {
    bCompleted.push({
      _id: `Bdone${i}`,
      teacherId: teacherB,
      status: 'completed',
      is_paid_to_teacher: false,
    });
  }
  const allCompleted = [
    ...sessions.filter((s) => s.status === 'completed'),
    ...bCompleted,
  ];

  const split = computePayrollSplit(allCompleted, ratePerSession);
  const aSessions = allCompleted.filter((s) => String(s.teacherId) === String(teacherA));
  const bSessions = allCompleted.filter((s) => String(s.teacherId) === String(teacherB));
  assertSplitNoOverlap(aSessions, bSessions);
  assertNoDoublePayClaim(aSessions);
  assertNoDoublePayClaim(bSessions);

  return {
    split: split.split,
    amounts: split.amounts,
    teacherASessions: aSessions.length,
    teacherBSessions: bSessions.length,
    teacherAAmount: split.amounts[String(teacherA)] || 0,
    teacherBAmount: split.amounts[String(teacherB)] || 0,
  };
}

module.exports = {
  computePayrollSplit,
  assertNoDoublePayClaim,
  assertSplitNoOverlap,
  previewStudentSessionPayroll,
  previewTeacherPendingPayroll,
  payTeacherSessions,
  simulateReassignPayrollOwnership,
  computeCompletedSplitByTeacher,
};
