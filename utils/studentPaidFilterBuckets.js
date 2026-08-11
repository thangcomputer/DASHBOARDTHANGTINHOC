'use strict';

/**
 * Mutually exclusive paid-status buckets for Admin student list filter.
 * Priority: refunded (locked) > unpaid > paid
 * Aligns with FE isStudentRowLocked / studentHasActivePaid.
 */

const PAID_TRUE = [true, 'true', 'Đã đóng phí', 1];

function isEnrollmentPaidFlag(e) {
  return PAID_TRUE.includes(e?.paid) || e?.paid === true;
}

function isLearningEnrollment(e) {
  const st = String(e?.status || 'active').toLowerCase();
  return st !== 'cancelled' && st !== 'refunded';
}

function hasCancelOrRefundSignal(student, enrollments) {
  if (Number(student?.refundedAmount) > 0) return true;
  const rootSt = String(student?.status || '').toLowerCase();
  if (rootSt === 'cancelled' || rootSt === 'refunded') return true;
  return (enrollments || []).some((e) => {
    const st = String(e?.status || '').toLowerCase();
    return st === 'cancelled' || st === 'refunded' || Number(e?.refundedAmount) > 0;
  });
}

/**
 * @returns {'paid'|'unpaid'|'refunded'|null}
 */
function classifyStudentPaidBucket(student) {
  if (!student) return null;
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const learning = enrollments.filter(isLearningEnrollment);
  const cancelSignal = hasCancelOrRefundSignal(student, enrollments);

  // Locked: no learning enrollment + cancel/refund signal
  if (learning.length === 0 && cancelSignal) {
    return 'refunded';
  }

  const hasUnpaidLearning = learning.some((e) => !isEnrollmentPaidFlag(e));
  if (hasUnpaidLearning) return 'unpaid';

  const hasPaidLearning = learning.some((e) => isEnrollmentPaidFlag(e));
  if (hasPaidLearning) return 'paid';

  // Legacy (no enrollments array / empty, no cancel)
  if (enrollments.length === 0 && !cancelSignal) {
    if (student.paid === true || student.paid === 'true' || student.paid === 'Đã đóng phí') {
      return 'paid';
    }
    if (student.course && String(student.course).trim()) return 'unpaid';
  }

  return null;
}

/**
 * Mongo Schema: enrollments.paid / student.paid are Boolean.
 * Only use true / { $ne: true } — strings like 'Đã đóng phí' cause CastError.
 */
const elemPaidLearning = {
  status: { $nin: ['cancelled', 'refunded'] },
  paid: true,
};

const elemUnpaidLearning = {
  status: { $nin: ['cancelled', 'refunded'] },
  paid: { $ne: true },
};

const hasCancelOrRefundMongo = {
  $or: [
    { 'enrollments.status': 'cancelled' },
    { 'enrollments.status': 'refunded' },
    { 'enrollments.refundedAmount': { $gt: 0 } },
    { refundedAmount: { $gt: 0 } },
    { status: 'cancelled' },
    { status: 'refunded' },
  ],
};

/**
 * Build Mongo condition for ?paid= paid|unpaid|refunded|true|false
 * @returns {object|null} condition to push into $and, or null if ignore
 */
function buildMongoPaidFilterCondition(paid) {
  if (!paid || paid === 'all') return null;

  if (paid === 'refunded' || paid === 'false') {
    // Locked only: has cancel/refund AND no learning enrollment
    return {
      $and: [
        hasCancelOrRefundMongo,
        {
          enrollments: {
            $not: {
              $elemMatch: { status: { $nin: ['cancelled', 'refunded'] } },
            },
          },
        },
      ],
    };
  }

  if (paid === 'unpaid') {
    return {
      $or: [
        { enrollments: { $elemMatch: elemUnpaidLearning } },
        {
          $and: [
            {
              $or: [
                { enrollments: { $exists: false } },
                { enrollments: { $size: 0 } },
              ],
            },
            { paid: { $ne: true } },
            { course: { $exists: true, $ne: '' } },
            { status: { $nin: ['cancelled', 'refunded'] } },
          ],
        },
      ],
    };
  }

  if (paid === 'paid' || paid === 'true') {
    return {
      $or: [
        {
          $and: [
            { enrollments: { $elemMatch: elemPaidLearning } },
            {
              enrollments: {
                $not: { $elemMatch: elemUnpaidLearning },
              },
            },
          ],
        },
        {
          $and: [
            {
              $or: [
                { enrollments: { $exists: false } },
                { enrollments: { $size: 0 } },
              ],
            },
            { paid: true },
            { status: { $nin: ['cancelled', 'refunded'] } },
          ],
        },
      ],
    };
  }

  return null;
}

module.exports = {
  classifyStudentPaidBucket,
  buildMongoPaidFilterCondition,
  isEnrollmentPaidFlag,
  isLearningEnrollment,
  PAID_TRUE,
};
