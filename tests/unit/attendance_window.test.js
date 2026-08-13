'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveAttendanceState,
  assertTeacherAttendanceAllowed,
  ATTENDANCE_CODES,
  ATTENDANCE_GRACE_MINUTES,
} = require('../../services/attendanceWindow');

function mkSchedule({ status = 'scheduled', date, startTime, endTime } = {}) {
  return {
    status,
    date: date || new Date(2026, 7, 13),
    startTime: startTime || '13:51',
    endTime: endTime || '15:21',
  };
}

test('grace default is 60 minutes', () => {
  assert.equal(ATTENDANCE_GRACE_MINUTES, 60);
});

test('UPCOMING: before start', () => {
  const now = new Date(2026, 7, 13, 10, 0, 0);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'UPCOMING');
  assert.equal(s.canTeacherAttend, false);
  assert.throws(
    () => assertTeacherAttendanceAllowed(mkSchedule(), { now }),
    (e) => e.code === ATTENDANCE_CODES.WINDOW_NOT_STARTED,
  );
});

test('IN_PROGRESS: teacher can attend', () => {
  const now = new Date(2026, 7, 13, 14, 30, 0);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'IN_PROGRESS');
  assert.equal(s.canTeacherAttend, true);
  assert.doesNotThrow(() => assertTeacherAttendanceAllowed(mkSchedule(), { now }));
});

test('PENDING_ATTENDANCE: within 60m after end', () => {
  const now = new Date(2026, 7, 13, 16, 0, 0); // end 15:21 + 39m
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'PENDING_ATTENDANCE');
  assert.equal(s.canTeacherAttend, true);
  assert.doesNotThrow(() => assertTeacherAttendanceAllowed(mkSchedule(), { now }));
});

test('OVERDUE after end+60m: teacher blocked, admin makeup allowed', () => {
  const now = new Date(2026, 7, 13, 16, 22, 0); // end 15:21 + 61m
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'OVERDUE_ATTENDANCE');
  assert.equal(s.canTeacherAttend, false);
  assert.equal(s.canAdminMakeup, true);
  assert.throws(
    () => assertTeacherAttendanceAllowed(mkSchedule(), { now, lateReason: 'x' }),
    (e) => e.code === ATTENDANCE_CODES.WINDOW_EXPIRED,
  );
});

test('exact endTime still IN_PROGRESS', () => {
  const now = new Date(2026, 7, 13, 15, 21, 0);
  assert.equal(resolveAttendanceState(mkSchedule(), now).state, 'IN_PROGRESS');
});

test('COMPLETED / CANCELLED', () => {
  assert.equal(resolveAttendanceState(mkSchedule({ status: 'completed' })).state, 'COMPLETED');
  assert.equal(resolveAttendanceState(mkSchedule({ status: 'cancelled' })).state, 'CANCELLED');
});
