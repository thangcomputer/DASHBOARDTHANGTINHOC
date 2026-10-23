const Student = require('../models/Student');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const { settlePayment } = require('./ledgerService');
const { resolveEnrollmentExamSubjects } = require('./enrollmentService');

async function fulfillAdminEnrollmentPayment({ session, amount, transferContent }) {
  const student = await Student.findById(session.studentId);
  if (!student) throw new Error(`Student not found for payment session ${session.sessionId}`);
  if (!Array.isArray(student.enrollments)) student.enrollments = [];

  let enrollment = student.enrollments.find(
    (item) => item.paymentSessionId === session.sessionId,
  );

  if (!enrollment) {
    const course = await Course.findById(session.courseId).lean();
    if (!course) throw new Error(`Course not found for payment session ${session.sessionId}`);

    const duplicate = student.enrollments.some((item) => {
      if (['cancelled', 'refunded'].includes(String(item.status || '').toLowerCase())) return false;
      if (item.courseId && String(item.courseId) === String(course._id)) return true;
      return String(item.courseName || '').toLowerCase() === String(course.name || '').toLowerCase();
    });
    if (duplicate) {
      throw new Error(`Student ${student._id} already has course ${course.name}`);
    }

    let teacherName = '';
    if (session.teacherId) {
      const teacher = await Teacher.findById(session.teacherId).select('name').lean();
      if (!teacher) throw new Error(`Teacher not found for payment session ${session.sessionId}`);
      teacherName = teacher.name || '';
    }

    const courseName = String(session.courseName || course.name || '').trim();
    const sessions = Number(session.totalSessions) > 0
      ? Number(session.totalSessions)
      : (Number(course.totalSessions) > 0 ? Number(course.totalSessions) : 12);
    const examSubjects = await resolveEnrollmentExamSubjects({
      courseName,
      courseId: course._id,
    });

    student.enrollments.push({
      courseName,
      courseId: course._id,
      examSubjects,
      teacherId: session.teacherId || null,
      teacherName,
      price: Number(session.amount) || Number(amount) || 0,
      paid: false,
      totalSessions: sessions,
      remainingSessions: sessions,
      completedSessions: 0,
      grades: [],
      status: 'pending_payment',
      learningAccess: false,
      isPrimary: false,
      registeredAt: new Date(),
      requireWebcam: false,
      examUnlocked: false,
      teacherAlert: String(session.teacherAlert || '').slice(0, 500),
      paymentSessionId: session.sessionId,
    });
    await student.save();
    enrollment = student.enrollments[student.enrollments.length - 1];
  }

  const paymentAmount = Number(amount) || Number(session.amount) || 0;
  await settlePayment({
    student,
    amount: paymentAmount,
    enrollmentId: String(enrollment._id),
    courseName: enrollment.courseName,
    source: 'sepay_session',
    sourceRef: session.sessionId,
    idempotencyKey: `payment:sepay:session:${session.sessionId}`,
    actor: { id: 'sepay', role: 'system' },
    note: `Thanh toán khóa học qua SePay${transferContent ? ` — ${String(transferContent).slice(0, 240)}` : ''}`,
    metadata: {
      sessionId: session.sessionId,
      ref: session.ref,
      paymentType: 'admin_enrollment',
      paymentMethod: 'transfer',
    },
    reqMeta: { userAgent: 'sepay-webhook', branchId: session.branchId || null },
  });

  const paidAt = new Date();
  const updated = await Student.findOneAndUpdate(
    {
      _id: student._id,
      enrollments: {
        $elemMatch: {
          _id: enrollment._id,
          paymentSessionId: session.sessionId,
          paid: { $ne: true },
        },
      },
    },
    {
      $set: {
        'enrollments.$[enrollment].paid': true,
        'enrollments.$[enrollment].paidAt': paidAt,
        'enrollments.$[enrollment].learningAccess': true,
        'enrollments.$[enrollment].status': 'active',
        paid: true,
        paidAt,
        paymentMethod: 'transfer',
        paidNote: String(transferContent || '').slice(0, 300),
      },
      $inc: { paidAmount: paymentAmount },
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'enrollment._id': enrollment._id }],
    },
  );

  if (!updated) {
    const current = await Student.findById(student._id);
    const alreadyPaid = current?.enrollments.find(
      (item) => item.paymentSessionId === session.sessionId && item.paid === true,
    );
    if (!alreadyPaid) {
      throw new Error(`Could not activate enrollment for payment session ${session.sessionId}`);
    }
    return alreadyPaid;
  }

  return updated.enrollments.find((item) => String(item._id) === String(enrollment._id));
}

module.exports = { fulfillAdminEnrollmentPayment };
