'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const PaymentSession = require('../models/PaymentSession');
const Student = require('../models/Student');
const { settlePayment } = require('./ledgerService');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeCourseName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function effectiveCoursePrice(course) {
  const price = Number(course?.price) || 0;
  const discountPrice = Number(course?.discountPrice) || 0;
  return Number(course?.discountPercent) > 0 && discountPrice > 0 ? discountPrice : price;
}

function studentHasCourse(student, course) {
  const name = normalizeCourseName(course.name);
  const enrollments = Array.isArray(student.enrollments) && student.enrollments.length
    ? student.enrollments
    : (student.course ? [{
      courseId: student.courseId,
      courseName: student.course,
      status: 'active',
      learningAccess: true,
    }] : []);
  return enrollments.some((enrollment) => {
    const active = String(enrollment.status || 'active').toLowerCase() === 'active'
      && enrollment.learningAccess !== false;
    return active && (
      String(enrollment.courseId || '') === String(course._id)
      || normalizeCourseName(enrollment.courseName || enrollment.course) === name
    );
  });
}

function makePurchaseRef(studentCode, courseId) {
  const studentPart = String(studentCode || 'hv').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase() || 'hv';
  const coursePart = String(courseId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase() || 'c';
  return `lp${studentPart}${coursePart}${crypto.randomBytes(3).toString('hex')}`.slice(0, 25);
}

async function checkoutCourse({ user, courseId }) {
  if (!mongoose.Types.ObjectId.isValid(String(courseId || ''))) {
    throw httpError(400, 'Khóa học không hợp lệ');
  }
  const studentId = user?.id || user?._id;
  if (!studentId) throw httpError(401, 'Phiên đăng nhập không hợp lệ');

  const [course, student] = await Promise.all([
    Course.findOne({ _id: courseId, status: 'published', deletedAt: null })
      .select('name price discountPrice discountPercent totalSessions examSubjects')
      .lean(),
    Student.findById(studentId).select('name studentCode branchId course courseId enrollments').lean(),
  ]);
  if (!course) throw httpError(404, 'Khóa học không tồn tại hoặc chưa được mở bán');
  if (!student) throw httpError(404, 'Không tìm thấy học viên');
  if (studentHasCourse(student, course)) return { owned: true, amount: 0 };

  const amount = effectiveCoursePrice(course);
  if (amount <= 0) throw httpError(400, 'Khóa học miễn phí, không cần thanh toán');

  const pending = await PaymentSession.findOne({
    studentId,
    courseId: course._id,
    kind: 'course_purchase',
    status: 'pending',
  }).sort({ createdAt: -1 });
  if (pending && Number(pending.amount) === amount) {
    return {
      owned: false,
      sessionId: pending.sessionId,
      ref: pending.ref,
      amount: pending.amount,
      courseTitle: course.name,
      studentName: student.name || user.name || '',
    };
  }
  if (pending) {
    pending.status = 'expired';
    await pending.save();
  }

  const sessionId = `ps_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const ref = makePurchaseRef(student.studentCode, course._id);
  await PaymentSession.create({
    sessionId,
    ref,
    amount,
    status: 'pending',
    studentName: student.name || user.name || '',
    courseName: course.name,
    courseId: course._id,
    branchId: student.branchId || null,
    studentId,
    kind: 'course_purchase',
  });

  return {
    owned: false,
    sessionId,
    ref,
    amount,
    courseTitle: course.name,
    studentName: student.name || user.name || '',
  };
}

async function fulfillCoursePurchase({ session, amount }) {
  if (!session?.studentId || !session?.courseId) {
    throw new Error(`Thiếu học viên hoặc khóa học trong session ${session?.sessionId || ''}`);
  }
  const [student, course] = await Promise.all([
    Student.findById(session.studentId),
    Course.findById(session.courseId).select('name examSubjects totalSessions').lean(),
  ]);
  if (!student) throw new Error(`Không tìm thấy học viên ${session.studentId}`);
  if (!course) throw new Error(`Không tìm thấy khóa học ${session.courseId}`);

  await settlePayment({
    student: { _id: student._id, branchId: session.branchId || student.branchId || null },
    amount,
    courseName: course.name,
    source: 'sepay_session',
    sourceRef: session.sessionId,
    idempotencyKey: `payment:sepay:course-purchase:${session.sessionId}`,
    actor: { id: 'sepay', role: 'system' },
    note: `Thanh toán mua khóa học · ${session.ref}`,
    metadata: {
      sessionId: session.sessionId,
      ref: session.ref,
      studentName: session.studentName || student.name || '',
      purchaseType: 'lesson_practice_course',
    },
    reqMeta: { ip: '', userAgent: 'sepay-webhook', branchId: session.branchId || student.branchId || null },
  });

  if (!Array.isArray(student.enrollments)) student.enrollments = [];
  if (student.enrollments.length === 0 && student.course && !studentHasCourse(student, course)) {
    student.enrollments.push({
      courseName: student.course,
      courseId: student.courseId || null,
      status: 'active',
      learningAccess: true,
      isPrimary: true,
    });
  }
  if (!studentHasCourse(student, course)) {
    student.enrollments.push({
      courseName: course.name,
      courseId: course._id,
      examSubjects: course.examSubjects || [],
      price: Number(amount) || 0,
      paid: true,
      paidAt: new Date(),
      totalSessions: Number(course.totalSessions) > 0 ? Number(course.totalSessions) : 12,
      remainingSessions: Number(course.totalSessions) > 0 ? Number(course.totalSessions) : 12,
      completedSessions: 0,
      status: 'active',
      learningAccess: true,
      isPrimary: false,
      registeredAt: new Date(),
      teacherId: null,
      teacherName: '',
    });
    await student.save({ validateModifiedOnly: true });
  }

  return { studentId: String(student._id), courseId: String(course._id), courseName: course.name };
}

async function simulateCoursePurchase({ studentId, sessionId }) {
  const session = await PaymentSession.findOne({
    sessionId,
    studentId,
    kind: 'course_purchase',
  });
  if (!session) throw httpError(404, 'Không tìm thấy phiên thanh toán');
  if (session.status === 'expired') throw httpError(409, 'Phiên thanh toán đã hết hạn');

  let claimed = false;
  if (session.status === 'pending') {
    const paidSession = await PaymentSession.findOneAndUpdate(
      { _id: session._id, status: 'pending' },
      { $set: { status: 'paid', paidAmount: session.amount } },
      { returnDocument: 'after' },
    );
    if (!paidSession) {
      const latest = await PaymentSession.findById(session._id);
      if (latest?.status !== 'paid') throw httpError(409, 'Phiên thanh toán không còn hiệu lực');
      Object.assign(session, latest.toObject());
    } else {
      Object.assign(session, paidSession.toObject());
      claimed = true;
    }
  }

  try {
    const purchase = await fulfillCoursePurchase({ session, amount: session.amount });
    return { ...purchase, sessionId: session.sessionId, status: 'paid' };
  } catch (err) {
    if (claimed) {
      await PaymentSession.updateOne(
        { _id: session._id, status: 'paid' },
        { $set: { status: 'pending' }, $unset: { paidAmount: 1 } },
      );
    }
    throw err;
  }
}

module.exports = {
  checkoutCourse,
  fulfillCoursePurchase,
  simulateCoursePurchase,
  effectiveCoursePrice,
  studentHasCourse,
};
