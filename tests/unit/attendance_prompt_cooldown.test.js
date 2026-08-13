'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const GRACE_MIN = 60;

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function getAttendanceAction(schedule, _a, now = new Date()) {
  const status = String(schedule?.status || '');
  if (status === 'completed') return { state: 'COMPLETED' };
  if (status === 'cancelled' || status === 'no_show') return { state: 'CANCELLED' };
  const d = new Date(schedule.date);
  const startMins = parseTimeToMinutes(schedule.startTime);
  const endMins = parseTimeToMinutes(schedule.endTime);
  const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(startMins / 60), startMins % 60);
  const endAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(endMins / 60), endMins % 60);
  const graceEndAt = new Date(endAt.getTime() + GRACE_MIN * 60 * 1000);
  const t = now.getTime();
  if (t < startAt.getTime()) return { state: 'UPCOMING' };
  if (t <= endAt.getTime()) return { state: 'IN_PROGRESS' };
  if (t <= graceEndAt.getTime()) return { state: 'PENDING_ATTENDANCE' };
  return { state: 'OVERDUE_ATTENDANCE' };
}

function classifyAttendancePrompt({ schedule, canCheckIn, dismissedIds, now = new Date() }) {
  if (!schedule) return null;
  const status = String(schedule.status || '');
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return null;
  const id = String(schedule._id || schedule.id || '');
  if (id && dismissedIds?.has?.(id)) return null;
  if (canCheckIn === false) return null;
  const action = getAttendanceAction(schedule, null, now);
  if (action.state === 'IN_PROGRESS') return 'checkin';
  if (action.state === 'PENDING_ATTENDANCE') return 'late';
  if (action.state === 'OVERDUE_ATTENDANCE') return 'expired';
  return null;
}

function resolveCheckInGate(student) {
  if (!student) return { canCheckIn: true, remainingHours: 0 };
  return {
    canCheckIn: student.can_check_in !== false,
    remainingHours: Number(student.remaining_cooldown_hours) || 0,
  };
}

const baseSch = {
  _id: '1',
  status: 'scheduled',
  date: new Date(2026, 7, 13),
  startTime: '13:51',
  endTime: '15:21',
};

test('cooldown blocks prompt', () => {
  assert.equal(classifyAttendancePrompt({
    schedule: baseSch,
    canCheckIn: false,
    now: new Date(2026, 7, 13, 14, 0, 0),
  }), null);
});

test('IN_PROGRESS → checkin', () => {
  assert.equal(classifyAttendancePrompt({
    schedule: baseSch,
    canCheckIn: true,
    now: new Date(2026, 7, 13, 14, 0, 0),
  }), 'checkin');
});

test('PENDING within 60m → late', () => {
  assert.equal(classifyAttendancePrompt({
    schedule: baseSch,
    canCheckIn: true,
    now: new Date(2026, 7, 13, 16, 0, 0),
  }), 'late');
});

test('OVERDUE after 60m → expired', () => {
  assert.equal(classifyAttendancePrompt({
    schedule: baseSch,
    canCheckIn: true,
    now: new Date(2026, 7, 13, 16, 22, 0),
  }), 'expired');
});

test('completed / cancelled → null', () => {
  assert.equal(classifyAttendancePrompt({
    schedule: { ...baseSch, status: 'completed' },
    canCheckIn: true,
    now: new Date(2026, 7, 13, 16, 0, 0),
  }), null);
});

test('gate enrollment cooldown', () => {
  const gate = resolveCheckInGate({ can_check_in: false, remaining_cooldown_hours: 2 });
  assert.equal(gate.canCheckIn, false);
});
