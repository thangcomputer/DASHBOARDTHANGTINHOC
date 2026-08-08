'use strict';

const Student = require('../../models/Student');
const { withTransaction } = require('../../shared/cqrs/withTransaction');
const { requireReplicaOrThrow } = require('../../shared/cqrs/flags');
const { postRefund } = require('../ledgerService');

function syncStudentFromPrimaryEnrollment(student) {
  if (!student?.enrollments?.length) return;
  const list = student.enrollments;
  const active = list.filter((e) => e?.status !== 'cancelled' && e?.status !== 'refunded');
  if (!active.length) {
    student.course = '';
    student.price = 0;
    student.paid = false;
    student.paidAt = undefined;
    student.teacherId = null;
    student.teacherName = '';
    student.completedSessions = 0;
    student.remainingSessions = 0;
    student.totalSessions = 12;
    return;
  }
  const primary = active.find((e) => e.isPrimary) || active[0];
  if (!primary) return;
  student.course = primary.courseName;
  student.price = Number(primary.price) || 0;
  student.paid = !!primary.paid;
  student.teacherId = primary.teacherId || null;
  student.teacherName = primary.teacherName || '';
  if (primary.paidAt) student.paidAt = primary.paidAt;
  student.totalSessions = primary.totalSessions || 12;
  student.remainingSessions = primary.remainingSessions ?? primary.totalSessions ?? 12;
  student.completedSessions = primary.completedSessions || 0;
}

/**
 * Soft-cancel enrollment; when refundAmt > 0, ledger refund + cancel in one TX.
 */
async function cancelEnrollmentCqrs({
  studentId,
  enrollmentId,
  cancelReason,
  refundAmt,
  financeActor,
  financeReqMeta,
  bustFinanceCaches,
  req,
}) {
  if (refundAmt > 0) requireReplicaOrThrow();

  const run = async (session) => {
    const q = Student.findById(studentId);
    if (session) q.session(session);
    const student = await q;
    if (!student) {
      const err = new Error('Không tìm thấy học viên');
      err.status = 404;
      throw err;
    }
    if (!student.enrollments?.length && student.course) {
      const { legacyEnrollmentFromStudent } = require('../enrollmentService');
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    const list = student.enrollments || [];
    const idx = list.findIndex((e) => String(e._id) === String(enrollmentId));
    if (idx < 0) {
      const err = new Error('Không tìm thấy khóa học');
      err.status = 404;
      throw err;
    }
    const enr = list[idx];
    if (enr.status === 'cancelled') {
      const err = new Error('Khóa học này đã bị hủy trước đó.');
      err.status = 400;
      throw err;
    }

    const courseName = enr.courseName;
    const wasPaid = enr.paid === true;
    const paidAmt = Number(enr.price || 0);

    if (refundAmt > 0) {
      await postRefund({
        amount: refundAmt,
        student,
        enrollmentId: String(enr._id),
        courseName,
        note: `Hoàn học phí khi hủy khóa "${courseName}". Lý do: ${cancelReason}`,
        sourceRef: `cancel:${student._id}:${enr._id}`,
        idempotencyKey: `refund:cancel:${student._id}:${enr._id}`,
        actor: financeActor(req),
        reqMeta: financeReqMeta(req, student),
        metadata: { enrollmentId: String(enr._id), cancelReason },
        session,
      });
    }

    list[idx].status = 'cancelled';
    list[idx].cancelledAt = new Date();
    list[idx].cancelReason = cancelReason;
    list[idx].refundedAmount = refundAmt;
    list[idx].learningAccess = false;
    list[idx].paid = false;

    if (enr.isPrimary) {
      list[idx].isPrimary = false;
      const nextActive = list.find((e, i) => i !== idx && e.status !== 'cancelled');
      if (nextActive) nextActive.isPrimary = true;
    }

    student.enrollments = list;
    syncStudentFromPrimaryEnrollment(student);
    const activePaid = list.some((e) => e.status !== 'cancelled' && e.paid === true);
    student.paid = activePaid;
    if (refundAmt > 0) {
      student.paidAmount = Math.max(0, (Number(student.paidAmount) || 0) - refundAmt);
    }
    student.markModified('enrollments');
    await student.save(session ? { session } : undefined);

    return {
      student,
      enr,
      courseName,
      wasPaid,
      paidAmt,
      refundAmt,
    };
  };

  const result = refundAmt > 0
    ? await withTransaction(run)
    : await run(null);

  if (refundAmt > 0) bustFinanceCaches();
  return result;
}

module.exports = { cancelEnrollmentCqrs, syncStudentFromPrimaryEnrollment };
