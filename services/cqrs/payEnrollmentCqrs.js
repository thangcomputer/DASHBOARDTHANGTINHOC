'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { settlePayment } = require('../ledgerService');
const { createTuitionInvoice } = require('./tuitionInvoice');
const { legacyEnrollmentFromStudent } = require('../enrollmentService');

/**
 * Atomic pay for one enrollment: claim → root paid cache → invoice → ledger.
 */
async function payEnrollmentCqrs(req, { financeActor, financeReqMeta, bustFinanceCaches }) {
  requireReplicaOrThrow();

  const { paymentMethod = 'cash', note = '' } = req.body || {};
  const studentId = req.params.id;
  const enrollmentId = req.params.enrollmentId;

  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }
  if (!student.enrollments?.length && student.course) {
    student.enrollments = [legacyEnrollmentFromStudent(student)];
    student.enrollments[0].isPrimary = true;
    await student.save({ validateModifiedOnly: true });
  }

  const idx = (student.enrollments || []).findIndex((e) => String(e._id) === String(enrollmentId));
  if (idx < 0) {
    const err = new Error('Không tìm thấy khóa học');
    err.status = 404;
    throw err;
  }
  const enr = student.enrollments[idx];
  if (enr.paid) {
    const err = new Error('Khóa học này đã thanh toán');
    err.status = 409;
    throw err;
  }

  const amount = Number(enr.price) || 0;
  const paidAt = new Date();

  const result = await withTransaction(async (session) => {
    const claimed = await Student.findOneAndUpdate(
      {
        _id: studentId,
        enrollments: {
          $elemMatch: {
            _id: enr._id,
            paid: { $ne: true },
          },
        },
      },
      {
        $set: {
          'enrollments.$.paid': true,
          'enrollments.$.paidAt': paidAt,
          'enrollments.$.learningAccess': true,
          'enrollments.$.status': 'active',
        },
      },
      { returnDocument: 'after', session }
    );
    if (!claimed) {
      const err = new Error('Khóa học này đã thanh toán');
      err.status = 409;
      throw err;
    }

    const fresh = await Student.findById(studentId).session(session);
    const claimedEnr = fresh.enrollments.find((e) => String(e._id) === String(enr._id))
      || fresh.enrollments[idx];

    if (amount > 0) {
      fresh.paidAmount = (Number(fresh.paidAmount) || 0) + amount;
    }
    if (
      claimedEnr.isPrimary
      || fresh.enrollments.length === 1
      || fresh.enrollments.every((e) => e.paid || e.status === 'cancelled')
    ) {
      fresh.paid = true;
      fresh.paidAt = paidAt;
      fresh.paymentMethod = paymentMethod;
    } else if (fresh.enrollments.some((e) => e.paid)) {
      fresh.paid = true;
      if (!fresh.paidAt) fresh.paidAt = paidAt;
      fresh.paymentMethod = paymentMethod;
    }
    await fresh.save({ session, validateModifiedOnly: true });

    let invoice = null;
    if (amount > 0) {
      invoice = await createTuitionInvoice({
        student: fresh,
        courseName: claimedEnr.courseName,
        amount,
        note: note || `Thanh toán khóa ${claimedEnr.courseName}`,
        session,
      });
      if (!invoice) {
        const err = new Error('Không tạo được hóa đơn');
        err.status = 500;
        throw err;
      }
      await settlePayment({
        student: fresh,
        amount,
        invoice,
        enrollmentId: String(claimedEnr._id),
        courseName: claimedEnr.courseName,
        source: 'enrollment_pay',
        sourceRef: invoice.maHoaDon || `enr:${claimedEnr._id}`,
        idempotencyKey: `payment:enrollment_pay:${fresh._id}:${claimedEnr._id}`,
        actor: financeActor(req),
        note: note || '',
        reqMeta: financeReqMeta(req, fresh),
        session,
      });
    }

    return { student: fresh, invoice, claimedEnr, amount };
  });

  if (amount > 0) bustFinanceCaches();
  return result;
}

module.exports = { payEnrollmentCqrs };
