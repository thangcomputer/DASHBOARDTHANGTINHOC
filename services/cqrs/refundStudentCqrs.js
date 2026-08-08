'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postRefund } = require('../ledgerService');

/**
 * Atomic refund: ledger refund + student paid state in one TX.
 */
async function refundStudentCqrs(req, { financeActor, financeReqMeta, bustFinanceCaches }) {
  requireReplicaOrThrow();

  const note = String(req.body?.note || 'Hoàn tiền / hủy xác nhận thanh toán').slice(0, 300);
  const studentId = req.params.id;

  const loaded = await Student.findById(studentId);
  if (!loaded) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  const prevPaidAmount = Number(loaded.paidAmount) || 0;
  const fallbackPrice = Number(loaded.price) || 0;
  const available = prevPaidAmount > 0 ? prevPaidAmount : (loaded.paid ? fallbackPrice : 0);

  if (!loaded.paid || !(available > 0)) {
    const err = new Error('Học viên chưa thanh toán — không thể hoàn');
    err.status = 409;
    throw err;
  }

  const hasAmount = req.body?.amount !== undefined && req.body?.amount !== null && req.body?.amount !== '';
  let refundAmt = available;
  let partial = false;

  if (hasAmount) {
    refundAmt = Number(req.body.amount);
    if (!(refundAmt > 0) || Number.isNaN(refundAmt)) {
      const err = new Error('Số tiền hoàn không hợp lệ');
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

  const oldSnapshot = { paid: loaded.paid, paidAmount: available };
  const remainingAfter = partial ? Math.round((available - refundAmt) * 100) / 100 : 0;

  const result = await withTransaction(async (session) => {
    const student = await Student.findById(studentId).session(session);
    if (!student || !student.paid) {
      const err = new Error('Học viên chưa thanh toán — không thể hoàn');
      err.status = 409;
      throw err;
    }

    const posted = await postRefund({
      student,
      amount: refundAmt,
      courseName: student.course,
      sourceRef: `refund:student:${student._id}:${partial ? 'partial' : 'full'}:${refundAmt}:${oldSnapshot.paidAmount}`,
      idempotencyKey: `refund:student:${student._id}:${partial ? 'partial' : 'full'}:${refundAmt}:${oldSnapshot.paidAmount}`,
      actor: financeActor(req),
      note,
      metadata: { partial, remaining: remainingAfter },
      reqMeta: financeReqMeta(req, student),
      session,
    });

    if (partial) {
      student.paidAmount = remainingAfter;
      student.paid = true;
      student.paidNote = note;
    } else {
      student.paid = false;
      student.paidAmount = 0;
      student.paidAt = null;
      student.paidNote = note;
      student.paymentMethod = '';
      if (student.enrollments?.length) {
        student.enrollments.forEach((e) => {
          if (e.paid) {
            e.paid = false;
            e.paidAt = undefined;
            e.learningAccess = false;
            e.status = 'refunded';
          }
        });
        student.markModified('enrollments');
      }
    }

    await student.save({ session, validateModifiedOnly: true });
    return { student, ledgerEntry: posted?.entry || null, refundAmt, partial, remainingAfter, oldSnapshot };
  });

  bustFinanceCaches();
  return result;
}

module.exports = { refundStudentCqrs };
