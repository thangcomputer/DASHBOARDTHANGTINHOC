'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reserveCallParticipants,
  releaseCallParticipants,
  resolveCallEndStatus,
  getCallDurationSeconds,
  findCallRecipientSockets,
} = require('../../utils/callSessionRegistry');

const student = { id: 'student-1', role: 'student' };
const teacher = { id: 'teacher-1', role: 'teacher' };
const otherStudent = { id: 'student-2', role: 'student' };

test('the first competing call reserves both participants and later calls are busy', () => {
  const activeCalls = new Map();
  assert.equal(reserveCallParticipants(activeCalls, 'call-first', student, teacher), true);
  assert.equal(reserveCallParticipants(activeCalls, 'call-second', otherStudent, teacher), false);
  assert.equal(reserveCallParticipants(activeCalls, 'call-third', teacher, otherStudent), false);
  assert.equal(activeCalls.get('teacher:teacher-1'), 'call-first');

  releaseCallParticipants(activeCalls, { callId: 'call-first', caller: student, peer: teacher });
  assert.equal(reserveCallParticipants(activeCalls, 'call-second', otherStudent, teacher), true);
});

test('ringing calls become missed or cancelled, and answered calls become completed', () => {
  assert.equal(resolveCallEndStatus('ringing', false), 'missed');
  assert.equal(resolveCallEndStatus('ringing', true), 'cancelled');
  assert.equal(resolveCallEndStatus('active', true), 'completed');
  assert.equal(getCallDurationSeconds(1000, 12_500), 11);
  assert.equal(getCallDurationSeconds(null, 12_500), 0);
});

test('offline recipients are checked twice with one three-second wait', async () => {
  let checks = 0;
  const waits = [];
  const sockets = await findCallRecipientSockets(
    async () => {
      checks += 1;
      return [];
    },
    async (milliseconds) => { waits.push(milliseconds); },
  );
  assert.deepEqual(sockets, []);
  assert.equal(checks, 2);
  assert.deepEqual(waits, [3_000]);
});

test('an online recipient is delivered on the first check without waiting', async () => {
  let checks = 0;
  const waits = [];
  const onlineSocket = { id: 'socket-1' };
  const sockets = await findCallRecipientSockets(
    async () => {
      checks += 1;
      return [onlineSocket];
    },
    async (milliseconds) => { waits.push(milliseconds); },
  );
  assert.deepEqual(sockets, [onlineSocket]);
  assert.equal(checks, 1);
  assert.deepEqual(waits, []);
});
