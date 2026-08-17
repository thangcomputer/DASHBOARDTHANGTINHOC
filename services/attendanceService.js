'use strict';

/**
 * Canonical attendance completion + overdue admin notify.
 * Progress SoT: Schedule.status=completed → applyEnrollmentStats (recount).
 */

const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const logger = require('../config/logger');
const {
  applyEnrollmentStats,
  recordAttendanceGrade,
  normCourseName,
  syncStudentFromPrimaryEnrollment,
  toClientCourse,
} = require('./enrollmentService');
const { mapEnrollmentStatusToRoot } = require('../utils/studentStatusMap');
const {
  resolveAttendanceState,
  assertTeacherAttendanceAllowed,
  ATTENDANCE_CODES,
} = require('./attendanceWindow');

function attendanceError(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function actorRole(actor) {
  return String(actor?.role || '').toLowerCase();
}

function isAdminActor(actor) {
  const r = actorRole(actor);
  return r === 'admin' || r === 'staff';
}

/**
 * Sync enrollment counters from completed schedules (idempotent recount)
 * + ghi nhật ký grades (HV/GV Nhật ký học tập).
 */
async function syncEnrollmentProgressAfterAttendance(studentId, {
  courseName,
  logNote,
  logDate,
} = {}) {
  if (!studentId) return null;
  const student = await Student.findById(studentId);
  if (!student) return null;

  const courseKey = normCourseName(courseName || '');
  let prevCompleted = Number(student.completedSessions) || 0;
  if (courseKey && Array.isArray(student.enrollments) && student.enrollments.length) {
    const enr = student.enrollments.find(
      (e) => normCourseName(e.courseName || e.course) === courseKey,
    );
    if (enr) prevCompleted = Number(enr.completedSessions) || 0;
  }

  await applyEnrollmentStats(student, studentId, Schedule);

  // Sau điểm danh (GV / admin bù): luôn tăng ít nhất +1 so với trước sync.
  // Math.max(schedule, stored) trong applyEnrollmentStats không tăng khi
  // "đã học" nhập tay > số lịch completed (migration / bù tay).
  if (Array.isArray(student.enrollments) && student.enrollments.length) {
    let idx = courseKey
      ? student.enrollments.findIndex(
        (e) => normCourseName(e.courseName || e.course) === courseKey,
      )
      : -1;
    if (idx < 0) {
      idx = student.enrollments.findIndex(
        (e) => !['cancelled', 'refunded'].includes(String(e.status || '').toLowerCase()),
      );
    }
    if (idx >= 0) {
      const enr = student.enrollments[idx];
      const total = Number(enr.totalSessions) > 0 ? Number(enr.totalSessions) : 12;
      let completed = Number(enr.completedSessions) || 0;
      if (completed <= prevCompleted) {
        completed = Math.min(total, prevCompleted + 1);
        student.enrollments[idx].completedSessions = completed;
        student.enrollments[idx].remainingSessions = Math.max(0, total - completed);
        const st = String(enr.status || '').toLowerCase();
        if (!['cancelled', 'refunded'].includes(st) && completed >= total) {
          student.enrollments[idx].status = 'completed';
        }
        if (typeof student.markModified === 'function') {
          student.markModified('enrollments');
        }
        student.courses = student.enrollments.map(toClientCourse);
        syncStudentFromPrimaryEnrollment(student);
      }
    }
  } else if (completedRootNeedsBump(student, prevCompleted)) {
    const total = Number(student.totalSessions) > 0 ? Number(student.totalSessions) : 12;
    const completed = Math.min(total, prevCompleted + 1);
    student.completedSessions = completed;
    student.remainingSessions = Math.max(0, total - completed);
  }

  if (logNote) {
    recordAttendanceGrade(student, {
      courseName: courseName || student.course,
      note: logNote,
      grade: 0,
      date: logDate || new Date(),
      actedAt: new Date(),
    });
  }

  const active = (student.enrollments || []).filter(
    (e) => !['cancelled', 'refunded'].includes(String(e.status || '').toLowerCase()),
  );
  const primary = active.find((e) => e.isPrimary) || active[0];
  if (primary) {
    const st = String(primary.status || '').toLowerCase();
    if (st === 'completed') {
      student.status = mapEnrollmentStatusToRoot('completed');
    } else if (st === 'active') {
      student.status = mapEnrollmentStatusToRoot('active');
    }
  }

  await student.save();
  return student;
}

function completedRootNeedsBump(student, prevCompleted) {
  return (Number(student.completedSessions) || 0) <= prevCompleted;
}

/**
 * Idempotent overdue notify for admins.
 * Key: attendance-overdue:${scheduleId}
 */
async function maybeNotifyOverdueAttendance(io, schedule) {
  if (!schedule || String(schedule.status) !== 'scheduled') return { sent: false };
  const state = resolveAttendanceState(schedule);
  if (state.state !== 'OVERDUE_ATTENDANCE') return { sent: false };

  const scheduleId = String(schedule._id || schedule.id || '');
  if (!scheduleId) return { sent: false };

  const dedupeKey = `attendance-overdue:${scheduleId}`;
  const existing = await Notification.findOne({ 'payload.dedupeKey': dedupeKey }).select('_id').lean();
  if (existing) return { sent: false, deduped: true };

  const NotificationService = require('./NotificationService');
  const studentName = schedule.studentName || 'Học viên';
  const teacherName = schedule.teacherName || 'Giảng viên';
  const course = schedule.course || 'khóa học';
  const timeRange = `${schedule.startTime || '?'} - ${schedule.endTime || '?'}`;
  const studentId = schedule.studentId?._id || schedule.studentId;

  const link = `/admin#students?studentId=${encodeURIComponent(String(studentId || ''))}&tab=attendance&scheduleId=${encodeURIComponent(scheduleId)}`;

  await NotificationService.notifyAdmins(
    io,
    '⏰ GV chưa điểm danh buổi học',
    `HV ${studentName} · GV ${teacherName} · ${course} · ${timeRange} — Quá hạn điểm danh.`,
    {
      dedupeKey,
      type: 'attendance_overdue',
      scheduleId,
      studentId: String(studentId || ''),
      teacherId: String(schedule.teacherId || ''),
      course,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    },
    link,
  );

  // Soft mark so cron/list scanners skip quickly (field already on Schedule)
  try {
    await Schedule.updateOne(
      { _id: scheduleId, reminderSent: { $ne: true } },
      { $set: { reminderSent: true, reminderSentAt: new Date() } },
    );
  } catch (e) {
    logger.warn('[attendance] reminderSent mark:', e.message);
  }

  return { sent: true };
}

/**
 * Complete a scheduled session (teacher window OR admin makeup).
 * Atomic: only transitions scheduled → completed once.
 */
async function completeScheduleAttendance({
  schedule,
  actor,
  lateReason = '',
  note,
  io = null,
  forceAdminMakeup = false,
}) {
  if (!schedule) {
    throw attendanceError('Không tìm thấy lịch học', 'ATTENDANCE_NOT_FOUND', 404);
  }

  const role = actorRole(actor);
  const admin = isAdminActor(actor);
  const state = resolveAttendanceState(schedule);

  if (state.state === 'COMPLETED') {
    throw attendanceError('Buổi học đã được điểm danh.', ATTENDANCE_CODES.ALREADY_COMPLETED, 409);
  }
  if (state.state === 'CANCELLED') {
    throw attendanceError('Buổi học đã hủy — không thể điểm danh.', ATTENDANCE_CODES.CANCELLED, 409);
  }

  let attendanceMethod = 'teacher';
  let noteStamp = '';

  if (role === 'teacher') {
    assertTeacherAttendanceAllowed(schedule, { lateReason });
    if (state.state === 'PENDING_ATTENDANCE' && String(lateReason || '').trim()) {
      noteStamp = `[LATE] ${String(lateReason).trim()}`;
    }
  } else if (admin) {
    if (state.state === 'UPCOMING') {
      throw attendanceError('Chưa đến giờ học — chưa thể điểm danh.', ATTENDANCE_CODES.WINDOW_NOT_STARTED, 409);
    }
    if (state.state === 'OVERDUE_ATTENDANCE' || forceAdminMakeup) {
      attendanceMethod = 'admin_makeup';
      const who = actor?.name || actor?.id || 'Admin';
      noteStamp = `[ADMIN_MAKEUP] ${who} @ ${new Date().toISOString()}`;
    } else if (state.state === 'IN_PROGRESS' || state.state === 'PENDING_ATTENDANCE') {
      attendanceMethod = 'admin';
    }
  } else {
    throw attendanceError('Không có quyền điểm danh', 'ATTENDANCE_FORBIDDEN', 403);
  }

  // Enrollment gate
  if (schedule.studentId) {
    const studentForEnr = await Student.findById(schedule.studentId)
      .select('enrollments course status totalSessions')
      .lean();
    if (studentForEnr) {
      const courseKey = normCourseName(schedule.course);
      const enrs = Array.isArray(studentForEnr.enrollments) ? studentForEnr.enrollments : [];
      const enr = courseKey
        ? enrs.find((e) => normCourseName(e.courseName || e.course) === courseKey)
        : enrs.find((e) => String(e.status || '').toLowerCase() === 'active') || enrs[0];
      const enrStatus = String(enr?.status || '').toLowerCase();
      if (enr && ['cancelled', 'refunded', 'completed'].includes(enrStatus)) {
        throw attendanceError(
          'Enrollment không còn active — không thể điểm danh buổi mới.',
          ATTENDANCE_CODES.ENROLLMENT_COMPLETED,
          409,
        );
      }
      const total = Number(enr?.totalSessions || studentForEnr.totalSessions || 12);
      const completedCount = await Schedule.countDocuments({
        studentId: schedule.studentId,
        status: 'completed',
        ...(schedule.course ? { course: schedule.course } : {}),
      });
      if (completedCount >= total) {
        throw attendanceError(
          'Học viên đã hoàn thành đủ số buổi của khóa học.',
          ATTENDANCE_CODES.SESSION_LIMIT,
          409,
        );
      }
    }
  }

  const prevNote = String(schedule.note || '').trim();
  let nextNote = prevNote;
  if (noteStamp) {
    nextNote = prevNote && !prevNote.includes(noteStamp.slice(0, 12))
      ? `${noteStamp} | ${prevNote}`
      : (prevNote || noteStamp);
  } else if (note !== undefined && note !== null) {
    nextNote = String(note).trim();
  }

  const scheduleId = schedule._id || schedule.id;
  const updated = await Schedule.findOneAndUpdate(
    { _id: scheduleId, status: 'scheduled' },
    {
      $set: {
        status: 'completed',
        note: nextNote,
      },
    },
    { new: true, runValidators: true },
  ).populate([
    { path: 'teacherId', select: 'name phone' },
    { path: 'studentId', select: 'name course totalSessions studentExamUnlocked' },
  ]);

  if (!updated) {
    const again = await Schedule.findById(scheduleId).lean();
    if (again && again.status === 'completed') {
      throw attendanceError('Buổi học đã được điểm danh.', ATTENDANCE_CODES.ALREADY_COMPLETED, 409);
    }
    throw attendanceError('Không thể cập nhật lịch học', 'ATTENDANCE_UPDATE_FAILED', 500);
  }

  const actorName = String(actor?.name || '').trim() || (admin ? 'Admin' : 'Giảng viên');
  let logNote;
  if (attendanceMethod === 'admin_makeup') {
    logNote = `Điểm danh bù bởi ${actorName}`;
  } else if (attendanceMethod === 'admin') {
    logNote = `Điểm danh bởi Admin (${actorName})`;
  } else if (state.state === 'PENDING_ATTENDANCE' && String(lateReason || '').trim()) {
    logNote = `Điểm danh bổ sung: ${String(lateReason).trim()}`;
  } else if (String(note || '').trim() && !String(note).startsWith('[')) {
    logNote = String(note).trim();
  } else {
    logNote = 'Đã điểm danh hoàn thành buổi học';
  }

  const student = await syncEnrollmentProgressAfterAttendance(
    updated.studentId || schedule.studentId,
    {
      courseName: updated.course || schedule.course,
      logNote,
      logDate: updated.date || schedule.date || new Date(),
    },
  );

  return {
    schedule: updated,
    student,
    meta: {
      attendanceMethod,
      attendanceAt: new Date().toISOString(),
      actorId: String(actor?.id || actor?._id || ''),
      stateBefore: state.state,
      logNote,
    },
  };
}

module.exports = {
  syncEnrollmentProgressAfterAttendance,
  maybeNotifyOverdueAttendance,
  completeScheduleAttendance,
  isAdminActor,
};
