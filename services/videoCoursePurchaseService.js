'use strict';

const crypto = require('crypto');
const PaymentSession = require('../models/PaymentSession');
const VideoCoursePurchase = require('../models/VideoCoursePurchase');
const Student = require('../models/Student');
const logger = require('../config/logger');
const NotificationService = require('./NotificationService');
const { coursePriceOf, studentOwnsVideoCourse } = require('../utils/videoCourseAccess');

function makeRef(studentCode, courseId) {
  const code = String(studentCode || 'hv').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase() || 'hv';
  const cid = String(courseId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase() || 'c';
  const rnd = crypto.randomBytes(2).toString('hex');
  return `vc${code}${cid}${rnd}`.slice(0, 25).toLowerCase();
}

async function checkoutVideoCourse({ user, course }) {
  const studentId = user.id || user._id;
  const courseId = String(course.id || course._id || '');
  const amount = coursePriceOf(course);
  if (!courseId || amount <= 0) {
    return { error: 400, message: 'Khóa học này không bán lẻ / miễn phí' };
  }
  if (await studentOwnsVideoCourse(studentId, courseId)) {
    return { owned: true, amount: 0 };
  }

  const student = await Student.findById(studentId).select('name studentCode branchId').lean();

  const pending = await VideoCoursePurchase.findOne({
    studentId,
    courseId,
    status: 'pending',
  }).sort({ createdAt: -1 });
  if (pending?.paymentSessionId) {
    const sess = await PaymentSession.findOne({
      sessionId: pending.paymentSessionId,
      status: 'pending',
      kind: 'video_course',
    }).lean();
    if (sess && Number(sess.amount) === amount) {
      return {
        owned: false,
        sessionId: sess.sessionId,
        ref: sess.ref,
        amount: sess.amount,
        courseTitle: course.title || pending.courseTitle || '',
        studentName: student?.name || user.name || '',
      };
    }
  }

  const ref = makeRef(student?.studentCode, courseId);

  const purchase = await VideoCoursePurchase.create({
    studentId,
    courseId,
    courseTitle: course.title || '',
    amount,
    status: 'pending',
    ref,
    branchId: student?.branchId || null,
  });

  const sessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await PaymentSession.create({
    sessionId,
    ref,
    amount,
    status: 'pending',
    studentName: student?.name || user.name || '',
    courseName: course.title || '',
    courseId: null,
    branchId: student?.branchId || null,
    studentId,
    kind: 'video_course',
    purchaseId: purchase._id,
  });

  await VideoCoursePurchase.updateOne(
    { _id: purchase._id },
    { $set: { paymentSessionId: sessionId } },
  );

  return {
    owned: false,
    sessionId,
    ref,
    amount,
    courseTitle: course.title || '',
    studentName: student?.name || '',
  };
}

async function fulfillVideoCoursePurchase({ session, amount, io }) {
  const sid = session.studentId;
  const existingById = session.purchaseId
    ? await VideoCoursePurchase.findById(session.purchaseId).lean()
    : null;
  if (existingById?.status === 'paid') {
    return existingById;
  }
  const courseId = String(
    existingById?.courseId
    || (session.ref
      ? (await VideoCoursePurchase.findOne({ ref: session.ref }).select('courseId').lean())?.courseId
      : '')
    || '',
  );
  if (sid && courseId && await studentOwnsVideoCourse(sid, courseId)) {
    return existingById || await VideoCoursePurchase.findOne({ studentId: sid, courseId, status: 'paid' }).lean();
  }

  let purchase = null;
  if (session.purchaseId) {
    purchase = await VideoCoursePurchase.findOneAndUpdate(
      { _id: session.purchaseId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paidAmount: Number(amount) || session.amount || 0,
        },
      },
      { returnDocument: 'after' },
    );
  }
  if (!purchase && sid && session.ref) {
    purchase = await VideoCoursePurchase.findOneAndUpdate(
      { studentId: sid, ref: session.ref, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paidAmount: Number(amount) || session.amount || 0,
          paymentSessionId: session.sessionId,
        },
      },
      { returnDocument: 'after' },
    );
  }
  if (!purchase && sid && courseId) {
    purchase = await VideoCoursePurchase.findOneAndUpdate(
      { studentId: sid, courseId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paidAmount: Number(amount) || session.amount || 0,
          paymentSessionId: session.sessionId,
        },
      },
      { returnDocument: 'after' },
    );
  }

  if (!purchase && sid) {
    purchase = await VideoCoursePurchase.create({
      studentId: sid,
      courseId: courseId || String(session.courseName || 'video'),
      courseTitle: session.courseName || '',
      amount: session.amount || amount,
      paidAmount: Number(amount) || 0,
      status: 'paid',
      paymentSessionId: session.sessionId,
      ref: session.ref,
      paidAt: new Date(),
      branchId: session.branchId || null,
    });
  }

  const title = purchase?.courseTitle || session.courseName || 'khóa video';
  const studentId = String(sid || purchase?.studentId || '');
  try {
    if (io && studentId) {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Đăng ký khóa học thành công',
        content: `Bạn đã thanh toán và mở khóa "${title}". Vào Video học tập để xem.`,
        receivers: studentId,
        payload: { kind: 'video_course_paid', courseId: purchase?.courseId, purchaseId: String(purchase?._id || '') },
        link: '/student#materials-videos',
      });
      await NotificationService.notifyAdmins(
        io,
        'HV đăng ký khóa video',
        `${session.studentName || 'Học viên'} đã mua khóa "${title}" (${Number(amount || session.amount || 0).toLocaleString('vi-VN')}đ).`,
        { kind: 'video_course_paid', studentId, courseId: purchase?.courseId },
        '/admin#student-training',
      );
      io.to(studentId).emit('videoCourse:paid', {
        sessionId: session.sessionId,
        courseId: purchase?.courseId,
        amount: Number(amount) || session.amount,
      });
    }
  } catch (err) {
    logger.warn('[VIDEO-COURSE] notify: %s', err.message);
  }

  logger.info('[VIDEO-COURSE] Paid session %s student %s course %s', session.sessionId, studentId, purchase?.courseId);
  return purchase;
}

module.exports = {
  checkoutVideoCourse,
  fulfillVideoCoursePurchase,
};
