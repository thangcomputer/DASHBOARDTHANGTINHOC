'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { settlePayment } = require('../ledgerService');
const { createTuitionInvoice } = require('./tuitionInvoice');

/**
 * Atomic add-enrollment-as-paid: push enrollment + invoice + ledger in one TX.
 */
async function addEnrollmentPaidCqrs({
  studentId,
  enrollmentPayload,
  resolvedPrice,
  resolvedName,
  financeActor,
  financeReqMeta,
  bustFinanceCaches,
  req,
}) {
  requireReplicaOrThrow();

  const result = await withTransaction(async (session) => {
    const student = await Student.findById(studentId).session(session);
    if (!student) {
      const err = new Error('Không tìm thấy học viên');
      err.status = 404;
      throw err;
    }

    const duplicate = (student.enrollments || []).some((e) => {
      if (String(e.status || '') === 'cancelled') return false;
      if (enrollmentPayload.courseId && e.courseId && String(e.courseId) === String(enrollmentPayload.courseId)) {
        return true;
      }
      return (e.courseName || '').toLowerCase() === resolvedName.toLowerCase();
    });
    if (duplicate) {
      const err = new Error('Học viên đã đăng ký khóa học này');
      err.status = 409;
      throw err;
    }

    student.enrollments.push(enrollmentPayload);
    if (resolvedPrice > 0) {
      student.paidAmount = (Number(student.paidAmount) || 0) + resolvedPrice;
      student.paid = true;
      if (!student.paidAt) student.paidAt = new Date();
    }
    await student.save({ session });

    const lastEnr = student.enrollments[student.enrollments.length - 1];
    let invoice = null;
    if (resolvedPrice > 0) {
      invoice = await createTuitionInvoice({
        student,
        courseName: resolvedName,
        amount: resolvedPrice,
        note: `Thanh toán khi thêm khóa ${resolvedName}`,
        session,
      });
      if (!invoice) {
        const err = new Error('Không tạo được hóa đơn');
        err.status = 500;
        throw err;
      }
      await settlePayment({
        student,
        amount: resolvedPrice,
        invoice,
        enrollmentId: String(lastEnr?._id || ''),
        courseName: resolvedName,
        source: 'enrollment_add_paid',
        sourceRef: invoice.maHoaDon || `add:${student._id}:${lastEnr?._id || resolvedName}`,
        idempotencyKey: lastEnr?._id
          ? `payment:enrollment_add:${student._id}:${lastEnr._id}`
          : `payment:enrollment_add:${student._id}:${invoice.maHoaDon || 'nohd'}`,
        actor: financeActor(req),
        note: `Thêm khóa ${resolvedName}`,
        reqMeta: financeReqMeta(req, student),
        session,
      });
    }

    return { student, invoice };
  });

  if (resolvedPrice > 0) bustFinanceCaches();
  return result;
}

module.exports = { addEnrollmentPaidCqrs };
