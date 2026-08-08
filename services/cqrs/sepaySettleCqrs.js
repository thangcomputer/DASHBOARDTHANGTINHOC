'use strict';

const Student = require('../../models/Student');
const PaymentSession = require('../../models/PaymentSession');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow, isFinanceCqrs } = require('../../shared/cqrs/flags');
const { settlePayment } = require('../ledgerService');
const { createTuitionInvoice } = require('./tuitionInvoice');
const logger = require('../../config/logger');

/**
 * SePay session: claim pending → ledger in one TX.
 * @returns {{ claimed: object|null, matched: boolean }}
 */
async function sepaySettleSessionCqrs({ sessionDoc, amount, note, reqMeta }) {
  if (!isFinanceCqrs()) {
    logger.warn('[SEPAY] finance CQRS off — skip session settle');
    return { claimed: null, matched: false };
  }
  requireReplicaOrThrow();

  const result = await withTransaction(async (session) => {
    const claimed = await PaymentSession.findOneAndUpdate(
      { _id: sessionDoc._id, status: 'pending' },
      { $set: { status: 'paid', paidAmount: amount } },
      { returnDocument: 'after', session }
    );
    if (!claimed) return { claimed: null, matched: false };

    await settlePayment({
      student: claimed.studentId
        ? { _id: claimed.studentId, branchId: claimed.branchId || null }
        : { _id: null, branchId: claimed.branchId || null },
      amount,
      courseName: claimed.courseName || '',
      source: 'sepay_session',
      sourceRef: claimed.sessionId,
      idempotencyKey: `payment:sepay:session:${claimed.sessionId}`,
      actor: { id: 'sepay', role: 'system' },
      note,
      metadata: {
        sessionId: claimed.sessionId,
        ref: claimed.ref,
        studentName: claimed.studentName || '',
      },
      reqMeta,
      session,
    });

    return { claimed, matched: true };
  });

  return result;
}

/**
 * SePay existing student: claim unpaid → enrollments → invoice → ledger.
 * @returns {{ student: object|null, invoice: object|null, matched: boolean }}
 */
async function sepaySettleStudentCqrs({
  studentId,
  amount,
  paidNote,
  gatewayTxnId,
  matchedRef,
  reqMeta,
}) {
  if (!isFinanceCqrs()) {
    logger.warn('[SEPAY] finance CQRS off — skip student settle');
    return { student: null, invoice: null, matched: false };
  }
  requireReplicaOrThrow();

  const paidAt = new Date();

  return withTransaction(async (session) => {
    const claimed = await Student.findOneAndUpdate(
      { _id: studentId, paid: false },
      {
        $set: {
          paid: true,
          paidAmount: amount,
          paidAt,
          paidNote: paidNote.slice(0, 300),
          paymentMethod: 'transfer',
        },
      },
      { returnDocument: 'after', session }
    );
    if (!claimed) return { student: null, invoice: null, matched: false };

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

    const list = claimed.enrollments || [];
    const primary = list.find((e) => e.isPrimary) || list[0];
    const enrId = primary?._id ? String(primary._id) : '';

    const invoice = await createTuitionInvoice({
      student: claimed,
      courseName: claimed.course || 'Học phí',
      amount,
      note: `SePay CK — ${paidNote.slice(0, 120)}`,
      session,
    });
    if (!invoice) {
      const err = new Error('Không tạo được hóa đơn SePay');
      err.status = 500;
      throw err;
    }

    await settlePayment({
      student: claimed,
      amount,
      invoice,
      enrollmentId: enrId,
      courseName: claimed.course || '',
      source: 'sepay',
      sourceRef: invoice.maHoaDon || gatewayTxnId || matchedRef,
      idempotencyKey: enrId
        ? `payment:student:${claimed._id}:enr:${enrId}`
        : `payment:student:${claimed._id}:primary`,
      actor: { id: 'sepay', role: 'system' },
      note: paidNote.slice(0, 300),
      reqMeta,
      session,
    });

    return { student: claimed, invoice, matched: true };
  });
}

module.exports = {
  sepaySettleSessionCqrs,
  sepaySettleStudentCqrs,
};
