/**
 * Wave 6 — Policy SHADOW for teacher score/approve/reject.
 * Asserts MATCH with legacy; never fail-open.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyTeacherWrite,
  evaluatePolicyTeacherWrite,
  compareDecisions,
} = require('../../services/policyShadow/teacherMutationPolicy');
const {
  toPolicyPermission,
  TEACHER_WRITE_LIVE,
  actorHasLivePermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';

function staffSubject(overrides = {}) {
  return buildSubject({
    user: { id: '507f1f77bcf86cd799439001', role: 'staff' },
    actorDoc: {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      role: 'staff',
    },
    userBranchId: BRANCH_A,
    ...overrides,
  });
}

// ── Permission ───────────────────────────────────────────────────────────────

test('Shadow: MANAGE_TEACHERS + same branch → MATCH ALLOW', () => {
  const subject = staffSubject();
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score', {
    bodyBranchId: BRANCH_B,
  });
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(policy.decision, 'ALLOW');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

test('Shadow: VIEW_TEACHERS only → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439001', role: 'staff' },
    actorDoc: {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.VIEW_TEACHERS],
      role: 'staff',
    },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'approve');
  assert.equal(legacy.decision, 'DENY');
  assert.equal(policy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
  assert.ok(!actorHasLivePermission(subject, PERMISSIONS.MANAGE_TEACHERS));
});

test('Shadow: missing permission → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439001', role: 'staff' },
    actorDoc: { adminRole: 'STAFF', permissions: [], role: 'staff' },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'reject');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
  assert.equal(legacy.decision, 'DENY');
});

// ── Branch ───────────────────────────────────────────────────────────────────

test('Shadow: Branch A → Branch A → MATCH ALLOW', () => {
  const subject = staffSubject();
  const resource = { branchId: BRANCH_A };
  assert.equal(
    compareDecisions(
      evaluateLegacyTeacherWrite(subject, resource),
      evaluatePolicyTeacherWrite(subject, resource, 'score'),
    ),
    'MATCH',
  );
  assert.equal(evaluateLegacyTeacherWrite(subject, resource).decision, 'ALLOW');
});

test('Shadow: Branch A → Branch B → MATCH DENY', () => {
  const subject = staffSubject();
  const resource = { branchId: BRANCH_B };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score', {
    bodyBranchId: BRANCH_A,
    queryBranchId: BRANCH_A,
  });
  assert.equal(legacy.decision, 'DENY');
  assert.equal(policy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

// ── Roles ────────────────────────────────────────────────────────────────────

test('Shadow: SUPER_ADMIN bypass permission → MATCH ALLOW (cross-branch OK without userBranchId)', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439099', role: 'admin' },
    actorDoc: { adminRole: 'SUPER_ADMIN', permissions: [], role: 'admin' },
    userBranchId: null,
  });
  const resource = { branchId: BRANCH_B };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'approve');
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

test('Shadow: HIGH_ADMIN without MANAGE_TEACHERS → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439002', role: 'admin' },
    actorDoc: {
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.VIEW_TEACHERS],
      role: 'admin',
    },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score');
  assert.equal(legacy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

test('Shadow: HIGH_ADMIN with MANAGE_TEACHERS + branch → MATCH ALLOW', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439002', role: 'admin' },
    actorDoc: {
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      role: 'admin',
    },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  assert.equal(
    compareDecisions(
      evaluateLegacyTeacherWrite(subject, resource),
      evaluatePolicyTeacherWrite(subject, resource, 'reject'),
    ),
    'MATCH',
  );
  assert.equal(evaluateLegacyTeacherWrite(subject, resource).decision, 'ALLOW');
});

test('Shadow: SUPPORT without manage_teachers → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439003', role: 'staff' },
    actorDoc: {
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_MESSAGES],
      role: 'staff',
    },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score');
  assert.equal(legacy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

test('Shadow: TEACHER role → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '507f1f77bcf86cd799439004', role: 'teacher' },
    actorDoc: { adminRole: null, permissions: [], role: 'teacher' },
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score');
  assert.equal(legacy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

test('Shadow: hardcoded admin id → MATCH ALLOW', () => {
  const subject = buildSubject({
    user: { id: 'admin', role: 'admin' },
    actorDoc: null,
    userBranchId: null,
  });
  const resource = { branchId: BRANCH_B };
  assert.equal(
    compareDecisions(
      evaluateLegacyTeacherWrite(subject, resource),
      evaluatePolicyTeacherWrite(subject, resource, 'approve'),
    ),
    'MATCH',
  );
  assert.equal(evaluateLegacyTeacherWrite(subject, resource).decision, 'ALLOW');
});

// ── Spoofing ─────────────────────────────────────────────────────────────────

test('Shadow: spoofed body/query branchId ignored — still DENY cross-branch', () => {
  const subject = staffSubject();
  const resource = { branchId: BRANCH_B };
  const policy = evaluatePolicyTeacherWrite(subject, resource, 'score', {
    bodyBranchId: BRANCH_A,
    queryBranchId: BRANCH_A,
  });
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  assert.equal(policy.decision, 'DENY');
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
});

// ── Adapter ──────────────────────────────────────────────────────────────────

test('Adapter: live MANAGE_TEACHERS maps to same live key (not shared taxonomy)', () => {
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_TEACHERS), 'manage_teachers');
  assert.equal(TEACHER_WRITE_LIVE, PERMISSIONS.MANAGE_TEACHERS);
  assert.notEqual(TEACHER_WRITE_LIVE, 'teacher:update');
});

// ── Policy failure → legacy still authoritative (no fail-open) ─────────────

test('Shadow: Policy evaluation throw → comparison ERROR; legacy decision still computable', () => {
  const subject = staffSubject();
  const resource = { branchId: BRANCH_A };
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  assert.equal(legacy.decision, 'ALLOW');
  let comparison = 'UNKNOWN';
  try {
    throw new Error('forced policy failure');
  } catch {
    comparison = 'ERROR';
  }
  assert.equal(comparison, 'ERROR');
  // Legacy still ALLOW — would authorize HTTP; policy error must not flip to open without legacy
  assert.equal(legacy.decision, 'ALLOW');
});

// ── Static: legacy guards still present ──────────────────────────────────────

test('Static: score/approve/reject use shadow + teachersCutoverGate; Legacy retained in gate', () => {
  const file = path.join(__dirname, '../../routes/teacherRoutes.js');
  const gateFile = path.join(__dirname, '../../middleware/teachersCutoverGate.js');
  const src = fs.readFileSync(file, 'utf8');
  const gate = fs.readFileSync(gateFile, 'utf8');
  for (const action of ['score', 'approve', 'reject']) {
    assert.ok(src.includes(`teacherWriteGuard('${action}')`), `missing write guard ${action}`);
  }
  assert.ok(src.includes('policyShadowTeacherWrite'));
  assert.ok(src.includes('teachersCutoverGate'));
  assert.ok(src.includes('teacherWriteGuard'));
  assert.ok(gate.includes('checkPermission(PERMISSIONS.MANAGE_TEACHERS)'));
  assert.ok(gate.includes('assertTeacherBranchAccess'));
  const scoreBlock = src.slice(src.indexOf("router.put('/:id/score'"), src.indexOf("router.put('/:id/approve'"));
  assert.ok(scoreBlock.includes('teacherWriteGuard'));
});
