'use strict';

/**
 * Attendance time-window SoT (server clock).
 * Schedule DB statuses: scheduled | completed | cancelled | no_show
 * Derived UI/logic states: UPCOMING | IN_PROGRESS | PENDING_ATTENDANCE | OVERDUE_ATTENDANCE | COMPLETED | CANCELLED
 *
 * Policy (chốt): ATTENDANCE_GRACE_MINUTES = 60 (env override allowed).
 */

const ATTENDANCE_GRACE_MINUTES = Math.max(
  0,
  Number(process.env.ATTENDANCE_LATE_GRACE_MINUTES)
    || Number(process.env.ATTENDANCE_GRACE_MINUTES)
    || 60,
);

/** @deprecated alias — keep exports stable */
const ATTENDANCE_LATE_GRACE_MINUTES = ATTENDANCE_GRACE_MINUTES;

const ATTENDANCE_CODES = {
  NOT_READY: 'ATTENDANCE_WINDOW_NOT_STARTED',
  WINDOW_NOT_STARTED: 'ATTENDANCE_WINDOW_NOT_STARTED',
  REGULAR: 'ATTENDANCE_REGULAR',
  LATE: 'ATTENDANCE_PENDING',
  PENDING: 'ATTENDANCE_PENDING',
  WINDOW_EXPIRED: 'ATTENDANCE_WINDOW_EXPIRED',
  ALREADY_COMPLETED: 'ATTENDANCE_ALREADY_COMPLETED',
  CANCELLED: 'ATTENDANCE_CANCELLED_SCHEDULE',
  MISSING_LATE_REASON: 'ATTENDANCE_MISSING_LATE_REASON',
  ENROLLMENT_COMPLETED: 'ATTENDANCE_ENROLLMENT_COMPLETED',
  SESSION_LIMIT: 'ATTENDANCE_SESSION_LIMIT_REACHED',
};

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function scheduleBounds(schedule, now = new Date()) {
  const dateRaw = schedule?.date;
  const d = new Date(dateRaw);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();

  const startMins = parseTimeToMinutes(schedule.startTime);
  let endMins = parseTimeToMinutes(schedule.endTime);
  if (endMins == null && startMins != null) endMins = Math.min(startMins + 90, 23 * 60 + 59);
  if (startMins == null || endMins == null) return null;

  const startAt = new Date(y, mo, day, Math.floor(startMins / 60), startMins % 60, 0, 0);
  const endAt = new Date(y, mo, day, Math.floor(endMins / 60), endMins % 60, 0, 0);
  const graceEndAt = new Date(endAt.getTime() + ATTENDANCE_GRACE_MINUTES * 60 * 1000);

  return { startAt, endAt, graceEndAt, now: now instanceof Date ? now : new Date(now) };
}

/**
 * Derived attendance state machine (does not write DB).
 * @returns {{ state, kind, code, canTeacherAttend, canAdminMakeup, remainingGraceMs, startAt?, endAt?, graceEndAt?, attendanceType? }}
 */
function resolveAttendanceState(schedule, now = new Date()) {
  const status = String(schedule?.status || 'scheduled');
  const confirm = String(schedule?.studentConfirmStatus || 'none');

  if (status === 'completed') {
    return {
      state: 'COMPLETED',
      kind: 'COMPLETED',
      code: ATTENDANCE_CODES.ALREADY_COMPLETED,
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
    };
  }
  if (status === 'cancelled' || status === 'no_show') {
    return {
      state: 'CANCELLED',
      kind: 'CANCELLED',
      code: ATTENDANCE_CODES.CANCELLED,
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
    };
  }

  // Chờ HV xác nhận / tranh chấp — GV không điểm danh lại; Admin có thể xử lý dispute
  if (confirm === 'pending') {
    return {
      state: 'AWAITING_STUDENT_CONFIRM',
      kind: 'AWAITING_STUDENT_CONFIRM',
      code: 'ATTENDANCE_AWAITING_STUDENT',
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
    };
  }
  if (confirm === 'disputed') {
    return {
      state: 'ATTENDANCE_DISPUTED',
      kind: 'ATTENDANCE_DISPUTED',
      code: 'ATTENDANCE_DISPUTED',
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
    };
  }

  const bounds = scheduleBounds(schedule, now);
  if (!bounds) {
    return {
      state: 'UPCOMING',
      kind: 'NOT_READY',
      code: ATTENDANCE_CODES.WINDOW_NOT_STARTED,
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
    };
  }

  const { startAt, endAt, graceEndAt, now: n } = bounds;
  const t = n.getTime();

  if (t < startAt.getTime()) {
    return {
      state: 'UPCOMING',
      kind: 'NOT_READY',
      code: ATTENDANCE_CODES.WINDOW_NOT_STARTED,
      canTeacherAttend: false,
      canAdminMakeup: false,
      canAttend: false,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: 0,
      startAt,
      endAt,
      graceEndAt,
    };
  }

  if (t <= endAt.getTime()) {
    return {
      state: 'IN_PROGRESS',
      kind: 'IN_PROGRESS',
      code: ATTENDANCE_CODES.REGULAR,
      canTeacherAttend: true,
      canAdminMakeup: false,
      canAttend: true,
      canLateAttend: false,
      canRequestCorrection: false,
      remainingGraceMs: Math.max(0, graceEndAt.getTime() - t),
      startAt,
      endAt,
      graceEndAt,
      attendanceType: 'REGULAR',
    };
  }

  if (t <= graceEndAt.getTime()) {
    return {
      state: 'PENDING_ATTENDANCE',
      kind: 'LATE',
      code: ATTENDANCE_CODES.PENDING,
      canTeacherAttend: true,
      canAdminMakeup: true,
      canAttend: true,
      canLateAttend: true,
      canRequestCorrection: false,
      remainingGraceMs: Math.max(0, graceEndAt.getTime() - t),
      startAt,
      endAt,
      graceEndAt,
      attendanceType: 'PENDING',
    };
  }

  return {
    state: 'OVERDUE_ATTENDANCE',
    kind: 'WINDOW_EXPIRED',
    code: ATTENDANCE_CODES.WINDOW_EXPIRED,
    canTeacherAttend: false,
    canAdminMakeup: true,
    canAttend: false,
    canLateAttend: false,
    canRequestCorrection: true,
    remainingGraceMs: 0,
    startAt,
    endAt,
    graceEndAt,
  };
}

/** @deprecated use resolveAttendanceState */
function resolveAttendanceWindow(schedule, now = new Date()) {
  return resolveAttendanceState(schedule, now);
}

/**
 * Teacher may complete only in IN_PROGRESS / PENDING_ATTENDANCE.
 * lateReason optional in grace (PENDING).
 */
function assertTeacherAttendanceAllowed(schedule, { lateReason, now } = {}) {
  const win = resolveAttendanceState(schedule, now || new Date());

  if (win.state === 'COMPLETED') {
    const err = new Error('Buổi học đã được điểm danh.');
    err.status = 409;
    err.code = win.code;
    throw err;
  }
  if (win.state === 'CANCELLED') {
    const err = new Error('Buổi học đã hủy — không thể điểm danh.');
    err.status = 409;
    err.code = win.code;
    throw err;
  }
  if (win.state === 'UPCOMING') {
    const err = new Error('Chưa đến giờ học — chưa thể điểm danh.');
    err.status = 409;
    err.code = win.code;
    throw err;
  }
  if (win.state === 'OVERDUE_ATTENDANCE') {
    const err = new Error('Đã quá thời gian điểm danh. Vui lòng liên hệ quản trị viên để điểm danh bù.');
    err.status = 409;
    err.code = win.code;
    throw err;
  }
  // IN_PROGRESS / PENDING — allow (lateReason optional)
  void lateReason;
  return win;
}

/** @deprecated */
function assertAttendanceAllowed(schedule, opts) {
  return assertTeacherAttendanceAllowed(schedule, opts);
}

module.exports = {
  ATTENDANCE_GRACE_MINUTES,
  ATTENDANCE_LATE_GRACE_MINUTES,
  ATTENDANCE_CODES,
  parseTimeToMinutes,
  scheduleBounds,
  resolveAttendanceState,
  resolveAttendanceWindow,
  assertTeacherAttendanceAllowed,
  assertAttendanceAllowed,
};
