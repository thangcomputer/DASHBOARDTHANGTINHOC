/**
 * Teacher reassignment — đổi GV không mất lịch đã dạy / không reset progress (Phase 7).
 *
 * Quy tắc:
 * - Schedule status=completed|no_show: GIỮ teacherId cũ (ownership buổi).
 * - Schedule status=scheduled: cập nhật sang GV mới (nếu reassignFutureSchedules).
 * - Enrollment.completedSessions / remainingSessions: KHÔNG đụng.
 * - Ghi TeacherAssignmentSegment + Audit.
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const ScheduleHistory = require('../models/ScheduleHistory');
const TeacherAssignmentSegment = require('../models/TeacherAssignmentSegment');
const { writeAudit } = require('./auditLogService');
const NotificationService = require('./NotificationService');
const logger = require('../config/logger');
const { legacyEnrollmentFromStudent } = require('./enrollmentService');

/**
 * Tách số buổi completed theo teacherId (payroll preview).
 * @param {Array<{ teacherId: any, status: string }>} sessions
 * @returns {Record<string, number>}
 */
function computeCompletedSplitByTeacher(sessions) {
  const out = {};
  for (const s of sessions || []) {
    if (String(s.status) !== 'completed') continue;
    const tid = s.teacherId ? String(s.teacherId._id || s.teacherId) : 'unassigned';
    out[tid] = (out[tid] || 0) + 1;
  }
  return out;
}

/**
 * Đảm bảo progress enrollment không bị reset khi đổi GV.
 */
function assertProgressUntouched(before, after) {
  const bDone = Number(before?.completedSessions) || 0;
  const aDone = Number(after?.completedSessions) || 0;
  const bRem = before?.remainingSessions;
  const aRem = after?.remainingSessions;
  if (bDone !== aDone) {
    const err = new Error('BUG: completedSessions bị thay đổi khi đổi GV');
    err.status = 500;
    throw err;
  }
  if (bRem != null && aRem != null && Number(bRem) !== Number(aRem)) {
    const err = new Error('BUG: remainingSessions bị thay đổi khi đổi GV');
    err.status = 500;
    throw err;
  }
}

async function countCompletedForCourse(studentId, courseName) {
  const filter = {
    studentId,
    status: 'completed',
  };
  if (courseName) filter.course = courseName;
  return Schedule.countDocuments(filter);
}

async function getCompletedSplit(studentId, courseName) {
  const filter = {
    studentId,
    status: 'completed',
  };
  if (courseName) filter.course = courseName;
  const rows = await Schedule.find(filter).select('teacherId status').lean();
  return computeCompletedSplitByTeacher(rows);
}

/**
 * @param {object} opts
 * @param {string} opts.studentId
 * @param {string} [opts.enrollmentId]
 * @param {string|null} opts.newTeacherId — null/'' = unassign
 * @param {object} opts.actor — { id, role }
 * @param {object} [opts.io]
 * @param {boolean} [opts.reassignFutureSchedules=true]
 * @param {string} [opts.reason]
 * @param {object} [opts.reqMeta]
 * @param {object} [opts.teacherDoc] — đã validate sẵn (optional)
 * @param {string} [opts.teacherName]
 */
async function reassignTeacher(opts = {}) {
  const {
    studentId,
    enrollmentId,
    newTeacherId,
    actor = {},
    io,
    reassignFutureSchedules = true,
    reason = '',
    reqMeta = {},
    teacherDoc = null,
    teacherName: teacherNameInput = '',
  } = opts;

  const isUnassign = newTeacherId === null || newTeacherId === '' || newTeacherId === undefined;

  const student = await Student.findById(studentId);
  if (!student) {
    const err = new Error('Không tìm thấy học viên');
    err.status = 404;
    throw err;
  }

  if (!student.enrollments?.length && student.course) {
    student.enrollments = [legacyEnrollmentFromStudent(student)];
    student.enrollments[0].isPrimary = true;
  }

  let teacherName = teacherNameInput;
  let resolvedTeacherId = isUnassign ? null : newTeacherId;

  if (!isUnassign && !teacherDoc) {
    const t = await Teacher.findById(resolvedTeacherId).select('name status role').lean();
    if (!t || t.role !== 'teacher') {
      const err = new Error('Không tìm thấy giảng viên');
      err.status = 404;
      throw err;
    }
    if (String(t.status || '').toLowerCase() !== 'active') {
      const err = new Error('Giảng viên chưa Active');
      err.status = 400;
      throw err;
    }
    teacherName = t.name || 'Giảng viên';
  } else if (teacherDoc) {
    teacherName = teacherDoc.name || teacherName || 'Giảng viên';
  }

  const mongoose = require('mongoose');
  const hasValidEnrollmentId = enrollmentId
    && enrollmentId !== 'main'
    && mongoose.Types.ObjectId.isValid(String(enrollmentId));

  let enrIdx = -1;
  let courseName = student.course || '';
  let oldTeacherId = student.teacherId ? String(student.teacherId._id || student.teacherId) : '';

  if (hasValidEnrollmentId && student.enrollments?.length) {
    enrIdx = student.enrollments.findIndex((e) => String(e._id) === String(enrollmentId));
    if (enrIdx < 0) {
      const err = new Error('Không tìm thấy khóa học');
      err.status = 404;
      throw err;
    }
  } else if (student.enrollments?.length) {
    const primaryIdx = student.enrollments.findIndex((e) => e.isPrimary);
    enrIdx = primaryIdx >= 0 ? primaryIdx : 0;
  }

  const progressBefore = enrIdx >= 0
    ? {
      completedSessions: student.enrollments[enrIdx].completedSessions,
      remainingSessions: student.enrollments[enrIdx].remainingSessions,
    }
    : {
      completedSessions: student.completedSessions,
      remainingSessions: student.remainingSessions,
    };

  if (enrIdx >= 0) {
    const enr = student.enrollments[enrIdx];
    oldTeacherId = enr.teacherId ? String(enr.teacherId._id || enr.teacherId) : oldTeacherId;
    courseName = enr.courseName || courseName;
    const prevEnrTeacher = enr.teacherId;
    enr.teacherId = resolvedTeacherId;
    enr.teacherName = isUnassign ? '' : teacherName;
    const isPrimary = !!enr.isPrimary || student.enrollments.length === 1;
    if (isUnassign) {
      const topTid = student.teacherId?._id || student.teacherId;
      if (isPrimary || String(topTid || '') === String(prevEnrTeacher || '')) {
        student.teacherId = null;
      }
    } else if (isPrimary) {
      student.teacherId = resolvedTeacherId;
    }
  } else {
    student.teacherId = resolvedTeacherId;
  }

  if (student.enrollments?.length) student.markModified('enrollments');
  if (student.status === 'Chờ xếp lớp' && !isUnassign) {
    student.status = 'Đang học';
  }

  await student.save();

  const progressAfter = enrIdx >= 0
    ? {
      completedSessions: student.enrollments[enrIdx].completedSessions,
      remainingSessions: student.enrollments[enrIdx].remainingSessions,
    }
    : {
      completedSessions: student.completedSessions,
      remainingSessions: student.remainingSessions,
    };
  assertProgressUntouched(progressBefore, progressAfter);

  const completedAtSwitch = await countCompletedForCourse(student._id, courseName);
  const splitBefore = await getCompletedSplit(student._id, courseName);

    let futureUpdated = 0;
  if (reassignFutureSchedules && !isUnassign) {
    const schedFilter = {
      studentId: student._id,
      status: 'scheduled',
      ...(courseName ? { course: courseName } : {}),
    };
    const upd = await Schedule.updateMany(schedFilter, {
      $set: { teacherId: resolvedTeacherId, teacherName },
    });
    futureUpdated = upd.modifiedCount || upd.nModified || 0;
  }

  // Đóng segment cũ, mở segment mới
  const enrollmentKey = enrIdx >= 0 ? String(student.enrollments[enrIdx]._id) : '';
  await TeacherAssignmentSegment.updateMany(
    {
      studentId: student._id,
      ...(enrollmentKey ? { enrollmentId: enrollmentKey } : {}),
      courseName,
      endedAt: null,
    },
    { $set: { endedAt: new Date() } }
  );

  if (!isUnassign) {
    await TeacherAssignmentSegment.create({
      studentId: student._id,
      enrollmentId: enrollmentKey,
      courseName,
      teacherId: resolvedTeacherId,
      teacherName,
      startedAt: new Date(),
      endedAt: null,
      completedSessionsAtStart: completedAtSwitch,
      actorId: actor.id != null ? String(actor.id) : '',
      actorRole: actor.role || '',
      reason: String(reason || '').slice(0, 500),
    });
  }

  try {
    await ScheduleHistory.create({
      scheduleId: null,
      actorId: actor.id && String(actor.id).match(/^[a-f\d]{24}$/i) ? actor.id : student._id,
      actorName: String(actor.id || 'admin'),
      actorRole: ['teacher', 'admin', 'staff', 'system'].includes(actor.role) ? actor.role : 'admin',
      action: 'TEACHER_REASSIGNED',
      reason: reason || (isUnassign ? 'Unassign teacher' : 'Reassign teacher'),
      oldValue: { teacherId: oldTeacherId, completedSessions: completedAtSwitch },
      newValue: {
        teacherId: resolvedTeacherId,
        teacherName,
        futureUpdated,
        completedSessionsUnchanged: completedAtSwitch,
      },
      studentName: student.name,
      teacherName: teacherName || '',
      course: courseName,
    });
  } catch (err) {
    logger.warn('[reassignTeacher] ScheduleHistory: %s', err.message);
  }

  try {
    await writeAudit({
      action: 'teacher.reassign',
      actorUserId: actor.id || '',
      actorRole: actor.role || '',
      branchId: reqMeta.branchId || student.branchId || null,
      entityType: 'enrollment',
      entityId: enrollmentKey || String(student._id),
      studentId: student._id,
      teacherId: resolvedTeacherId,
      oldValue: { teacherId: oldTeacherId, completedSplit: splitBefore },
      newValue: {
        teacherId: resolvedTeacherId,
        teacherName,
        futureSchedulesUpdated: futureUpdated,
        completedSessionsAtSwitch: completedAtSwitch,
        progressPreserved: true,
      },
      ip: reqMeta.ip || '',
      userAgent: reqMeta.userAgent || '',
    });
  } catch (err) {
    logger.warn('[reassignTeacher] audit: %s', err.message);
  }

  // Notify
  try {
    if (io && !isUnassign && resolvedTeacherId) {
      await NotificationService.send(io, {
        type: 'COURSE',
        title: '📚 Học viên mới được giao',
        content: `Học viên ${student.name} (${courseName || student.course}) đã được giao cho bạn.`,
        receivers: String(resolvedTeacherId),
        eventId: `teacher.reassign:${student._id}:${enrollmentKey}:${resolvedTeacherId}:${Date.now()}`,
        payload: { studentId: student._id, type: 'student' },
        link: `/teacher#students?studentId=${student._id}`,
        channels: ['in_app', 'socket'],
      });
      await NotificationService.send(io, {
        type: 'COURSE',
        title: 'Đổi giáo viên phụ trách',
        content: `Khóa ${courseName || student.course}: giáo viên phụ trách mới là ${teacherName}. Các buổi đã học vẫn được giữ nguyên.`,
        receivers: [String(student._id)],
        eventId: `teacher.reassign.student:${student._id}:${enrollmentKey}:${resolvedTeacherId}`,
        link: '/student#schedule',
        channels: ['in_app', 'socket'],
      });
    }
  } catch (err) {
    logger.warn('[reassignTeacher] notify: %s', err.message);
  }

  const splitAfter = await getCompletedSplit(student._id, courseName);

  return {
    student,
    courseName,
    oldTeacherId,
    newTeacherId: resolvedTeacherId,
    completedSessionsAtSwitch: completedAtSwitch,
    futureUpdated,
    completedSplit: splitAfter,
    progressPreserved: true,
  };
}

module.exports = {
  computeCompletedSplitByTeacher,
  assertProgressUntouched,
  countCompletedForCourse,
  getCompletedSplit,
  reassignTeacher,
};
