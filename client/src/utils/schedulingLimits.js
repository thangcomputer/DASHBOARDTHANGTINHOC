/**
 * Client-side scheduling limit helpers (UX only - backend remains SoT).
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
  // YYYY-MM-DD thuần - không slice ISO UTC (tránh lệch ngày đêm VN)
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

function normalizeRealEnrollmentId(raw) {
  const s = String(raw || '').trim();
  if (!s || s === 'main' || /^enr-\d+$/i.test(s) || /^course-\d+$/i.test(s)) return '';
  return s;
}

function scheduleMatchesEnrollmentScope(sch, { enrollmentId = '', registeredAt = null, hasMultipleSameCourse = false } = {}) {
  const targetEnrId = normalizeRealEnrollmentId(enrollmentId);
  const schEnrId = String(sch?.enrollmentId?._id || sch?.enrollmentId || '').trim();
  if (targetEnrId) {
    if (schEnrId) return schEnrId === targetEnrId;
    if (hasMultipleSameCourse && registeredAt) {
      if (sch.createdAt) {
        const schCreated = new Date(sch.createdAt).getTime();
        const regTime = new Date(registeredAt).getTime();
        if (Number.isFinite(schCreated) && Number.isFinite(regTime) && schCreated < regTime) return false;
      } else if (String(sch.status || '') === 'completed') {
        const regDay = localDateKey(registeredAt);
        const schDay = localDateKey(sch.date);
        if (regDay && schDay && schDay < regDay) return false;
      }
    }
  }
  return true;
}

function pickTargetEnrollmentForStudent(student, courseName) {
  const list = Array.isArray(student?.enrollments) && student.enrollments.length
    ? student.enrollments
    : (Array.isArray(student?.courses) ? student.courses : []);
  if (!list.length) return null;
  const reqId = normalizeRealEnrollmentId(student?._enrollmentId || student?.activeEnrollmentId || student?.enrollmentId);
  if (reqId) {
    const byId = list.find((e) => String(e?._id || e?.id || e?.enrollmentId || '') === reqId);
    if (byId) return byId;
  }
  const key = normCourse(courseName || student?.course || '');
  const pool = key
    ? list.filter((e) => normCourse(e?.courseName || e?.name || e?.course) === key)
    : list;
  const search = pool.length ? pool : list;
  return search.find((e) => String(e?.status || '').toLowerCase() === 'active')
    || search.find((e) => !['cancelled', 'refunded'].includes(String(e?.status || '').toLowerCase()))
    || search[0]
    || null;
}

export function countEnrollmentUsage(schedules, studentId, courseName, excludeScheduleId, options = {}) {
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
    return scheduleMatchesEnrollmentScope(sch, options);
  }).length;
}

/** Số buổi đã điểm danh xong trên lịch (status=completed). */
export function countEnrollmentCompleted(schedules, studentId, courseName, options = {}) {
  const sid = String(studentId || '');
  const course = normCourse(courseName);
  return (schedules || []).filter((sch) => {
    if (String(sch?.status || '') !== 'completed') return false;
    const schSid = String(sch.studentId?._id || sch.studentId?.id || sch.studentId || '');
    if (schSid !== sid) return false;
    if (course && normCourse(sch.course) !== course) return false;
    return scheduleMatchesEnrollmentScope(sch, options);
  }).length;
}

/**
 * Tiến độ chuẩn = enrollment.completedSessions (Admin).
 * priorCredit = buổi ghi nhận trước / chỉnh tay chưa có đủ lịch completed.
 * effectiveUsed = ca trên lịch + prior → khớp «còn lại» Admin khi xếp lịch.
 */
export function resolveEnrollmentProgress(student, schedules, excludeScheduleId) {
  const studentId = String(student?._id || student?.id || '');
  const targetEnr = pickTargetEnrollmentForStudent(student, student?.course || '');
  const course = student?.course || targetEnr?.courseName || targetEnr?.name || '';
  const totalSessions = Number(student?.totalSessions || targetEnr?.totalSessions) > 0
    ? Number(student?.totalSessions || targetEnr?.totalSessions)
    : 12;
  const storedDoneRaw = student?.completedSessions != null
    ? student.completedSessions
    : targetEnr?.completedSessions;
  const remRaw = student?.remainingSessions != null
    ? student.remainingSessions
    : targetEnr?.remainingSessions;
  const storedDone = storedDoneRaw != null
    ? Math.max(0, Number(storedDoneRaw) || 0)
    : Math.max(0, totalSessions - (Number(remRaw) || 0));

  const enrollmentList = Array.isArray(student?.enrollments) && student.enrollments.length
    ? student.enrollments
    : (Array.isArray(student?.courses) ? student.courses : []);
  const normCourseKey = normCourse(course);
  const hasMultipleSameCourse = Boolean(
    normCourseKey
    && enrollmentList.filter((e) => normCourse(e?.courseName || e?.name || e?.course) === normCourseKey).length > 1,
  );
  const scopeOptions = {
    enrollmentId: normalizeRealEnrollmentId(
      targetEnr?._id || targetEnr?.id || targetEnr?.enrollmentId || student?._enrollmentId || student?.activeEnrollmentId,
    ),
    registeredAt: targetEnr?.registeredAt || student?.registeredAt || null,
    hasMultipleSameCourse,
  };

  const onCalendar = countEnrollmentCompleted(schedules, studentId, course, scopeOptions);
  const used = countEnrollmentUsage(schedules, studentId, course, excludeScheduleId, scopeOptions);
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
  const targetEnr = pickTargetEnrollmentForStudent(student, student?.course || '');
  const course = student?.course || targetEnr?.courseName || targetEnr?.name || '';
  const enrStatus = String(
    student?.enrollmentStatus
    || targetEnr?.status
    || student?.status
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
