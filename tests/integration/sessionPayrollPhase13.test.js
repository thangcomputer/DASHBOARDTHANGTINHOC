/**
 * Phase 13 — Session payroll (ownership buổi, chống double-pay, split 8/12).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  computePayrollSplit,
  assertNoDoublePayClaim,
  assertSplitNoOverlap,
  simulateReassignPayrollOwnership,
} = require('../../services/sessionPayrollService');
const { computeCompletedSplitByTeacher } = require('../../services/teacherReassignmentService');

test('GATE: payroll split 8 GV-A / 12 GV-B', () => {
  const rate = 100000;
  const result = simulateReassignPayrollOwnership({
    teacherA: 'A',
    teacherB: 'B',
    completedByA: 8,
    scheduledByB: 12,
    ratePerSession: rate,
  });
  assert.equal(result.split.A, 8);
  assert.equal(result.split.B, 12);
  assert.equal(result.teacherASessions, 8);
  assert.equal(result.teacherBSessions, 12);
  assert.equal(result.teacherAAmount, 8 * rate);
  assert.equal(result.teacherBAmount, 12 * rate);
});

test('scheduled sessions do not count toward payroll', () => {
  const split = computeCompletedSplitByTeacher([
    { teacherId: 'A', status: 'completed' },
    { teacherId: 'A', status: 'scheduled' },
    { teacherId: 'B', status: 'no_show' },
    { teacherId: 'B', status: 'cancelled' },
  ]);
  assert.equal(split.A, 1);
  assert.equal(split.B, undefined);
});

test('assertNoDoublePayClaim rejects already-paid session', () => {
  assert.throws(
    () => assertNoDoublePayClaim([
      { _id: '1', is_paid_to_teacher: false },
      { _id: '2', is_paid_to_teacher: true },
    ]),
    /Double-pay/,
  );
});

test('assertNoDoublePayClaim rejects duplicate ids in batch', () => {
  assert.throws(
    () => assertNoDoublePayClaim([
      { _id: '1', is_paid_to_teacher: false },
      { _id: '1', is_paid_to_teacher: false },
    ]),
    /2 lần/,
  );
});

test('assertSplitNoOverlap catches shared session (double-pay risk)', () => {
  assert.throws(
    () => assertSplitNoOverlap(
      [{ _id: 'x', teacherId: 'A' }],
      [{ _id: 'x', teacherId: 'B' }],
    ),
    /double-pay/,
  );
});

test('computePayrollSplit amounts by ownership', () => {
  const { split, amounts, totalSessions, totalAmount } = computePayrollSplit([
    { teacherId: 'A', status: 'completed' },
    { teacherId: 'A', status: 'completed' },
    { teacherId: 'B', status: 'completed' },
    { teacherId: 'B', status: 'scheduled' },
  ], 50000);
  assert.equal(split.A, 2);
  assert.equal(split.B, 1);
  assert.equal(amounts.A, 100000);
  assert.equal(amounts.B, 50000);
  assert.equal(totalSessions, 3);
  assert.equal(totalAmount, 150000);
});

test('pay-flexible uses sessionPayrollService; payroll routes mounted', () => {
  const teachers = fs.readFileSync(path.join(__dirname, '../../routes/teacherRoutes.js'), 'utf8');
  assert.ok(teachers.includes('payTeacherSessions'));
  assert.ok(teachers.includes('sessionPayrollService'));

  const payroll = fs.readFileSync(path.join(__dirname, '../../routes/payrollRoutes.js'), 'utf8');
  assert.ok(payroll.includes('/students/:studentId/split'));
  assert.ok(payroll.includes('/teachers/:teacherId/pay'));

  const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(server.includes('payrollRoutes'));
});

test('LedgerEntry source includes payroll', () => {
  const LedgerEntry = require('../../models/LedgerEntry');
  assert.ok(LedgerEntry.schema.path('source').enumValues.includes('payroll'));
});
