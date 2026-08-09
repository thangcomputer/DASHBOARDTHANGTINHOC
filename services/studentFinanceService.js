/**
 * studentFinanceService — extracted money mutations (keep route URLs stable).
 * Live path helpers used by routes/studentRoutes.js
 */
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Transaction = require('../models/Transaction');
const Teacher = require('../models/Teacher');
const { postRefund, postSalary } = require('./ledgerService');
const logger = require('../config/logger');

async function refundStudentTuition({
  studentId,
  amount,
  note = 'Hoàn tiền / hủy xác nhận thanh toán',
  refundId = '',
  actor = {},
  reqMeta = {},
}) {
  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  const prevPaidAmount = Number(student.paidAmount) || 0;
  const fallbackPrice = Number(student.price) || 0;
  const available = prevPaidAmount > 0 ? prevPaidAmount : (student.paid ? fallbackPrice : 0);

  if (!student.paid || !(available > 0)) {
    const err = new Error('Học viên chưa thanh toán — không thể hoàn');
    err.status = 409;
    throw err;
  }

  let refundAmt = available;
  let partial = false;
  if (amount !== undefined && amount !== null && amount !== '') {
    refundAmt = Number(amount);
    if (!(refundAmt > 0) || Number.isNaN(refundAmt) || refundAmt !== Math.round(refundAmt)) {
      const err = new Error('Số tiền hoàn không hợp lệ (VND nguyên)');
      err.status = 400;
      throw err;
    }
    if (refundAmt > available) {
      const err = new Error(
        `Số tiền hoàn (${refundAmt.toLocaleString('vi-VN')}đ) vượt quá đã thanh toán (${available.toLocaleString('vi-VN')}đ)`
      );
      err.status = 400;
      throw err;
    }
    partial = refundAmt < available;
  }

  const oldSnapshot = { paid: student.paid, paidAmount: available };
  const remainingAfter = partial ? (available - refundAmt) : 0;
  const stableRefundId = String(refundId || '').trim()
    || `auto:${student._id}:${Date.now()}:${refundAmt}`;

  if (!(prevPaidAmount > 0) && student.paid && fallbackPrice > 0) {
    await Student.updateOne(
      { _id: student._id, paid: true, $or: [{ paidAmount: 0 }, { paidAmount: null }, { paidAmount: { $exists: false } }] },
      { $set: { paidAmount: fallbackPrice } }
    );
  }

  const claimUpdate = partial
    ? { $inc: { paidAmount: -refundAmt }, $set: { paidNote: note } }
    : {
        $set: {
          paid: false,
          paidAmount: 0,
          paidAt: null,
          paidNote: note,
          paymentMethod: '',
        },
      };

  const claimed = await Student.findOneAndUpdate(
    { _id: student._id, paid: true, paidAmount: { $gte: refundAmt } },
    claimUpdate,
    { returnDocument: 'after' }
  );
  if (!claimed) {
    const err = new Error('Không thể hoàn — số dư đã thay đổi hoặc đang được xử lý bởi request khác');
    err.status = 409;
    throw err;
  }

  if (!partial && claimed.enrollments?.length) {
    claimed.enrollments.forEach((e) => {
      if (e.paid) {
        e.paid = false;
        e.paidAt = undefined;
        e.learningAccess = false;
        e.status = 'refunded';
      }
    });
    claimed.markModified('enrollments');
    await claimed.save({ validateModifiedOnly: true });
  }

  try {
    const posted = await postRefund({
      student: claimed,
      amount: refundAmt,
      courseName: claimed.course,
      sourceRef: `refund:student:${claimed._id}:${stableRefundId}`,
      idempotencyKey: `refund:student:${claimed._id}:${stableRefundId}`,
      actor,
      note,
      metadata: { partial, remaining: remainingAfter, refundId: stableRefundId },
      reqMeta,
    });
    if (!posted?.created) {
      await Student.findByIdAndUpdate(claimed._id, {
        $set: { paid: oldSnapshot.paid, paidAmount: oldSnapshot.paidAmount, paidNote: note },
      });
      return {
        idempotent: true,
        student: claimed,
        refundedAmount: refundAmt,
        partial,
        remainingPaidAmount: remainingAfter,
        ledgerEntryId: posted?.entry?._id || null,
        oldSnapshot,
      };
    }
    return {
      idempotent: false,
      student: claimed,
      refundedAmount: refundAmt,
      partial,
      remainingPaidAmount: Number(claimed.paidAmount) || 0,
      ledgerEntryId: posted?.entry?._id || null,
      oldSnapshot,
    };
  } catch (ledgerErr) {
    logger.error('[studentFinance] refund ledger FAILED — rollback: %s', ledgerErr.message);
    await Student.findByIdAndUpdate(student._id, {
      $set: { paid: oldSnapshot.paid, paidAmount: oldSnapshot.paidAmount },
    });
    throw ledgerErr;
  }
}

async function payTeacherForStudent({
  studentId,
  action = 'PARTIAL',
  idempotencyKey = '',
  actor = {},
}) {
  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }
  if (!student.teacherId) {
    const err = new Error('Học viên chưa có giảng viên');
    err.status = 400;
    throw err;
  }

  const teacher = await Teacher.findById(student.teacherId);
  if (!teacher) {
    const err = new Error('Không tìm thấy giảng viên');
    err.status = 404;
    throw err;
  }

  const salaryPerSession = Number(teacher.baseSalaryPerSession) || 0;
  const pendingSessions = await Schedule.find({
    studentId,
    status: 'completed',
    is_paid_to_teacher: { $ne: true },
  }).sort({ date: 1, createdAt: 1 }).select('_id').lean();

  const sessionIds = pendingSessions.map((s) => s._id);
  const paidCount = sessionIds.length;
  const amount = paidCount * salaryPerSession;

  if (paidCount <= 0 && action !== 'PAID_IN_ADVANCE') {
    const err = new Error('Không có buổi hoàn thành chưa thanh toán');
    err.status = 409;
    throw err;
  }

  const key = String(idempotencyKey || '').trim()
    || `pay-teacher:${studentId}:${action}:${sessionIds.map(String).join(',') || 'advance'}`;

  const existingTx = await Transaction.findOne({ idempotencyKey: key }).lean();
  if (existingTx) {
    return { idempotent: true, transaction: existingTx, student, teacher, paidSessions: 0, amount: existingTx.amount };
  }

  let actualCount = 0;
  if (sessionIds.length > 0) {
    const claim = await Schedule.updateMany(
      {
        _id: { $in: sessionIds },
        status: 'completed',
        is_paid_to_teacher: { $ne: true },
      },
      { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } }
    );
    actualCount = claim.modifiedCount || 0;
  }

  if (action === 'PAID_IN_ADVANCE') {
    student.teacher_payment_status = 'PAID_IN_ADVANCE';
    await student.save({ validateModifiedOnly: true });
  } else if (student.teacher_payment_status === 'UNPAID') {
    student.teacher_payment_status = 'PARTIAL';
    await student.save({ validateModifiedOnly: true });
  }

  const now = new Date();
  const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  const defaultDesc = action === 'PAID_IN_ADVANCE'
    ? `Trả trước / thanh toán theo HV ${student.name} (${actualCount} buổi)`
    : `Thù lao ${actualCount} buổi — HV ${student.name}`;

  let transaction = null;
  if (amount > 0 && actualCount > 0) {
    try {
      transaction = await Transaction.create({
        teacherId: teacher._id,
        teacherName: teacher.name,
        teacherPhone: teacher.phone || '',
        amount,
        description: defaultDesc,
        month: monthLabel,
        status: 'confirmed',
        confirmedBy: actor.name || 'Admin',
        confirmedAt: now,
        bankName: teacher.bankAccount?.bankName || '',
        bankAccount: teacher.bankAccount?.accountNumber || '',
        note: `student:${studentId}`,
        idempotencyKey: key,
      });
      await postSalary({
        teacher,
        amount,
        transaction,
        branchId: teacher.branchId || student.branchId || null,
        idempotencyKey: `salary:tx:${transaction._id}`,
        sourceRef: `tx:${transaction._id}`,
        actor,
        note: defaultDesc,
        metadata: {
          studentId: String(student._id),
          sessionsCount: actualCount,
          sessionIds: sessionIds.map(String),
          action,
        },
      });
    } catch (finErr) {
      logger.error('[studentFinance] pay-teacher FAILED — rollback: %s', finErr.message);
      if (sessionIds.length > 0) {
        await Schedule.updateMany(
          { _id: { $in: sessionIds }, is_paid_to_teacher: true },
          { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } }
        );
      }
      if (transaction?._id) {
        await Transaction.findByIdAndUpdate(transaction._id, { status: 'cancelled' });
      }
      const err = new Error('Ghi sổ lương thất bại — đã rollback buổi dạy');
      err.status = 500;
      throw err;
    }
  }

  return {
    idempotent: false,
    student,
    teacher,
    paidSessions: actualCount,
    amount,
    transaction,
    action,
    defaultDesc,
  };
}

module.exports = {
  refundStudentTuition,
  payTeacherForStudent,
};
