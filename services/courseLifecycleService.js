/**
 * Course soft-delete lifecycle (ADR 0001 / Phase 6).
 * Không xóa Invoice/Payment/Enrollment — chỉ ẩn catalog + notify + audit.
 */
const Course = require('../models/Course');
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const NotificationService = require('./NotificationService');
const { writeAudit } = require('./auditLogService');
const logger = require('../config/logger');

/** Filter catalog mặc định: chưa soft-delete */
function activeCourseFilter(extra = {}) {
  return { deletedAt: null, ...extra };
}

async function findEnrolledStudentsForCourse(course) {
  if (!course) return [];
  const or = [];
  if (course._id) {
    or.push({ 'enrollments.courseId': course._id });
  }
  if (course.name) {
    or.push({ course: course.name });
    or.push({ 'enrollments.courseName': course.name });
  }
  if (!or.length) return [];
  return Student.find({ $or: or })
    .select('_id name zalo email phone enrollments course')
    .lean();
}

/**
 * Soft-delete course.
 * @returns {{ course, notified, invoiceCount }}
 */
async function softDeleteCourse({
  courseId,
  actor,
  reason = '',
  io,
  reqMeta = {},
}) {
  const course = await Course.findById(courseId);
  if (!course) {
    const err = new Error('Không tìm thấy khóa học');
    err.status = 404;
    throw err;
  }
  if (course.deletedAt) {
    const err = new Error('Khóa học đã được xóa mềm trước đó');
    err.status = 409;
    throw err;
  }

  const oldValue = {
    status: course.status,
    deletedAt: null,
    name: course.name,
  };

  course.deletedAt = new Date();
  course.deletedBy = actor?.id && actor.id !== 'admin' ? actor.id : null;
  course.deleteReason = String(reason || '').slice(0, 500);
  if (course.status === 'published') {
    course.status = 'archived';
  }
  await course.save();

  // Integrity: đếm invoice liên quan — không xóa
  const invoiceCount = await Invoice.countDocuments({
    $or: [
      { khoaHoc: course.name },
      ...(course._id ? [{ courseId: course._id }] : []),
    ],
  }).catch(() => 0);

  const students = await findEnrolledStudentsForCourse(course);
  let notified = 0;
  for (const st of students) {
    try {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Khóa học đã ngừng mở đăng ký',
        content: `Khóa học "${course.name}" đã được gỡ khỏi danh mục. Lịch sử học và thanh toán của bạn vẫn được giữ nguyên.`,
        receivers: [String(st._id)],
        eventId: `course.soft_delete:${course._id}:${st._id}`,
        templateCode: 'COURSE_SOFT_DELETED',
        link: '/student',
        payload: {
          courseId: String(course._id),
          courseName: course.name,
          phone: st.zalo || st.phone || '',
          email: st.email || '',
          userName: st.name,
        },
        channels: ['in_app', 'socket'],
        priority: 'high',
      });
      notified += 1;
    } catch (err) {
      logger.warn('[courseLifecycle] notify student %s: %s', st._id, err.message);
    }
  }

  try {
    await writeAudit({
      action: 'course.soft_delete',
      actorUserId: actor?.id || '',
      actorRole: actor?.role || '',
      branchId: reqMeta.branchId || null,
      entityType: 'course',
      entityId: String(course._id),
      courseId: course._id,
      oldValue,
      newValue: {
        status: course.status,
        deletedAt: course.deletedAt,
        deleteReason: course.deleteReason,
        invoiceCountPreserved: invoiceCount,
        studentsNotified: notified,
      },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[courseLifecycle] audit: %s', err.message);
  }

  return {
    course,
    notified,
    invoiceCount,
    studentCount: students.length,
  };
}

async function restoreCourse({ courseId, actor, reqMeta = {} }) {
  const course = await Course.findById(courseId);
  if (!course) {
    const err = new Error('Không tìm thấy khóa học');
    err.status = 404;
    throw err;
  }
  if (!course.deletedAt) {
    const err = new Error('Khóa học chưa bị xóa mềm');
    err.status = 409;
    throw err;
  }

  const oldValue = {
    deletedAt: course.deletedAt,
    status: course.status,
    deleteReason: course.deleteReason,
  };

  course.deletedAt = null;
  course.deletedBy = null;
  course.deleteReason = '';
  if (course.status === 'archived') {
    course.status = 'published';
  }
  await course.save();

  try {
    await writeAudit({
      action: 'course.restore',
      actorUserId: actor?.id || '',
      actorRole: actor?.role || '',
      branchId: reqMeta.branchId || null,
      entityType: 'course',
      entityId: String(course._id),
      courseId: course._id,
      oldValue,
      newValue: { deletedAt: null, status: course.status },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[courseLifecycle] restore audit: %s', err.message);
  }

  return { course };
}

module.exports = {
  activeCourseFilter,
  findEnrolledStudentsForCourse,
  softDeleteCourse,
  restoreCourse,
};
