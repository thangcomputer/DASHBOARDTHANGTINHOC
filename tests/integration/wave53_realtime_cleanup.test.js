/**
 * Wave 5.3 — remaining data:refresh / SYSTEM_RESET scoping.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  emitSystemWide,
  emitDataRefresh,
  AUTHENTICATED_ROLE_ROOMS,
} = require('../../utils/realtimeEmit');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';

function mockIo() {
  const rooms = [];
  const emits = [];
  const io = {
    to(room) {
      rooms.push(String(room));
      return {
        emit(event, payload) {
          emits.push({ room: String(room), event, payload });
        },
        to(next) {
          rooms.push(String(next));
          return this;
        },
      };
    },
    emit(event, payload) {
      emits.push({ room: '*GLOBAL*', event, payload });
    },
  };
  return { io, rooms, emits };
}

test('Settings refresh: system-wide role rooms, never *GLOBAL*, no secrets in payload', () => {
  const { io, rooms, emits } = mockIo();
  emitSystemWide(io, 'data:refresh', { type: 'settings', scope: 'system' });
  for (const r of AUTHENTICATED_ROLE_ROOMS) {
    assert.ok(rooms.includes(r), `missing ${r}`);
  }
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(emits.every((e) => e.payload?.type === 'settings'));
  assert.ok(emits.every((e) => !('trainingRawData' in (e.payload || {}))));
});

test('SYSTEM_RESET: authenticated role rooms only (intentional system-wide)', () => {
  const { io, rooms, emits } = mockIo();
  emitSystemWide(io, 'SYSTEM_RESET', {});
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
  assert.ok(emits.every((e) => e.event === 'SYSTEM_RESET'));
  assert.ok(rooms.includes('ALL_ADMIN'));
  assert.ok(rooms.includes('ALL_STUDENT'));
});

test('Exam result refresh: Branch A student → Branch B room not targeted', () => {
  const { io, rooms, emits } = mockIo();
  emitDataRefresh(io, { type: 'examResult', id: 'er1' }, {
    branchId: BRANCH_A,
    userIds: ['stuA', 'tchA'],
  });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('stuA'));
  assert.ok(rooms.includes('tchA'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Exam result user isolation: User A refresh does not hit User B room', () => {
  const { io, rooms } = mockIo();
  emitDataRefresh(io, { type: 'examResult', id: 'er1' }, {
    branchId: null,
    userIds: ['userA'],
  });
  assert.ok(rooms.includes('userA'));
  assert.ok(!rooms.includes('userB'));
  // missing branch → fail-closed ALL_ADMIN only (not ALL_STAFF)
  assert.ok(rooms.includes('ALL_ADMIN'));
  assert.ok(!rooms.includes('ALL_STAFF'));
});

test('Evaluation refresh: Branch A teacher → Branch B does not receive', () => {
  const { io, rooms, emits } = mockIo();
  emitDataRefresh(io, { type: 'evaluation', targetId: 'tA' }, {
    branchId: BRANCH_A,
    userIds: ['tA', 'stu1'],
  });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Assignment/submission refresh: unauthorized branch B excluded', () => {
  const { io, rooms, emits } = mockIo();
  emitDataRefresh(io, { type: 'submission', action: 'create' }, {
    branchId: BRANCH_A,
    userIds: ['stuA', 'tchA'],
  });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('stuA'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Unauthorized recipient: sensitive exam payload never uses global emit', () => {
  const { io, emits } = mockIo();
  emitDataRefresh(io, { type: 'examResult', id: 'secret' }, {
    branchId: BRANCH_A,
    userIds: ['owner'],
  });
  assert.equal(emits.filter((e) => e.room === '*GLOBAL*').length, 0);
});
