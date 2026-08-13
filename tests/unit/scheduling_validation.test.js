'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_STUDENT_SESSIONS_PER_DAY,
  ERROR_CODES,
  timeRangesOverlap,
  dayRange,
  schedulingError,
  resolveEnrollmentForCourse,
} = require('../../services/schedulingValidation');

test('MAX_STUDENT_SESSIONS_PER_DAY is 1 (hard limit)', () => {
  assert.equal(MAX_STUDENT_SESSIONS_PER_DAY, 1);
});

test('ERROR_CODES are stable', () => {
  assert.equal(ERROR_CODES.ENROLLMENT_SESSION_LIMIT_REACHED, 'ENROLLMENT_SESSION_LIMIT_REACHED');
  assert.equal(ERROR_CODES.STUDENT_DAILY_SESSION_LIMIT, 'STUDENT_DAILY_SESSION_LIMIT');
  assert.equal(ERROR_CODES.TEACHER_SCHEDULE_CONFLICT, 'TEACHER_SCHEDULE_CONFLICT');
  assert.equal(ERROR_CODES.ENROLLMENT_COMPLETED, 'ENROLLMENT_COMPLETED');
  assert.equal(ERROR_CODES.ENROLLMENT_NOT_ACTIVE, 'ENROLLMENT_NOT_ACTIVE');
});

test('timeRangesOverlap detects teacher/student conflicts', () => {
  assert.equal(timeRangesOverlap('08:00', '09:30', '09:00', '10:30'), true);
  assert.equal(timeRangesOverlap('08:00', '09:30', '09:30', '11:00'), false);
  assert.equal(timeRangesOverlap('08:00', '09:30', '10:00', '11:30'), false);
});

test('dayRange covers full local day', () => {
  const { start, end } = dayRange('2026-08-15');
  assert.equal(start.getHours(), 0);
  assert.equal(end.getHours(), 23);
  assert.ok(end.getTime() > start.getTime());
});

test('schedulingError carries code + status 409', () => {
  const err = schedulingError(ERROR_CODES.STUDENT_DAILY_SESSION_LIMIT, 'limit', { count: 1 });
  assert.equal(err.code, 'STUDENT_DAILY_SESSION_LIMIT');
  assert.equal(err.status, 409);
  assert.equal(err.extra.count, 1);
});

test('resolveEnrollmentForCourse picks matching course (student isolation)', () => {
  const student = {
    course: 'Excel',
    enrollments: [
      { courseName: 'Word', status: 'active', totalSessions: 12, isPrimary: false },
      { courseName: 'Excel', status: 'active', totalSessions: 12, isPrimary: true },
    ],
  };
  const enr = resolveEnrollmentForCourse(student, 'Excel');
  assert.equal(enr.courseName, 'Excel');
  assert.equal(enr.isPrimary, true);
});
