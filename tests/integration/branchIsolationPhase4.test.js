/**
 * Phase 4 — Branch isolation helpers + matrix checks.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCrossBranch,
  isGlobalBranchActor,
  examResultBranchClause,
} = require('../../utils/branchScope');

test('isCrossBranch: same branch allow', () => {
  assert.equal(isCrossBranch('b1', 'b1'), false);
});

test('isCrossBranch: different branch deny', () => {
  assert.equal(isCrossBranch('b1', 'b2'), true);
});

test('isCrossBranch: super/global actor (null) never cross', () => {
  assert.equal(isCrossBranch(null, 'b2'), false);
  assert.equal(isCrossBranch(undefined, 'b2'), false);
});

test('isCrossBranch: legacy null target allow', () => {
  assert.equal(isCrossBranch('b1', null), false);
  assert.equal(isCrossBranch('b1', ''), false);
});

test('isGlobalBranchActor when no userBranchId', () => {
  assert.equal(isGlobalBranchActor({}), true);
  assert.equal(isGlobalBranchActor({ userBranchId: 'x' }), false);
});

test('examResultBranchClause null for global actor', async () => {
  const clause = await examResultBranchClause({});
  assert.equal(clause, null);
});

test('critical route files reference branchFilter / branchScope', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..', 'routes');
  const files = [
    'examResultRoutes.js',
    'scheduleRoutes.js',
    'transactionRoutes.js',
    'invoiceRoutes.js',
    'assignmentRoutes.js',
    'evaluationRoutes.js',
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(src.includes('branchFilter'), `${f} must use branchFilter`);
    assert.ok(
      src.includes('branchScope') || src.includes('assertBranch') || src.includes('assertStudentBranch') || src.includes('assertTeacherBranch') || src.includes('listStudentIdsInActorBranch'),
      `${f} must use branch scope helper`
    );
  }
});
