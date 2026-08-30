'use strict';

/**
 * Canonical attendance completion + overdue admin notify.
 * Progress SoT: Schedule.status=completed → applyEnrollmentStats (recount).
 */

const mongoose = require('mongoose');
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

function scheduleStudentId(schedule) {
  const raw = schedule?.studentId?._id || schedule?.studentId;
  if (!raw) return null;
  if (mongoose.Types.ObjectId.isValid(raw)) return new mongoose.Types.ObjectId(raw);
  return raw;
}

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
 * Buổi thứ N = max(lịch completed, enrollment/root completedSessions Admin) + 1.
 * Đếm lịch theo tên khóa đã chuẩn hóa (tránh lệch hoa/thường/dấu).
 */
async function resolveSessionOrdinalForSchedule(studentDoc, schedule) {
  const courseKey = normCourseName(schedule?.course);
  const enrs = Array.isArray(studentDoc?.enrollments) ? studentDoc.enrollments : [];
  let enr = courseKey
    ? enrs.find((e) => normCourseName(e.courseName || e.course) === courseKey)
    : null;
  if (!enr) {
    enr = enrs.find((e) => !['cancelled', 'refunded'].includes(String(e.status || '').toLowerCase()))
      || enrs[0];
  }
  const total = Number(enr?.totalSessions || studentDoc?.totalSessions || 12) || 12;

  let calendarCompleted = 0;
  const sid = scheduleStudentId(schedule);
  if (sid) {
    const rows = await Schedule.aggregate([
      { $match: { studentId: sid, status: 'completed' } },
      { $group: { _id: '$course', completed: { $sum: 1 } } },
    ]);
    rows.forEach((r) => {
      const key = normCourseName(r._id);
      if (courseKey && key !== courseKey) return;
      calendarCompleted += Number(r.completed) || 0;
    });
  }

  const enrDone = enr?.completedSessions != null
    ? Math.max(0, Number(enr.completedSessions) || 0)
    : 0;
  const rootDone = Math.max(0, Number(studentDoc?.completedSessions) || 0);
  // Cùng khóa (hoặc không tìm thấy enr) → lấy max với root; khác khóa thì chỉ tin enr
  const sameAsRoot = !courseKey
    || !studentDoc?.course
    || courseKey === normCourseName(studentDoc.course)
    || !enr;
  const storedDone = sameAsRoot ? Math.max(enrDone, rootDone) : enrDone;
  const effectiveDone = Math.max(calendarCompleted, storedDone);
  return {
    enr,
    total,
    calendarCompleted,
    storedDone,
    effectiveDone,
    sessionOrdinal: effectiveDone + 1,
    sessionTotal: total,
    atLimit: effectiveDone >= total,
  };
}

/**
 * Cập nhật sessionOrdinalPreview theo tiến độ thật (không để kẹt ở 1 khi Admin đã ghi buổi).
 * Trả về schedule đã gắn preview mới (in-memory + persist nếu đổi).
 */
async function refreshScheduleSessionPreview(schedule) {
  if (!schedule) return schedule;
  // Ca đã completed: sessionOrdinalPreview = buổi vừa tính (finalDone).
  // Không đẩy lên done+1 — đó là buổi kế tiếp, làm thông báo GV hiện 2 khi HV vừa xác nhận buổi 1.
  if (String(schedule.status || '') === 'completed') return schedule;
  const sid = schedule.studentId?._id || schedule.studentId;
  if (!sid) return schedule;
  const student = await Student.findById(sid)
    .select('enrollments course status totalSessions completedSessions')
    .lean();
  if (!student) return schedule;
  const progress = await resolveSessionOrdinalForSchedule(student, schedule);
  const nextOrdinal = Math.max(
    Number(schedule.sessionOrdinalPreview) || 0,
    progress.sessionOrdinal,
  );
  const nextTotal = Number(progress.sessionTotal) > 0
    ? progress.sessionTotal
    : (Number(schedule.sessionTotalPreview) || 12);
  const prevO = Number(schedule.sessionOrdinalPreview) || 0;
  const prevT = Number(schedule.sessionTotalPreview) || 0;
  schedule.sessionOrdinalPreview = nextOrdinal;
  schedule.sessionTotalPreview = nextTotal;
  if (nextOrdinal !== prevO || nextTotal !== prevT) {
    const id = schedule._id || schedule.id;
    if (id) {
      await Schedule.updateOne(
        { _id: id },
        { $set: { sessionOrdinalPreview: nextOrdinal, sessionTotalPreview: nextTotal } },
      ).catch(() => {});
    }
  }
  return schedule;
}

/**
 * Sync enrollment counters from completed schedules (idempotent recount)
 * + ghi nhật ký grades (HV/GV Nhật ký học tập).
 */
async function syncEnrollmentProgressAfterAttendance(studentId, {
  courseName,
  logNote,
  logDate,
  grade = 0,
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
      grade: Number.isFinite(Number(grade)) ? Number(grade) : 0,
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
 * Complete a scheduled session (teacher window OR admin makeup OR finalize after HV/Admin confirm).
 * Atomic: only transitions scheduled → completed once.
 */
async function completeScheduleAttendance({
  schedule,
  actor,
  lateReason = '',
  note,
  io = null,
  forceAdminMakeup = false,
  /** Kết thúc sau khi HV đồng ý / Admin duyệt tranh chấp — bỏ qua cửa sổ giờ. */
  forceFinalizeConfirm = false,
  confirmOutcome = null, // 'accepted' | 'admin_approved'
}) {
  if (!schedule) {
    throw attendanceError('Không tìm thấy lịch học', 'ATTENDANCE_NOT_FOUND', 404);
  }

  const role = actorRole(actor);
  const admin = isAdminActor(actor);
  const confirmStatus = String(schedule.studentConfirmStatus || 'none');
  const state = resolveAttendanceState(schedule);

  if (state.state === 'COMPLETED') {
    throw attendanceError('Buổi học đã được điểm danh.', ATTENDANCE_CODES.ALREADY_COMPLETED, 409);
  }
  if (state.state === 'CANCELLED') {
    throw attendanceError('Buổi học đã hủy — không thể điểm danh.', ATTENDANCE_CODES.CANCELLED, 409);
  }

  let attendanceMethod = 'teacher';
  let noteStamp = '';
  /** Buổi thứ N sau khi điểm danh (cùng rule đếm Schedule.completed với notifyAttendanceTaken). */
  let sessionOrdinal = null;
  let sessionTotal = null;

  if (forceFinalizeConfirm) {
    if (!['pending', 'disputed'].includes(confirmStatus)) {
      throw attendanceError('Buổi học không ở trạng thái chờ xác nhận.', 'ATTENDANCE_CONFIRM_INVALID', 409);
    }
    attendanceMethod = confirmOutcome === 'admin_approved' ? 'admin_dispute_approve' : 'student_confirm';
  } else if (role === 'teacher') {
    assertTeacherAttendanceAllowed(schedule, { lateReason });
    if (state.state === 'PENDING_ATTENDANCE' && String(lateReason || '').trim()) {
      noteStamp = `[LATE] ${String(lateReason).trim()}`;
    }
  } else if (admin) {
    if (state.state === 'UPCOMING') {
      throw attendanceError('Điểm danh sau 15 phút kể từ giờ bắt đầu buổi học.', ATTENDANCE_CODES.WINDOW_NOT_STARTED, 409);
    }
    if (state.state === 'OVERDUE_ATTENDANCE' || forceAdminMakeup) {
      attendanceMethod = 'admin_makeup';
    } else if (state.state === 'IN_PROGRESS' || state.state === 'PENDING_ATTENDANCE') {
      attendanceMethod = 'admin';
    }
  } else {
    throw attendanceError('Không có quyền điểm danh', 'ATTENDANCE_FORBIDDEN', 403);
  }

  // Enrollment gate
  if (schedule.studentId) {
    const studentForEnr = await Student.findById(schedule.studentId)
      .select('enrollments course status totalSessions completedSessions')
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
      const progress = await resolveSessionOrdinalForSchedule(studentForEnr, schedule);
      if (progress.atLimit) {
        throw attendanceError(
          'Học viên đã hoàn thành đủ số buổi của khóa học.',
          ATTENDANCE_CODES.SESSION_LIMIT,
          409,
        );
      }
      // Không kẹt preview sai (vd. 1): lấy max(preview đã gửi, tiến độ thật hiện tại)
      sessionOrdinal = Math.max(
        Number(schedule.sessionOrdinalPreview) || 0,
        progress.sessionOrdinal,
      );
      sessionTotal = Number(schedule.sessionTotalPreview) > 0
        ? Number(schedule.sessionTotalPreview)
        : progress.sessionTotal;
    }
  }

  // Makeup stamp sau khi đã biết buổi thứ N (khớp số buổi HV)
  if (attendanceMethod === 'admin_makeup') {
    const who = actor?.name || actor?.id || 'Admin';
    const progress = (sessionOrdinal != null && sessionTotal != null)
      ? ` · buổi ${sessionOrdinal}/${sessionTotal}`
      : (sessionOrdinal != null ? ` · buổi ${sessionOrdinal}` : '');
    noteStamp = `[ADMIN_MAKEUP] ${who} @ ${new Date().toISOString()}${progress}`;
  }

  const prevNote = String(schedule.note || '').trim();
  let nextNote = prevNote;
  if (noteStamp) {
    nextNote = prevNote && !prevNote.includes(noteStamp.slice(0, 12))
      ? `${noteStamp} | ${prevNote}`
      : (prevNote || noteStamp);
  } else if (note !== undefined && note !== null) {
    nextNote = String(note).trim();
  } else if (forceFinalizeConfirm && schedule.attendancePendingNote) {
    nextNote = String(schedule.attendancePendingNote).trim() || prevNote;
  }

  const confirmFinal = forceFinalizeConfirm
    ? (confirmOutcome === 'admin_approved' ? 'admin_approved' : 'accepted')
    : (attendanceMethod === 'admin_makeup' || attendanceMethod === 'admin' ? 'accepted' : 'accepted');

  const scheduleId = schedule._id || schedule.id;
  const setDoc = {
    status: 'completed',
    note: nextNote,
    studentConfirmStatus: confirmFinal,
    studentConfirmedAt: new Date(),
  };
  if (forceFinalizeConfirm && confirmOutcome === 'admin_approved') {
    setDoc.attendanceDisputeResolvedAt = new Date();
    setDoc.attendanceDisputeResolvedBy = String(actor?.name || actor?.id || 'Admin');
  }

  const updated = await Schedule.findOneAndUpdate(
    { _id: scheduleId, status: 'scheduled' },
    { $set: setDoc },
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

  const gradeForLog = schedule.attendancePendingGrade != null
    ? Number(schedule.attendancePendingGrade)
    : undefined;

  // Sync tiến độ trước — số buổi nhật ký = completedSessions SAU điểm danh (gồm ghi nhận trước)
  const student = await syncEnrollmentProgressAfterAttendance(
    updated.studentId || schedule.studentId,
    {
      courseName: updated.course || schedule.course,
      logDate: updated.date || schedule.date || new Date(),
      ...(Number.isFinite(gradeForLog) ? { grade: gradeForLog } : {}),
      // chưa ghi note — ghi sau khi biết số buổi thật
    },
  );

  const courseKey = normCourseName(updated.course || schedule.course);
  let finalDone = Math.max(0, Number(sessionOrdinal) || 0);
  let finalTotal = Math.max(1, Number(sessionTotal) || 12);
  if (student) {
    const enrs = Array.isArray(student.enrollments) ? student.enrollments : [];
    const enr = courseKey
      ? enrs.find((e) => normCourseName(e.courseName || e.course) === courseKey)
      : null;
    if (enr) {
      finalDone = Math.max(finalDone, Number(enr.completedSessions) || 0);
      if (Number(enr.totalSessions) > 0) finalTotal = Number(enr.totalSessions);
    } else {
      finalDone = Math.max(finalDone, Number(student.completedSessions) || 0);
      if (Number(student.totalSessions) > 0) finalTotal = Number(student.totalSessions);
    }
  }
  if (finalDone < 1 && sessionOrdinal) finalDone = sessionOrdinal;

  const actorName = String(actor?.name || '').trim() || (admin ? 'Admin' : 'Giảng viên');
  const buoiLabel = finalDone > 0
    ? ` buổi thứ ${finalDone}/${finalTotal}`
    : '';
  let logNote;
  if (attendanceMethod === 'admin_makeup') {
    logNote = `Điểm danh bù${buoiLabel} bởi ${actorName}`;
  } else if (attendanceMethod === 'admin_dispute_approve') {
    logNote = `Admin duyệt tranh chấp điểm danh${buoiLabel} (${actorName})`;
  } else if (attendanceMethod === 'student_confirm') {
    logNote = `HV xác nhận điểm danh${buoiLabel}`;
  } else if (attendanceMethod === 'admin') {
    logNote = `Điểm danh bởi Admin (${actorName})${buoiLabel}`;
  } else if (state.state === 'PENDING_ATTENDANCE' && String(lateReason || '').trim()) {
    logNote = `Điểm danh bổ sung${buoiLabel}: ${String(lateReason).trim()}`;
  } else if (String(note || schedule.attendancePendingNote || '').trim() && !String(note || schedule.attendancePendingNote || '').startsWith('[')) {
    const raw = String(note || schedule.attendancePendingNote).trim();
    logNote = /buổi\s*\d+/i.test(raw) ? raw : `${raw}${buoiLabel}`;
  } else {
    logNote = finalDone > 0
      ? `Buổi ${finalDone}/${finalTotal}: Đã điểm danh hoàn thành buổi học`
      : 'Đã điểm danh hoàn thành buổi học';
  }

  if (student && logNote) {
    recordAttendanceGrade(student, {
      courseName: updated.course || schedule.course || student.course,
      note: logNote,
      grade: Number.isFinite(gradeForLog) ? gradeForLog : 0,
      date: updated.date || schedule.date || new Date(),
      actedAt: new Date(),
    });
    await student.save();
  }

  if (finalDone > 0) {
    await Schedule.updateOne(
      { _id: scheduleId },
      { $set: { sessionOrdinalPreview: finalDone, sessionTotalPreview: finalTotal } },
    ).catch(() => {});
    updated.sessionOrdinalPreview = finalDone;
    updated.sessionTotalPreview = finalTotal;
  }

  return {
    schedule: updated,
    student,
    meta: {
      attendanceMethod,
      attendanceAt: new Date().toISOString(),
      actorId: String(actor?.id || actor?._id || ''),
      stateBefore: state.state,
      logNote,
      completedSessions: finalDone || sessionOrdinal,
      totalSessions: finalTotal || sessionTotal,
    },
  };
}

/**
 * GV (sau 30s hủy) → gửi điểm danh chờ HV xác nhận. Chưa completed, chưa tính buổi.
 */
async function requestStudentAttendanceConfirm({
  schedule,
  actor,
  lateReason = '',
  note = '',
  grade = null,
}) {
  if (!schedule) {
    throw attendanceError('Không tìm thấy lịch học', 'ATTENDANCE_NOT_FOUND', 404);
  }
  const role = actorRole(actor);
  if (role !== 'teacher' && !isAdminActor(actor)) {
    throw attendanceError('Không có quyền gửi xác nhận điểm danh', 'ATTENDANCE_FORBIDDEN', 403);
  }
  if (String(schedule.status) !== 'scheduled') {
    throw attendanceError('Buổi học không thể gửi xác nhận.', 'ATTENDANCE_CONFIRM_INVALID', 409);
  }
  const confirm = String(schedule.studentConfirmStatus || 'none');
  if (confirm === 'pending') {
    throw attendanceError('Đã gửi xác nhận — đang chờ học viên.', 'ATTENDANCE_AWAITING_STUDENT', 409);
  }
  if (confirm === 'disputed') {
    throw attendanceError('Buổi đang tranh chấp — chờ Admin xử lý.', 'ATTENDANCE_DISPUTED', 409);
  }
  if (['accepted', 'admin_approved'].includes(confirm) || schedule.status === 'completed') {
    throw attendanceError('Buổi học đã được điểm danh.', ATTENDANCE_CODES.ALREADY_COMPLETED, 409);
  }

  if (role === 'teacher') {
    assertTeacherAttendanceAllowed(schedule, { lateReason });
  }

  let sessionOrdinal = null;
  let sessionTotal = null;
  if (schedule.studentId) {
    const studentForEnr = await Student.findById(schedule.studentId)
      .select('enrollments course status totalSessions completedSessions')
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
      const progress = await resolveSessionOrdinalForSchedule(studentForEnr, schedule);
      if (progress.atLimit) {
        throw attendanceError(
          'Học viên đã hoàn thành đủ số buổi của khóa học.',
          ATTENDANCE_CODES.SESSION_LIMIT,
          409,
        );
      }
      sessionOrdinal = progress.sessionOrdinal;
      sessionTotal = progress.sessionTotal;
    }
  }

  let pendingNote = String(note || '').trim();
  if (!pendingNote && String(lateReason || '').trim()) {
    pendingNote = `[LATE] ${String(lateReason).trim()}`;
  }
  if (!pendingNote) {
    pendingNote = sessionOrdinal
      ? `Buổi ${sessionOrdinal}: Đã điểm danh hoàn thành buổi học`
      : 'Đã điểm danh hoàn thành buổi học';
  }

  const scheduleId = schedule._id || schedule.id;
  const updated = await Schedule.findOneAndUpdate(
    {
      _id: scheduleId,
      status: 'scheduled',
      $or: [
        { studentConfirmStatus: { $exists: false } },
        { studentConfirmStatus: null },
        { studentConfirmStatus: 'none' },
        { studentConfirmStatus: '' },
      ],
    },
    {
      $set: {
        studentConfirmStatus: 'pending',
        studentConfirmRequestedAt: new Date(),
        attendancePendingNote: pendingNote,
        attendancePendingGrade: grade != null && Number.isFinite(Number(grade)) ? Number(grade) : null,
        sessionOrdinalPreview: sessionOrdinal,
        sessionTotalPreview: sessionTotal,
      },
    },
    { new: true, runValidators: true },
  ).populate([
    { path: 'teacherId', select: 'name phone' },
    { path: 'studentId', select: 'name course totalSessions' },
  ]);

  if (!updated) {
    const again = await Schedule.findById(scheduleId).lean();
    if (again && String(again.studentConfirmStatus) === 'pending') {
      throw attendanceError('Đã gửi xác nhận — đang chờ học viên.', 'ATTENDANCE_AWAITING_STUDENT', 409);
    }
    throw attendanceError('Không thể gửi xác nhận điểm danh', 'ATTENDANCE_UPDATE_FAILED', 500);
  }

  return {
    schedule: updated,
    meta: {
      attendanceMethod: 'awaiting_student_confirm',
      completedSessions: sessionOrdinal,
      totalSessions: sessionTotal,
    },
  };
}

async function respondStudentAttendanceConfirm({ schedule, actor, decision }) {
  if (!schedule) {
    throw attendanceError('Không tìm thấy lịch học', 'ATTENDANCE_NOT_FOUND', 404);
  }
  if (actorRole(actor) !== 'student') {
    throw attendanceError('Chỉ học viên xác nhận điểm danh', 'ATTENDANCE_FORBIDDEN', 403);
  }
  const sid = String(schedule.studentId?._id || schedule.studentId || '');
  const actorId = String(actor?.id || actor?._id || '');
  if (!sid || sid !== actorId) {
    throw attendanceError('Bạn chỉ xác nhận được lịch của mình', 'ATTENDANCE_FORBIDDEN', 403);
  }
  if (String(schedule.status) !== 'scheduled' || String(schedule.studentConfirmStatus) !== 'pending') {
    throw attendanceError('Không còn yêu cầu xác nhận điểm danh.', 'ATTENDANCE_CONFIRM_INVALID', 409);
  }

  const dec = String(decision || '').toLowerCase();
  if (dec === 'accept' || dec === 'agree' || dec === 'dong_y') {
    return completeScheduleAttendance({
      schedule,
      actor,
      note: schedule.attendancePendingNote || undefined,
      forceFinalizeConfirm: true,
      confirmOutcome: 'accepted',
    });
  }
  if (dec === 'dispute' || dec === 'reject' || dec === 'khong_dong_y') {
    const scheduleId = schedule._id || schedule.id;
    const updated = await Schedule.findOneAndUpdate(
      { _id: scheduleId, status: 'scheduled', studentConfirmStatus: 'pending' },
      {
        $set: {
          studentConfirmStatus: 'disputed',
          studentConfirmedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).populate([
      { path: 'teacherId', select: 'name phone' },
      { path: 'studentId', select: 'name course' },
    ]);
    if (!updated) {
      throw attendanceError('Không thể ghi nhận tranh chấp', 'ATTENDANCE_UPDATE_FAILED', 500);
    }
    return {
      schedule: updated,
      student: null,
      meta: {
        attendanceMethod: 'student_dispute',
        disputed: true,
        completedSessions: updated.sessionOrdinalPreview,
        totalSessions: updated.sessionTotalPreview,
      },
    };
  }
  throw attendanceError('Quyết định không hợp lệ (accept/dispute)', 'ATTENDANCE_CONFIRM_INVALID', 400);
}

async function resolveAttendanceDispute({ schedule, actor, decision }) {
  if (!schedule) {
    throw attendanceError('Không tìm thấy lịch học', 'ATTENDANCE_NOT_FOUND', 404);
  }
  if (!isAdminActor(actor)) {
    throw attendanceError('Chỉ Admin xử lý tranh chấp điểm danh', 'ATTENDANCE_FORBIDDEN', 403);
  }
  if (String(schedule.studentConfirmStatus) !== 'disputed' || String(schedule.status) !== 'scheduled') {
    throw attendanceError('Buổi học không ở trạng thái tranh chấp.', 'ATTENDANCE_CONFIRM_INVALID', 409);
  }

  const dec = String(decision || '').toLowerCase();
  if (dec === 'approve' || dec === 'accept' || dec === 'chap_thuan') {
    return completeScheduleAttendance({
      schedule,
      actor,
      note: schedule.attendancePendingNote || undefined,
      forceFinalizeConfirm: true,
      confirmOutcome: 'admin_approved',
    });
  }
  if (dec === 'reject' || dec === 'deny' || dec === 'khong_chap_thuan') {
    const scheduleId = schedule._id || schedule.id;
    const who = String(actor?.name || actor?.id || 'Admin');
    const updated = await Schedule.findOneAndUpdate(
      { _id: scheduleId, status: 'scheduled', studentConfirmStatus: 'disputed' },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          studentConfirmStatus: 'admin_rejected',
          attendanceDisputeResolvedAt: new Date(),
          attendanceDisputeResolvedBy: who,
          note: [
            `Admin từ chối điểm danh — ${who} · ${new Date().toLocaleString('vi-VN')}`,
            String(schedule.note || '').trim(),
          ].filter(Boolean).join(' | '),
        },
      },
      { new: true, runValidators: true },
    ).populate([
      { path: 'teacherId', select: 'name phone' },
      { path: 'studentId', select: 'name course' },
    ]);
    if (!updated) {
      throw attendanceError('Không thể từ chối buổi học', 'ATTENDANCE_UPDATE_FAILED', 500);
    }
    return {
      schedule: updated,
      student: null,
      meta: {
        attendanceMethod: 'admin_dispute_reject',
        rejected: true,
        completedSessions: updated.sessionOrdinalPreview,
        totalSessions: updated.sessionTotalPreview,
      },
    };
  }
  throw attendanceError('Quyết định không hợp lệ (approve/reject)', 'ATTENDANCE_CONFIRM_INVALID', 400);
}

module.exports = {
  syncEnrollmentProgressAfterAttendance,
  maybeNotifyOverdueAttendance,
  completeScheduleAttendance,
  requestStudentAttendanceConfirm,
  respondStudentAttendanceConfirm,
  resolveAttendanceDispute,
  resolveSessionOrdinalForSchedule,
  refreshScheduleSessionPreview,
  isAdminActor,
};
