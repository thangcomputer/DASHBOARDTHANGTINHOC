/**
 * Wave 5.4 — exam/assignment DTO + branch authz + CQRS teacher emit.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  pickExamResultCreate,
  pickExamResultUpdate,
} = require('../../utils/examResultDto');
const {
  pickAssignmentCreate,
  pickAssignmentUpdate,
} = require('../../utils/assignmentDto');
const { emitTeacherEvent } = require('../../utils/realtimeEmit');

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
      };
    },
    emit(event, payload) {
      emits.push({ room: '*GLOBAL*', event, payload });
    },
  };
  return { io, rooms, emits };
}

// ── Exam DTO / mass assignment ───────────────────────────────────────────────

test('Exam create DTO strips protected / spoof fields', () => {
  const picked = pickExamResultCreate({
    type: 'student',
    studentId: 's1',
    subject: 'Word',
    passed: true,
    branchId: BRANCH_B,
    tenantId: 'tenant-x',
    scoreHistory: [{ hack: true }],
    _id: 'injected',
    createdBy: 'attacker',
    approvedBy: 'attacker',
    status: 'approved',
    createdAt: new Date('2000-01-01'),
  });
  assert.equal(picked.studentId, 's1');
  assert.equal(picked.subject, 'Word');
  assert.equal(picked.branchId, undefined);
  assert.equal(picked.tenantId, undefined);
  assert.equal(picked.scoreHistory, undefined);
  assert.equal(picked._id, undefined);
  assert.equal(picked.createdBy, undefined);
  assert.equal(picked.approvedBy, undefined);
  assert.equal(picked.status, undefined);
  assert.equal(picked.createdAt, undefined);
});

test('Exam update DTO cannot change studentId/teacherId/type', () => {
  const picked = pickExamResultUpdate({
    studentId: 'hijack',
    teacherId: 'hijack',
    type: 'teacher',
    essayScore: 90,
    passed: true,
    branchId: BRANCH_B,
    scoreHistory: [],
  });
  assert.equal(picked.essayScore, 90);
  assert.equal(picked.passed, true);
  assert.equal(picked.studentId, undefined);
  assert.equal(picked.teacherId, undefined);
  assert.equal(picked.type, undefined);
  assert.equal(picked.branchId, undefined);
  assert.equal(picked.scoreHistory, undefined);
});

test('Exam branchAllows: Branch A vs Branch B → DENY', () => {
  const { branchAllows } = require('../../routes/examResultRoutes')._test;
  const deny = branchAllows({ userBranchId: BRANCH_A }, BRANCH_B);
  assert.equal(deny.ok, false);
  assert.equal(deny.status, 403);
  const allow = branchAllows({ userBranchId: BRANCH_A }, BRANCH_A);
  assert.equal(allow.ok, true);
  const superOk = branchAllows({ userBranchId: null }, BRANCH_B);
  assert.equal(superOk.ok, true);
});

test('Exam branchAllows: missing subject branch → DENY for branch-bound', () => {
  const { branchAllows } = require('../../routes/examResultRoutes')._test;
  const deny = branchAllows({ userBranchId: BRANCH_A }, null);
  assert.equal(deny.ok, false);
  assert.equal(deny.status, 403);
});

// ── Assignment DTO ───────────────────────────────────────────────────────────

test('Assignment create DTO strips assignedBy / branch / tenant spoof', () => {
  const picked = pickAssignmentCreate({
    courseId: 'Word',
    title: 'BT1',
    deadline: new Date(),
    studentId: '507f1f77bcf86cd799439011',
    assignedById: 'attacker',
    assignedByRole: 'admin',
    assignedByName: 'Hacker',
    branchId: BRANCH_B,
    tenantId: 't1',
    grading: { score: 10 },
  });
  assert.equal(picked.courseId, 'Word');
  assert.equal(picked.title, 'BT1');
  assert.equal(picked.assignedById, undefined);
  assert.equal(picked.assignedByRole, undefined);
  assert.equal(picked.branchId, undefined);
  assert.equal(picked.tenantId, undefined);
  assert.equal(picked.grading, undefined);
});

test('Assignment update DTO does not include attribution fields', () => {
  const picked = pickAssignmentUpdate({
    title: 'New',
    assignedById: 'x',
    assignedByRole: 'admin',
    branchId: BRANCH_B,
    status: 'closed',
  });
  assert.equal(picked.title, 'New');
  assert.equal(picked.status, 'closed');
  assert.equal(picked.assignedById, undefined);
  assert.equal(picked.branchId, undefined);
});

// ── CQRS teacher realtime ────────────────────────────────────────────────────

test('CQRS teacher:new path uses emitTeacherEvent — no *GLOBAL*', () => {
  const { io, rooms, emits } = mockIo();
  emitTeacherEvent(
    io,
    { _id: 'tNew', branchId: BRANCH_A, branchCode: 'A' },
    'teacher:new',
    { teacherId: 'tNew', name: 'GV' },
  );
  assert.ok(rooms.includes(`branch_${BRANCH_A}`));
  assert.ok(rooms.includes('tNew'));
  assert.ok(!emits.some((e) => e.room === '*GLOBAL*'));
  assert.ok(!rooms.includes(`branch_${BRANCH_B}`));
});

test('TeacherApplicationService source has no raw io.emit teacher:new', () => {
  const file = path.join(
    __dirname,
    '../../modules/teacher/services/TeacherApplicationService.js',
  );
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('emitTeacherEvent'));
  assert.ok(!/io\.emit\(\s*['"]teacher:new['"]/.test(src));
});

test('examResultRoutes source has no new ExamResult(req.body)', () => {
  const file = path.join(__dirname, '../../routes/examResultRoutes.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/new ExamResult\(\s*req\.body\s*\)/.test(src));
  assert.ok(src.includes('pickExamResultCreate'));
  assert.ok(src.includes('pickExamResultUpdate'));
});

test('assignmentRoutes source has no payload = { ...req.body }', () => {
  const file = path.join(__dirname, '../../routes/assignmentRoutes.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/payload\s*=\s*\{\s*\.\.\.req\.body\s*\}/.test(src));
  assert.ok(!/findByIdAndUpdate\(\s*req\.params\.id\s*,\s*req\.body/.test(src));
  assert.ok(src.includes('pickAssignmentCreate'));
  assert.ok(src.includes('pickAssignmentUpdate'));
});
