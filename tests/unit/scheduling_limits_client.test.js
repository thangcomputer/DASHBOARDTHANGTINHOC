'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Mirror client/src/utils/schedulingLimits.js — keep in sync

const MAX_STUDENT_SESSIONS_PER_DAY = 1;
const SLOT_OCCUPYING = new Set(['scheduled', 'completed', 'no_show']);
const USAGE_STATUSES = new Set(['scheduled', 'completed']);

function normCourse(name) {
  return String(name || '').trim().toLowerCase();
}

function localDateKey(raw) {
  if (!raw) return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countStudentSessionsOnDate(schedules, studentId, date, excludeScheduleId) {
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

function countEnrollmentUsage(schedules, studentId, courseName, excludeScheduleId) {
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

function getStudentScheduleGate(student, schedules, date, excludeScheduleId) {
  const studentId = String(student?._id || student?.id || '');
  const course = student?.course || '';
  const totalSessions = Number(student?.totalSessions) > 0 ? Number(student.totalSessions) : 12;
  const used = countEnrollmentUsage(schedules, studentId, course, excludeScheduleId);
  const remaining = Math.max(0, totalSessions - used);
  const todayCount = countStudentSessionsOnDate(schedules, studentId, date, excludeScheduleId);
  const enrStatus = String(student?.status || 'active');
  const completedLike = enrStatus === 'completed' || enrStatus === 'Hoàn thành' || used >= totalSessions;
  const dailyFull = todayCount >= MAX_STUDENT_SESSIONS_PER_DAY;
  let canSchedule = true;
  let reason = '';
  if (completedLike) {
    canSchedule = false;
    reason = `Đã hoàn thành ${totalSessions}/${totalSessions} buổi`;
  } else if (dailyFull) {
    canSchedule = false;
    reason = `Đã đủ ${MAX_STUDENT_SESSIONS_PER_DAY} ca trong ngày`;
  }
  return { used, remaining, totalSessions, todayCount, canSchedule, reason };
}

const DAY = '2026-08-15';

test('TEST1: 0/12 → can schedule', () => {
  const g = getStudentScheduleGate({ _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' }, [], DAY);
  assert.equal(g.used, 0);
  assert.equal(g.canSchedule, true);
});

test('TEST3: 12/12 usage → reject', () => {
  const schedules = Array.from({ length: 12 }, (_, i) => ({
    _id: `s${i}`,
    studentId: 'A',
    course: 'Excel',
    status: i < 11 ? 'completed' : 'scheduled',
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
  }));
  const g = getStudentScheduleGate({ _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' }, schedules, DAY);
  assert.equal(g.used, 12);
  assert.equal(g.canSchedule, false);
});

test('TEST5: HV1 already has 1 session on day → daily reject', () => {
  const schedules = [{
    _id: '1', studentId: 'A', course: 'Excel', status: 'scheduled', date: DAY, startTime: '08:00', endTime: '09:30',
  }];
  const g = getStudentScheduleGate({ _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' }, schedules, DAY);
  assert.equal(g.todayCount, 1);
  assert.equal(g.canSchedule, false);
  assert.match(g.reason, /ca trong ngày/);
});

test('TEST6: HV2 same day different student → PASS', () => {
  const schedules = [{
    _id: '1', studentId: 'A', course: 'Excel', status: 'scheduled', date: DAY, startTime: '08:00',
  }];
  const g = getStudentScheduleGate({ _id: 'B', course: 'Word', totalSessions: 12, status: 'active' }, schedules, DAY);
  assert.equal(g.todayCount, 0);
  assert.equal(g.canSchedule, true);
});

test('TEST7: Teacher multi-HV same day — each student isolated', () => {
  const schedules = [
    { _id: '1', studentId: 'A', course: 'Excel', status: 'scheduled', date: DAY },
    { _id: '2', studentId: 'B', course: 'Word', status: 'scheduled', date: DAY },
  ];
  const gA = getStudentScheduleGate({ _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' }, schedules, DAY);
  const gC = getStudentScheduleGate({ _id: 'C', course: 'PPT', totalSessions: 12, status: 'active' }, schedules, DAY);
  assert.equal(gA.canSchedule, false);
  assert.equal(gC.canSchedule, true);
});

test('TEST9: cancelled does not consume daily slot', () => {
  const schedules = [{
    _id: '1', studentId: 'A', course: 'Excel', status: 'cancelled', date: DAY,
  }];
  const g = getStudentScheduleGate({ _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' }, schedules, DAY);
  assert.equal(g.todayCount, 0);
  assert.equal(g.canSchedule, true);
});

test('TEST10: reschedule exclude self — not counted as second session', () => {
  const schedules = [{
    _id: 'self', studentId: 'A', course: 'Excel', status: 'scheduled', date: DAY,
  }];
  const g = getStudentScheduleGate(
    { _id: 'A', course: 'Excel', totalSessions: 12, status: 'active' },
    schedules,
    DAY,
    'self',
  );
  assert.equal(g.todayCount, 0);
  assert.equal(g.canSchedule, true);
});

test('cancelled does not count toward enrollment usage', () => {
  const schedules = [
    { _id: '1', studentId: 'A', course: 'Excel', status: 'cancelled', date: DAY },
    { _id: '2', studentId: 'A', course: 'Excel', status: 'completed', date: '2026-08-01' },
  ];
  assert.equal(countEnrollmentUsage(schedules, 'A', 'Excel'), 1);
});
