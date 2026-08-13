'use strict';

/**
 * Shared scheduling business rules (student-scoped).
 * Backend SoT — do not trust FE progress/status.
 *
 * RULE A: MAX_STUDENT_SESSIONS_PER_DAY per studentId+date (not teacherId).
 * RULE B: enrollment used sessions (scheduled+completed) < totalSessions; status active.
 * Teacher conflict is independent (time overlap on teacherId+date).
 */

const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const { getEnrollmentsFromStudent, normCourseName } = require('./enrollmentService');

/** Hard limit: mỗi học viên tối đa 1 ca / ngày */
const MAX_STUDENT_SESSIONS_PER_DAY = 1;

/** Statuses that reserve/consume a session toward enrollment totalSessions */
const SESSION_USAGE_STATUSES = ['scheduled', 'completed'];

/** Statuses that occupy a calendar slot (daily / teacher clash) */
const SLOT_OCCUPYING_STATUSES = ['scheduled', 'completed', 'no_show'];

const SESSION_DURATION_MINS = 90;

const ERROR_CODES = {
  ENROLLMENT_NOT_ACTIVE: 'ENROLLMENT_NOT_ACTIVE',
  ENROLLMENT_COMPLETED: 'ENROLLMENT_COMPLETED',
  ENROLLMENT_SESSION_LIMIT_REACHED: 'ENROLLMENT_SESSION_LIMIT_REACHED',
  STUDENT_DAILY_SESSION_LIMIT: 'STUDENT_DAILY_SESSION_LIMIT',
  TEACHER_SCHEDULE_CONFLICT: 'TEACHER_SCHEDULE_CONFLICT',
  ENROLLMENT_NOT_FOUND: 'ENROLLMENT_NOT_FOUND',
  SCHEDULE_DATE_PAST: 'SCHEDULE_DATE_PAST',
};

function schedulingError(code, message, extra = {}) {
  const err = new Error(message);
  err.status = 409;
  err.code = code;
  err.extra = extra;
  return err;
}

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function timeRangesOverlap(start1, end1, start2, end2) {
  const s1 = parseTimeToMinutes(start1);
  const s2 = parseTimeToMinutes(start2);
  if (s1 == null || s2 == null) return false;
  const e1 = parseTimeToMinutes(end1) ?? (s1 + SESSION_DURATION_MINS);
  const e2 = parseTimeToMinutes(end2) ?? (s2 + SESSION_DURATION_MINS);
  return s1 < e2 && s2 < e1;
}

function dayRange(dateInput) {
  const d = new Date(dateInput);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function resolveEnrollmentForCourse(studentDoc, courseName) {
  const list = getEnrollmentsFromStudent(studentDoc);
  const key = normCourseName(courseName);
  if (!list.length) return null;
  if (!key) return list.find((e) => e.isPrimary) || list[0];
  return list.find((e) => normCourseName(e.courseName || e.course) === key) || null;
}

/**
 * Count sessions that consume enrollment capacity for student+course.
 * cancelled does NOT count. scheduled + completed count.
 */
async function getEnrollmentSessionUsage({ studentId, courseName, excludeScheduleId } = {}) {
  const course = String(courseName || '').trim();
  const filter = {
    studentId,
    status: { $in: SESSION_USAGE_STATUSES },
  };
  if (course) filter.course = course;
  if (excludeScheduleId) filter._id = { $ne: excludeScheduleId };
  const used = await Schedule.countDocuments(filter);
  return { used, statuses: SESSION_USAGE_STATUSES };
}

async function countStudentSessionsOnDate({ studentId, date, excludeScheduleId } = {}) {
  const { start, end } = dayRange(date);
  const filter = {
    studentId,
    date: { $gte: start, $lte: end },
    status: { $in: SLOT_OCCUPYING_STATUSES },
  };
  if (excludeScheduleId) filter._id = { $ne: excludeScheduleId };
  return Schedule.countDocuments(filter);
}

async function findTeacherScheduleClash({
  teacherId, date, startTime, endTime, excludeScheduleId,
} = {}) {
  const { start, end } = dayRange(date);
  const filter = {
    teacherId,
    date: { $gte: start, $lte: end },
    status: { $in: SLOT_OCCUPYING_STATUSES },
  };
  if (excludeScheduleId) filter._id = { $ne: excludeScheduleId };
  const existing = await Schedule.find(filter)
    .select('startTime endTime studentName course studentId')
    .lean();
  return existing.find((ex) => timeRangesOverlap(startTime, endTime, ex.startTime, ex.endTime)) || null;
}

/**
 * Assert enrollment can accept a new (or additional) schedule slot.
 * Loads student from DB — never trusts FE counters.
 */
async function assertEnrollmentCanSchedule({ studentId, courseName, excludeScheduleId } = {}) {
  const student = await Student.findById(studentId)
    .select('name course totalSessions remainingSessions completedSessions enrollments status')
    .lean();
  if (!student) {
    throw schedulingError(ERROR_CODES.ENROLLMENT_NOT_FOUND, 'Không tìm thấy học viên', {});
  }

  const enr = resolveEnrollmentForCourse(student, courseName);
  if (!enr) {
    throw schedulingError(
      ERROR_CODES.ENROLLMENT_NOT_FOUND,
      `Không tìm thấy khóa học "${courseName || ''}" của học viên`,
      {},
    );
  }

  const status = String(enr.status || 'active');
  const totalSessions = Number(enr.totalSessions) > 0 ? Number(enr.totalSessions) : 12;
  const courseKey = enr.courseName || courseName || student.course || '';

  if (status === 'completed') {
    throw schedulingError(
      ERROR_CODES.ENROLLMENT_COMPLETED,
      `Khóa học đã hoàn thành đủ ${totalSessions}/${totalSessions} buổi, không thể xếp thêm lịch.`,
      { totalSessions, used: totalSessions, course: courseKey },
    );
  }

  if (status !== 'active') {
    throw schedulingError(
      ERROR_CODES.ENROLLMENT_NOT_ACTIVE,
      `Khóa học đang ở trạng thái "${status}", không thể xếp lịch.`,
      { status, course: courseKey },
    );
  }

  const { used } = await getEnrollmentSessionUsage({
    studentId,
    courseName: courseKey,
    excludeScheduleId,
  });

  if (used >= totalSessions) {
    throw schedulingError(
      ERROR_CODES.ENROLLMENT_SESSION_LIMIT_REACHED,
      `Khóa học đã hoàn thành đủ ${totalSessions}/${totalSessions} buổi, không thể xếp thêm lịch.`,
      { totalSessions, used, course: courseKey },
    );
  }

  return {
    student,
    enrollment: enr,
    totalSessions,
    used,
    remaining: Math.max(0, totalSessions - used),
    course: courseKey,
  };
}

async function assertStudentDailyLimit({ studentId, date, excludeScheduleId } = {}) {
  const count = await countStudentSessionsOnDate({ studentId, date, excludeScheduleId });
  if (count >= MAX_STUDENT_SESSIONS_PER_DAY) {
    const d = new Date(date);
    const label = Number.isNaN(d.getTime())
      ? String(date)
      : d.toLocaleDateString('vi-VN');
    throw schedulingError(
      ERROR_CODES.STUDENT_DAILY_SESSION_LIMIT,
      `Học viên đã có đủ số ca học trong ngày này (${label}).`,
      { count, max: MAX_STUDENT_SESSIONS_PER_DAY, date: label },
    );
  }
  return { count, max: MAX_STUDENT_SESSIONS_PER_DAY };
}

async function assertTeacherNoConflict({
  teacherId, date, startTime, endTime, excludeScheduleId,
} = {}) {
  const clash = await findTeacherScheduleClash({
    teacherId, date, startTime, endTime, excludeScheduleId,
  });
  if (clash) {
    const end = clash.endTime ? ` - ${clash.endTime}` : '';
    throw schedulingError(
      ERROR_CODES.TEACHER_SCHEDULE_CONFLICT,
      `Giáo viên đã có lịch trùng thời gian này (${clash.startTime}${end}`
        + (clash.studentName ? `, HV: ${clash.studentName}` : '') + ').',
      { clash },
    );
  }
  return null;
}

/** Không cho xếp/sửa lịch về ngày trước hôm nay (local). */
function assertScheduleDateNotPast(dateInput) {
  const { start } = dayRange(dateInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start.getTime() < today.getTime()) {
    throw schedulingError(
      ERROR_CODES.SCHEDULE_DATE_PAST,
      'Không thể xếp hoặc sửa lịch cho ngày đã qua.',
      {},
    );
  }
}

/**
 * Full CREATE validation (student enrollment + daily + teacher conflict).
 * Usage re-check still applies if moving would somehow add capacity (normally same slot).
 */
async function validateScheduleCreate(opts = {}) {
  const {
    studentId, teacherId, courseName, date, startTime, endTime,
  } = opts;

  assertScheduleDateNotPast(date);

  const enrollmentInfo = await assertEnrollmentCanSchedule({
    studentId,
    courseName,
  });

  await assertStudentDailyLimit({ studentId, date });

  if (teacherId) {
    await assertTeacherNoConflict({
      teacherId, date, startTime, endTime,
    });
  }

  return enrollmentInfo;
}

/**
 * RESCHEDULE: exclude current schedule from daily + teacher + usage counts.
 * Usage re-check still applies if moving would somehow add capacity (normally same slot).
 */
async function validateScheduleReschedule(opts = {}) {
  const {
    studentId, teacherId, courseName, date, startTime, endTime, excludeScheduleId,
    originalDate,
  } = opts;

  if (originalDate != null) assertScheduleDateNotPast(originalDate);
  assertScheduleDateNotPast(date);

  // Enrollment cap: exclude self so editing alone does not trip limit
  await assertEnrollmentCanSchedule({
    studentId,
    courseName,
    excludeScheduleId,
  });

  await assertStudentDailyLimit({
    studentId,
    date,
    excludeScheduleId,
  });

  if (teacherId) {
    await assertTeacherNoConflict({
      teacherId, date, startTime, endTime, excludeScheduleId,
    });
  }
}

function sendSchedulingError(res, err) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 409;
  return res.status(status).json({
    success: false,
    code: err.code || 'SCHEDULING_ERROR',
    message: err.message || 'Không thể xếp lịch',
    ...(err.extra || {}),
  });
}

module.exports = {
  MAX_STUDENT_SESSIONS_PER_DAY,
  SESSION_USAGE_STATUSES,
  SLOT_OCCUPYING_STATUSES,
  ERROR_CODES,
  schedulingError,
  dayRange,
  timeRangesOverlap,
  getEnrollmentSessionUsage,
  countStudentSessionsOnDate,
  resolveEnrollmentForCourse,
  assertEnrollmentCanSchedule,
  assertStudentDailyLimit,
  assertTeacherNoConflict,
  findTeacherScheduleClash,
  validateScheduleCreate,
  validateScheduleReschedule,
  assertScheduleDateNotPast,
  sendSchedulingError,
};
