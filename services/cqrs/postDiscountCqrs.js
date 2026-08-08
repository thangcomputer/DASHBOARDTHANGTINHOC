'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postDiscount } = require('../ledgerService');

/**
 * Atomic discount/coupon ledger write (session-aware).
 */
async function postDiscountCqrs(req, { actorOf }) {
  requireReplicaOrThrow();

  const { studentId, amount, kind, enrollmentId, courseName, note, sourceRef } = req.body || {};
  if (!studentId) {
    const err = new Error('Thiếu studentId');
    err.status = 400;
    throw err;
  }

  return withTransaction(async (session) => {
    const student = await Student.findById(studentId).session(session);
    if (!student) {
      const err = new Error('Không tìm thấy học viên');
      err.status = 404;
      throw err;
    }

    const { entry, created } = await postDiscount({
      student,
      amount,
      kind: kind === 'coupon' ? 'coupon' : 'discount',
      enrollmentId,
      courseName,
      sourceRef: sourceRef || `discount:${studentId}:${enrollmentId || 'x'}`,
      actor: actorOf(req),
      note: note || '',
      session,
    });

    return { entry, created };
  });
}

module.exports = { postDiscountCqrs };
