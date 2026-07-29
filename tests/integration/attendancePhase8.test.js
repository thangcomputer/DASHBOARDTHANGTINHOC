/**
 * Phase 8 — Attendance lifecycle (present/late → completed; absent/excused → no_show).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  scheduleStatusFromAttendance,
  isPayableAttendance,
  canTransitionAttendance,
  assertAttendanceTransition,
  isValidAttendanceStatus,
  ATTENDANCE_STATUSES,
} = require('../../services/attendanceService');

test('present|late → completed (payable)', () => {
  assert.equal(scheduleStatusFromAttendance('present'), 'completed');
  assert.equal(scheduleStatusFromAttendance('late'), 'completed');
  assert.equal(isPayableAttendance('present'), true);
  assert.equal(isPayableAttendance('late'), true);
});

test('absent|excused → no_show (not payable)', () => {
  assert.equal(scheduleStatusFromAttendance('absent'), 'no_show');
  assert.equal(scheduleStatusFromAttendance('excused'), 'no_show');
  assert.equal(isPayableAttendance('absent'), false);
  assert.equal(isPayableAttendance('excused'), false);
});

test('ATTENDANCE_STATUSES has 4 values', () => {
  assert.deepEqual([...ATTENDANCE_STATUSES].sort(), ['absent', 'excused', 'late', 'present']);
});

test('can transition from unmarked to any status', () => {
  for (const s of ATTENDANCE_STATUSES) {
    assert.equal(canTransitionAttendance(null, s), true);
    assert.ok(isValidAttendanceStatus(s));
  }
});

test('can correct present → absent', () => {
  assert.equal(canTransitionAttendance('present', 'absent'), true);
  assert.doesNotThrow(() => assertAttendanceTransition('present', 'absent'));
});

test('rejects invalid attendance status', () => {
  assert.throws(() => assertAttendanceTransition(null, 'maybe'), /không hợp lệ/i);
});

test('Schedule schema has attendance fields', () => {
  const Schedule = require('../../models/Schedule');
  assert.ok(Schedule.schema.paths.attendanceStatus);
  assert.ok(Schedule.schema.paths.attendanceMarkedAt);
  assert.ok(Schedule.schema.paths.attendanceMarkedBy);
  assert.ok(Schedule.schema.paths.attendanceNote);
  const enumVals = Schedule.schema.path('attendanceStatus').enumValues;
  assert.ok(enumVals.includes('present'));
  assert.ok(enumVals.includes('absent'));
  assert.ok(enumVals.includes('late'));
  assert.ok(enumVals.includes('excused'));
});

test('POST attendance route + markAttendance wired', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/scheduleRoutes.js'), 'utf8');
  assert.ok(src.includes("/:scheduleId/attendance"));
  assert.ok(src.includes('markAttendance'));
  assert.ok(src.includes('attendanceService'));
});

test('missed-attendance cron registered in server', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(src.includes('notifyMissedAttendance'));
  assert.ok(src.includes('ATTENDANCE_MISS_CRON'));
});

test('reset-today-attendance writes attendance.reset audit', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes('reset-today-attendance'));
  assert.ok(src.includes('attendance.reset'));
});
