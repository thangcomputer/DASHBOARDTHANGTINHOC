'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { settlePayment } = require('../ledgerService');
const { createTuitionInvoice } = require('./tuitionInvoice');

/**
 * Atomic pay: claim unpaid → enrollments → invoice → ledger (one TX).
 */
async function payStudentCqrs(req, { financeActor, financeReqMeta, bustFinanceCaches }) {
  requireReplicaOrThrow();

  const { paymentMethod = 'transfer', note = '' } = req.body || {};
  const studentId = req.params.id;

  const existing = await Student.findById(studentId);
  if (!existing) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }
  if (existing.paid) {
    const err = new Error('Học viên đã thanh toán trước đó');
    err.status = 409;
    throw err;
  }

  const paidAt = new Date();
  const paidAmount = Number(existing.paidAmount) > 0
    ? Number(existing.paidAmount)
    : (Number(existing.price) || 0);

  const result = await withTransaction(async (session) => {
    const claimed = await Student.findOneAndUpdate(
      { _id: studentId, paid: false },
      {
        $set: {
          paid: true,
          paidAt,
          paymentMethod,
          paidAmount,
        },
      },
      { returnDocument: 'after', session }
    );
    if (!claimed) {
      const err = new Error('Học viên đã thanh toán trước đó');
      err.status = 409;
      throw err;
    }

    if (claimed.enrollments?.length) {
      claimed.enrollments.forEach((e) => {
        if (e.isPrimary || claimed.enrollments.length === 1) {
          e.paid = true;
          e.paidAt = paidAt;
          e.learningAccess = true;
          if (e.status === 'pending_payment' || e.status === 'refunded') e.status = 'active';
        }
      });
      claimed.markModified('enrollments');
      await claimed.save({ session, validateModifiedOnly: true });
    }

    const invoice = await createTuitionInvoice({
      student: claimed,
      courseName: claimed.course,
      amount: claimed.paidAmount || claimed.price,
      note,
      session,
    });
    if (!invoice) {
      const err = new Error('Không tạo được hóa đơn');
      err.status = 500;
      throw err;
    }

    const list = claimed.enrollments || [];
    const primary = list.find((e) => e.isPrimary) || list[0];
    const enrId = primary?._id ? String(primary._id) : 'none';

    await settlePayment({
      student: claimed,
      amount: claimed.paidAmount || claimed.price,
      invoice,
      enrollmentId: primary?._id ? String(primary._id) : '',
      courseName: claimed.course,
      source: 'admin_pay',
      sourceRef: invoice.maHoaDon || `pay:${claimed._id}`,
      idempotencyKey: `payment:student:${claimed._id}:enr:${enrId}`,
      actor: financeActor(req),
      note,
      reqMeta: financeReqMeta(req, claimed),
      session,
    });

    return { student: claimed, invoice };
  });

  bustFinanceCaches();
  return result;
}

module.exports = { payStudentCqrs };
