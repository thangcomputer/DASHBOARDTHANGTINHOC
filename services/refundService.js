/**
 * Student refund — full hoặc partial (ledger reversal, giữ Invoice).
 * Partial: giảm paidAmount, giữ paid + learningAccess.
 * Full: paid=false, revoke enrollment access → refunded.
 */
const Invoice = require('../models/Invoice');
const { postRefund } = require('./ledgerService');
const { applyEnrollmentStatus } = require('./enrollmentLifecycle');
const logger = require('../config/logger');

/**
 * @param {number} prevPaidAmount
 * @param {unknown} rawAmount — undefined/null/'' = full
 * @returns {{ refundAmount: number, remaining: number, isFull: boolean }}
 */
function resolveRefundAmount(prevPaidAmount, rawAmount) {
  const prev = Math.max(0, Number(prevPaidAmount) || 0);
  if (!(prev > 0)) {
    const err = new Error('Không có số tiền đã thanh toán để hoàn');
    err.status = 409;
    throw err;
  }

  const omitted = rawAmount === undefined || rawAmount === null || rawAmount === '';
  let refundAmount = omitted ? prev : Number(rawAmount);

  if (!Number.isFinite(refundAmount)) {
    const err = new Error('Số tiền hoàn không hợp lệ');
    err.status = 400;
    throw err;
  }
  refundAmount = Math.round(refundAmount);
  if (!(refundAmount > 0)) {
    const err = new Error('Số tiền hoàn phải lớn hơn 0');
    err.status = 400;
    throw err;
  }
  if (refundAmount > prev) {
    const err = new Error(`Số tiền hoàn (${refundAmount.toLocaleString('vi-VN')}đ) vượt quá đã thanh toán (${prev.toLocaleString('vi-VN')}đ)`);
    err.status = 400;
    throw err;
  }

  const remaining = prev - refundAmount;
  return { refundAmount, remaining, isFull: remaining <= 0 };
}

/**
 * Áp dụng refund lên student document (chưa save).
 */
function applyRefundToStudent(student, { refundAmount, remaining, isFull, note }) {
  const prevPaidAmount = Number(student.paidAmount) || Number(student.price) || 0;

  if (isFull) {
    student.paid = false;
    student.paidAmount = 0;
    student.paidAt = null;
    student.paidNote = note;
    student.paymentMethod = '';

    try {
      (student.enrollments || []).forEach((enr) => {
        if (!enr.paid) return;
        enr.paid = false;
        try {
          if (enr.status === 'active' || enr.status === 'completed' || enr.status === 'paused') {
            applyEnrollmentStatus(enr, 'refunded');
          } else {
            enr.learningAccess = false;
          }
        } catch {
          enr.learningAccess = false;
          enr.status = 'refunded';
        }
      });
      if (student.enrollments?.length) student.markModified('enrollments');
    } catch (lifeErr) {
      logger.warn('[refund] enrollment: %s', lifeErr.message);
    }
  } else {
    student.paid = true;
    student.paidAmount = remaining;
    student.paidNote = note;
    // Giữ paidAt / paymentMethod / enrollment access
  }

  return { prevPaidAmount, refundAmount, remaining, isFull };
}

/**
 * @param {object} opts
 * @param {import('mongoose').Document} opts.student
 * @param {unknown} [opts.amount]
 * @param {string} [opts.note]
 * @param {{ id?: string, role?: string }} [opts.actor]
 * @param {object} [opts.reqMeta]
 * @param {object} [opts.io]
 */
async function refundStudentPayment(opts = {}) {
  const {
    student,
    amount,
    note: noteInput = '',
    actor = {},
    reqMeta = {},
    io = null,
  } = opts;

  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }
  if (!student.paid) {
    const err = new Error('Học viên chưa thanh toán — không thể hoàn');
    err.status = 409;
    throw err;
  }

  const note = String(noteInput || (amount ? 'Hoàn tiền một phần' : 'Hoàn tiền / hủy xác nhận thanh toán')).slice(0, 300);
  const prevPaidAmount = Number(student.paidAmount) || Number(student.price) || 0;
  const paidAtKey = student.paidAt ? new Date(student.paidAt).getTime() : Date.now();
  const plan = resolveRefundAmount(prevPaidAmount, amount);

  applyRefundToStudent(student, { ...plan, note });
  await student.save({ validateModifiedOnly: true });

  const idempotencyKey = plan.isFull
    ? `refund:student:${student._id}:${paidAtKey}`
    : `refund:student:${student._id}:${paidAtKey}:partial:${plan.refundAmount}:rem:${plan.remaining}`;

  const refundResult = await postRefund({
    student,
    amount: plan.refundAmount,
    courseName: student.course,
    sourceRef: `student:${student._id}`,
    idempotencyKey,
    actor,
    note,
    metadata: {
      partial: !plan.isFull,
      remainingPaidAmount: plan.remaining,
      previousPaidAmount: prevPaidAmount,
    },
    reqMeta,
  });

  const invoiceCount = await Invoice.countDocuments({ hocVien: student._id });

  if (io) {
    try {
      const NotificationService = require('./NotificationService');
      const label = plan.isFull ? 'Hoàn toàn bộ' : 'Hoàn một phần';
      NotificationService.notifyAdmins(
        io,
        '↩️ Hoàn học phí',
        `${label} ${plan.refundAmount.toLocaleString('vi-VN')}đ của ${student.name}`
          + (plan.isFull ? '' : ` (còn ${plan.remaining.toLocaleString('vi-VN')}đ)`),
        { studentId: student._id },
        '/admin/students',
      ).catch(() => {});
      NotificationService.send(io, {
        type: 'FINANCE',
        title: plan.isFull ? 'Hoàn học phí' : 'Hoàn học phí một phần',
        content: plan.isFull
          ? `Trạng thái thanh toán của bạn đã được cập nhật (hoàn/hủy). ${note}`
          : `Đã hoàn ${plan.refundAmount.toLocaleString('vi-VN')}đ. Số đã thanh toán còn lại: ${plan.remaining.toLocaleString('vi-VN')}đ. ${note}`,
        receivers: String(student._id),
        link: '/student#profile',
        eventId: `payment.refund:${student._id}:${refundResult.entry?._id}`,
      }).catch(() => {});
      io.emit('data:refresh', { type: 'student', id: student._id });
    } catch (notifErr) {
      logger.warn('[refund] notify: %s', notifErr.message);
    }
  }

  return {
    student,
    refundedAmount: plan.refundAmount,
    remainingPaidAmount: plan.remaining,
    isFull: plan.isFull,
    ledgerEntryId: refundResult.entry?._id || null,
    invoicesPreserved: invoiceCount,
    message: plan.isFull
      ? `Đã hoàn/hủy thanh toán ${plan.refundAmount.toLocaleString('vi-VN')}đ`
      : `Đã hoàn một phần ${plan.refundAmount.toLocaleString('vi-VN')}đ (còn ${plan.remaining.toLocaleString('vi-VN')}đ)`,
  };
}

module.exports = {
  resolveRefundAmount,
  applyRefundToStudent,
  refundStudentPayment,
};
