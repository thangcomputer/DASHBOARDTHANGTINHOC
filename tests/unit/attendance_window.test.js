'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveAttendanceState,
  assertTeacherAttendanceAllowed,
  ATTENDANCE_CODES,
  ATTENDANCE_GRACE_MINUTES,
} = require('../../services/attendanceWindow');

/** 13/08/2026 at hh:mm Vietnam time, independent of the machine time zone. */
function vn(hours, minutes) {
  return new Date(Date.UTC(2026, 7, 13, hours - 7, minutes, 0));
}

function mkSchedule({ status = 'scheduled', date, startTime, endTime } = {}) {
  return {
    status,
    date: date || vn(0, 0),
    startTime: startTime || '13:51',
    endTime: endTime || '15:21',
  };
}

test('grace default is 60 minutes', () => {
  assert.equal(ATTENDANCE_GRACE_MINUTES, 60);
});

test('UPCOMING: before start', () => {
  const now = vn(10, 0);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'UPCOMING');
  assert.equal(s.canTeacherAttend, false);
  assert.throws(
    () => assertTeacherAttendanceAllowed(mkSchedule(), { now }),
    (e) => e.code === ATTENDANCE_CODES.WINDOW_NOT_STARTED,
  );
});

test('UPCOMING: at class start, teacher cannot attend yet (15 phút delay)', () => {
  const now = vn(13, 51);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'UPCOMING');
  assert.equal(s.canTeacherAttend, false);
  assert.throws(
    () => assertTeacherAttendanceAllowed(mkSchedule(), { now }),
    (e) => e.code === ATTENDANCE_CODES.WINDOW_NOT_STARTED,
  );
});

test('UPCOMING: 14 phút after start still blocked', () => {
  const now = vn(14, 5);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'UPCOMING');
  assert.equal(s.canTeacherAttend, false);
});

test('IN_PROGRESS: 15 phút after start, teacher can attend', () => {
  const now = vn(14, 6);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'IN_PROGRESS');
  assert.equal(s.canTeacherAttend, true);
  assert.doesNotThrow(() => assertTeacherAttendanceAllowed(mkSchedule(), { now }));
});

test('IN_PROGRESS: teacher can attend', () => {
  const now = vn(14, 30);
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'IN_PROGRESS');
  assert.equal(s.canTeacherAttend, true);
  assert.doesNotThrow(() => assertTeacherAttendanceAllowed(mkSchedule(), { now }));
});

test('PENDING_ATTENDANCE: within 60m after end', () => {
  const now = vn(16, 0); // end 15:21 + 39m
  const s = resolveAttendanceState(mkSchedule(), now);
  assert.equal(s.state, 'PENDING_ATTENDANCE');
  assert.equal(s.canTeacherAttend, true);
  assert.doesNotThrow(() => assertTeacherAttendanceAllowed(mkSchedule(), { now }));
});

test('OVERDUE after end+60m: teacher blocked, admin makeup allowed', () => {
  const now = vn(16, 22); // end 15:21 + 61m
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
  const now = vn(15, 21);
  assert.equal(resolveAttendanceState(mkSchedule(), now).state, 'IN_PROGRESS');
});

test('HV chưa xác nhận không hết hạn trước hạn điểm danh bù (end+60m)', () => {
  // Ca học 13:51–15:21 -> hạn chót (end+60m) = 16:21.
  // GV điểm danh lúc 14:30: 15:31 vẫn trong hạn (chưa quá 16:21), sau 16:21 mới thành điểm danh bù.
  const requestedEarly = vn(14, 30);
  const scheduleEarly = {
    ...mkSchedule(),
    studentConfirmStatus: 'pending',
    studentConfirmRequestedAt: requestedEarly,
  };
  const waiting1 = resolveAttendanceState(scheduleEarly, vn(15, 0));
  assert.equal(waiting1.state, 'AWAITING_STUDENT_CONFIRM');
  assert.equal(waiting1.canAdminMakeup, false);
  const waiting2 = resolveAttendanceState(scheduleEarly, vn(15, 31));
  assert.equal(waiting2.state, 'AWAITING_STUDENT_CONFIRM');
  assert.equal(waiting2.canAdminMakeup, false);
  const expiredAfterGrace = resolveAttendanceState(scheduleEarly, vn(16, 22));
  assert.equal(expiredAfterGrace.state, 'STUDENT_CONFIRM_EXPIRED');
  assert.equal(expiredAfterGrace.canTeacherAttend, false);
  assert.equal(expiredAfterGrace.canAdminMakeup, true);

  // Ngay cả khi DB đã bị gắn confirm_expired sớm trước hạn end+60m, vẫn phải giữ AWAITING_STUDENT_CONFIRM.
  const prematurelyMarked = { ...scheduleEarly, studentConfirmStatus: 'confirm_expired' };
  assert.equal(resolveAttendanceState(prematurelyMarked, vn(15, 31)).state, 'AWAITING_STUDENT_CONFIRM');

  // GV điểm danh trong grace window (15:50): HV vẫn có đủ 60 phút tới 16:50.
  const requestedLate = vn(15, 50);
  const scheduleLate = {
    ...mkSchedule(),
    studentConfirmStatus: 'pending',
    studentConfirmRequestedAt: requestedLate,
  };
  assert.equal(resolveAttendanceState(scheduleLate, vn(16, 30)).state, 'AWAITING_STUDENT_CONFIRM');
  assert.equal(resolveAttendanceState(scheduleLate, vn(16, 51)).state, 'STUDENT_CONFIRM_EXPIRED');
});

test('COMPLETED / CANCELLED', () => {
  assert.equal(resolveAttendanceState(mkSchedule({ status: 'completed' })).state, 'COMPLETED');
  assert.equal(resolveAttendanceState(mkSchedule({ status: 'cancelled' })).state, 'CANCELLED');
});

test('Nhật ký giảng dạy opens AttendanceMakeupRequestModal inline for both overdue_attendance and makeup_attendance', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const scheduleTab = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/teacher/TeacherScheduleTab.jsx'),
    'utf8',
  );
  const teachingLog = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/teacher/TeacherTeachingLog.jsx'),
    'utf8',
  );

  assert.ok(
    scheduleTab.includes("kind !== 'overdue_attendance' && kind !== 'makeup_attendance'"),
    'TeacherScheduleTab handles both overdue_attendance and makeup_attendance with inline modal instead of navigating away',
  );
  assert.ok(scheduleTab.includes('setMakeupTarget({ schedule: sch, student })'));
  assert.ok(
    teachingLog.includes("kind === 'overdue_attendance' || kind === 'makeup_attendance'")
    && teachingLog.includes('<AttendanceMakeupRequestModal'),
    'TeacherTeachingLog provides built-in AttendanceMakeupRequestModal fallback for direct Điểm danh bù',
  );
});
