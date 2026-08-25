/**
 * Client-side scheduling limit helpers (UX only — backend remains SoT).
 * Keep MAX in sync with services/schedulingValidation.js
 */

export const MAX_STUDENT_SESSIONS_PER_DAY = 1;

const SLOT_OCCUPYING = new Set(['scheduled', 'completed', 'no_show']);
const USAGE_STATUSES = new Set(['scheduled', 'completed']);

function normCourse(name) {
  return String(name || '').trim().toLowerCase();
}

function localDateKey(raw) {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const day = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(raw).trim();
  // YYYY-MM-DD thuần — không slice ISO UTC (tránh lệch ngày đêm VN)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function countStudentSessionsOnDate(schedules, studentId, date, excludeScheduleId) {
  const sid = String(studentId || '');
  const day = localDateKey(date);
  const exclude = excludeScheduleId ? String(excludeScheduleId) : '';
  return (schedules || []).filter((sch) => {
    if (!sch || !SLOT_OCCUPYING.has(String(sch.status || 'scheduled'))) return false;
    const id = String(sch.id || sch._id || '');
    if (exclude && id === exclude) return false;
    const schSid = String(sch.studentId?._id || sch.studentId?.id || sch.studentId || '');
    if (schSid !== sid) return false;
    return localDateKey(sch.date) === day;
  }).length;
}

export function countEnrollmentUsage(schedules, studentId, courseName, excludeScheduleId) {
  const sid = String(studentId || '');
  const course = normCourse(courseName);
  const exclude = excludeScheduleId ? String(excludeScheduleId) : '';
  return (schedules || []).filter((sch) => {
    if (!sch || !USAGE_STATUSES.has(String(sch.status || ''))) return false;
    const id = String(sch.id || sch._id || '');
    if (exclude && id === exclude) return false;
    const schSid = String(sch.studentId?._id || sch.studentId?.id || sch.studentId || '');
    if (schSid !== sid) return false;
    if (course && normCourse(sch.course) !== course) return false;
    return true;
  }).length;
}

/** Số buổi đã điểm danh xong trên lịch (status=completed). */
export function countEnrollmentCompleted(schedules, studentId, courseName) {
  const sid = String(studentId || '');
  const course = normCourse(courseName);
  return (schedules || []).filter((sch) => {
    if (String(sch?.status || '') !== 'completed') return false;
    const schSid = String(sch.studentId?._id || sch.studentId?.id || sch.studentId || '');
    if (schSid !== sid) return false;
    if (course && normCourse(sch.course) !== course) return false;
    return true;
  }).length;
}

/**
 * Tiến độ chuẩn = enrollment.completedSessions (Admin).
 * priorCredit = buổi ghi nhận trước / chỉnh tay chưa có đủ lịch completed.
 * effectiveUsed = ca trên lịch + prior → khớp «còn lại» Admin khi xếp lịch.
 */
export function resolveEnrollmentProgress(student, schedules, excludeScheduleId) {
  const studentId = String(student?._id || student?.id || '');
  const course = student?.course || '';
  const totalSessions = Number(student?.totalSessions) > 0 ? Number(student.totalSessions) : 12;
  const storedDone = student?.completedSessions != null
    ? Math.max(0, Number(student.completedSessions) || 0)
    : Math.max(0, totalSessions - (Number(student?.remainingSessions) || 0));
  const onCalendar = countEnrollmentCompleted(schedules, studentId, course);
  const used = countEnrollmentUsage(schedules, studentId, course, excludeScheduleId);
  const priorCredit = Math.max(0, storedDone - onCalendar);
  const displayDone = storedDone;
  const effectiveUsed = used + priorCredit;
  return {
    studentId,
    course,
    totalSessions,
    storedDone,
    onCalendar,
    priorCredit,
    used,
    effectiveUsed,
    displayDone,
    remaining: Math.max(0, totalSessions - effectiveUsed),
    remainingLearned: Math.max(0, totalSessions - displayDone),
  };
}

/**
 * Build UX gate for one student enrollment row.
 */
export function getStudentScheduleGate(student, schedules, date, excludeScheduleId) {
  const course = student?.course || '';
  const enrStatus = String(
    student?.enrollmentStatus
    || student?.status
    || (Array.isArray(student?.enrollments)
      ? (student.enrollments.find((e) => normCourse(e.courseName) === normCourse(course))?.status)
      : '')
    || 'active',
  ).toLowerCase();

  const progress = resolveEnrollmentProgress(student, schedules, excludeScheduleId);
  const {
    studentId,
    totalSessions,
    used,
    effectiveUsed,
    displayDone,
    onCalendar,
    priorCredit,
    remaining,
    remainingLearned,
  } = progress;
  const todayCount = countStudentSessionsOnDate(schedules, studentId, date, excludeScheduleId);

  const completedLike = enrStatus === 'completed'
    || enrStatus === 'hoàn thành'
    || effectiveUsed >= totalSessions
    || displayDone >= totalSessions;
  const notActive = enrStatus === 'cancelled'
    || enrStatus === 'refunded'
    || enrStatus === 'paused'
    || enrStatus === 'pending_payment'
    || enrStatus === 'thôi học'
    || student?.interactionLocked === true;
  const dailyFull = todayCount >= MAX_STUDENT_SESSIONS_PER_DAY;

  let canSchedule = true;
  let reason = '';
  if (completedLike) {
    canSchedule = false;
    reason = `Đã hoàn thành ${totalSessions}/${totalSessions} buổi`;
  } else if (notActive) {
    canSchedule = false;
    reason = (student?.interactionLocked || enrStatus === 'cancelled' || enrStatus === 'refunded' || enrStatus === 'thôi học')
      ? 'Học viên đã thôi học / hoàn phí'
      : `Khóa học không còn active (${enrStatus})`;
  } else if (dailyFull) {
    canSchedule = false;
    reason = `Đã đủ ${MAX_STUDENT_SESSIONS_PER_DAY} ca trong ngày`;
  }

  return {
    studentId,
    course,
    totalSessions,
    used,
    effectiveUsed,
    completed: displayDone,
    onCalendar,
    priorCredit,
    remaining,
    remainingLearned,
    todayCount,
    todayMax: MAX_STUDENT_SESSIONS_PER_DAY,
    canSchedule,
    reason,
    progressLabel: `${displayDone}/${totalSessions} buổi`,
    todayLabel: `${todayCount}/${MAX_STUDENT_SESSIONS_PER_DAY} ca`,
  };
}
