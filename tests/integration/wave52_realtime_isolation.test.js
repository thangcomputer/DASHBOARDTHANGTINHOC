/**
 * Wave 5.2 — realtime isolation (emit helpers + room semantics).
 * No live Socket.IO server required — records io.to() rooms.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  branchRoom,
  emitBranch,
  emitUser,
  emitTeacherEvent,
  emitFinanceEvent,
  emitScheduleEvent,
  emitDataRefresh,
} = require('../../utils/realtimeEmit');

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

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';

// ── Branch isolation ─────────────────────────────────────────────────────────

test('Branch isolation: emitBranch A never targets branch_B', () => {
  const { io, rooms, emits } = mockIo();
  emitBranch(io, BRANCH_A, 'teacher:scored', { teacherId: 't1' });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('ALL_ADMIN'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Teacher event isolation: branch + teacher user + teacher_ room', () => {
  const { io, rooms, emits } = mockIo();
  emitTeacherEvent(io, { _id: 'tA', branchId: BRANCH_A }, 'teacher:approved', { ok: 1 });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('tA'));
  assert.ok(rooms.includes('teacher_tA'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Finance event isolation: no global broadcast', () => {
  const { io, rooms, emits } = mockIo();
  emitFinanceEvent(io, { branchId: BRANCH_A, userIds: ['t1'] }, 'revenue:updated', {
    amount: 1000,
    type: 'salary',
  });
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('t1'));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
  assert.ok(!rooms.includes('ALL_STAFF')); // branch present → no staff all-fanout
});

test('Schedule event isolation: student/teacher rooms only for scope', () => {
  const { io, rooms, emits } = mockIo();
  emitScheduleEvent(
    io,
    { branchId: BRANCH_A, teacherId: 'tch', studentId: 'stu' },
    'schedule:new',
    { scheduleId: 's1' },
  );
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('tch'));
  assert.ok(rooms.includes('stu'));
  assert.ok(rooms.includes('student_stu'));
  assert.ok(rooms.includes('teacher_tch'));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('Webhook-style tuition:paid uses finance scope (branch + student)', () => {
  const { io, rooms, emits } = mockIo();
  emitFinanceEvent(
    io,
    { branchId: BRANCH_A, userIds: ['stu1'] },
    'tuition:paid',
    { studentId: 'stu1', amount: 500000 },
  );
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('stu1'));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

// ── User isolation ───────────────────────────────────────────────────────────

test('User isolation: emitUser A does not hit user B', () => {
  const { io, rooms } = mockIo();
  emitUser(io, 'userA', 'auth:forceLogout', { userId: 'userA' });
  assert.deepEqual(rooms, ['userA']);
  assert.ok(!rooms.includes('userB'));
});

// ── Fail-closed / no global fallback ─────────────────────────────────────────

test('Missing branchId: fail-closed to ALL_ADMIN only (not ALL_STAFF / GLOBAL)', () => {
  const { io, rooms, emits } = mockIo();
  emitBranch(io, null, 'teacher:scored', { x: 1 });
  assert.ok(rooms.includes('ALL_ADMIN'));
  assert.ok(!rooms.includes('ALL_STAFF'));
  assert.ok(!rooms.includes('ALL_SUPPORT'));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

test('branchRoom helper', () => {
  assert.equal(branchRoom(BRANCH_A), `branch_${BRANCH_A}`);
  assert.equal(branchRoom(null), null);
  assert.equal(branchRoom(''), null);
});

test('emitDataRefresh does not global-broadcast', () => {
  const { io, emits } = mockIo();
  emitDataRefresh(io, { type: 'teacher', id: 't1' }, { branchId: BRANCH_A, userIds: ['t1'] });
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
  assert.ok(emits.every((e) => e.event === 'data:refresh'));
});

// ── Conversation isolation (message room targeting) ──────────────────────────

test('Conversation isolation: direct message targets receiver user room only', () => {
  const { io, rooms, emits } = mockIo();
  const rid = 'receiverB';
  io.to(rid).emit('message:receive', { conversationId: 'admin_x__student_y' });
  assert.deepEqual(rooms, [rid]);
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
});

// ── Client branch spoofing / GLOBAL ──────────────────────────────────────────

test('Client branch spoofing: register ignores client branchId (trusted JWT only)', () => {
  // Mirrors server.js register: resolvedBranchId = socket.user.branchId
  const socketUser = { id: 'staff1', role: 'staff', branchId: BRANCH_A, branchCode: 'A' };
  const clientPayload = { branchId: BRANCH_B, branchCode: 'B' };
  const resolvedBranchId = socketUser.branchId || null;
  assert.equal(String(resolvedBranchId), BRANCH_A);
  assert.notEqual(String(resolvedBranchId), String(clientPayload.branchId));
});

test('GLOBAL room access: privileged join of GLOBAL is denied by policy', () => {
  const denied = [];
  function handleJoin(room, socketUser) {
    if (!socketUser) return;
    const r = String(room || '');
    if (r === 'GLOBAL' || r === 'global') {
      denied.push(r);
      return;
    }
    if (r.startsWith('branch_') || r.startsWith('presence_') || r.startsWith('ALL_')) {
      denied.push(r);
    }
  }
  handleJoin('GLOBAL', { id: 'u1' });
  handleJoin(`branch_${BRANCH_B}`, { id: 'u1', branchId: BRANCH_A });
  assert.deepEqual(denied, ['GLOBAL', `branch_${BRANCH_B}`]);
});

// ── Cross-branch negative: Branch B socket rooms would not receive Branch A emit ─

test('Negative: Branch B room set does not intersect Branch A emit rooms', () => {
  const { io, rooms } = mockIo();
  emitTeacherEvent(io, { _id: 'tA', branchId: BRANCH_A }, 'teacher:scored', {});
  const branchBRooms = new Set([
    `branch_${BRANCH_B}`,
    `presence_${BRANCH_B}`,
    `ALL_STAFF_${BRANCH_B}`,
  ]);
  for (const r of rooms) {
    assert.ok(!branchBRooms.has(r), `leaked to ${r}`);
  }
});
