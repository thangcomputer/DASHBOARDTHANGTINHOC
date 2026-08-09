/**
 * Phase 8.10 — Resolve manage_student_training UNKNOWN (observe-only parity).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ENT = require('../../shared/constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const {
  COMPARISON,
  DECISION,
  compareStaffLivePermission,
  expandLivePermissionsToEnterprise,
} = require('../../services/rbacParity');

function actor(permissions, extra = {}) {
  return {
    id: extra.id || 'u1',
    role: extra.role || 'staff',
    adminRole: extra.adminRole || 'STAFF',
    permissions,
  };
}

test('Phase8.10 catalog: student_training:manage exists and is mapped 1:1', () => {
  assert.equal(ENT.STUDENT_TRAINING_MANAGE, 'student_training:manage');
  assert.deepEqual(map.resolve('manage_student_training'), [ENT.STUDENT_TRAINING_MANAGE]);
  assert.equal(map.getMappingStatus('manage_student_training'), 'MATCH');
});

test('Phase8.10 Actor A: student_training only — ALLOW student_training; DENY manage_training', () => {
  const a = actor([LIVE.MANAGE_STUDENT_TRAINING]);
  const st = compareStaffLivePermission(a, LIVE.MANAGE_STUDENT_TRAINING);
  const tr = compareStaffLivePermission(a, LIVE.MANAGE_TRAINING);
  assert.equal(st.live.decision, DECISION.ALLOW);
  assert.equal(st.enterprise.decision, DECISION.ALLOW);
  assert.equal(st.comparison, COMPARISON.MATCH);
  assert.equal(tr.live.decision, DECISION.DENY);
  assert.equal(tr.enterprise.decision, DECISION.DENY);
  assert.equal(tr.comparison, COMPARISON.MATCH);
  const held = expandLivePermissionsToEnterprise(a.permissions);
  assert.ok(held.has(ENT.STUDENT_TRAINING_MANAGE));
  assert.ok(!held.has(ENT.COURSE_UPDATE));
  assert.ok(!held.has(ENT.EXAM_MANAGE));
});

test('Phase8.10 Actor B: manage_training only — ALLOW training; DENY student_training (no widen)', () => {
  const b = actor([LIVE.MANAGE_TRAINING]);
  const tr = compareStaffLivePermission(b, LIVE.MANAGE_TRAINING);
  const st = compareStaffLivePermission(b, LIVE.MANAGE_STUDENT_TRAINING);
  assert.equal(tr.comparison, COMPARISON.MATCH);
  assert.equal(tr.finalDecision, DECISION.ALLOW);
  assert.equal(st.live.decision, DECISION.DENY);
  assert.equal(st.enterprise.decision, DECISION.DENY);
  assert.equal(st.comparison, COMPARISON.MATCH);
  // Critical: course:update from manage_training must NOT satisfy student_training enterprise
  const held = expandLivePermissionsToEnterprise(b.permissions);
  assert.ok(held.has(ENT.COURSE_UPDATE));
  assert.ok(!held.has(ENT.STUDENT_TRAINING_MANAGE));
});

test('Phase8.10 Actor C: both — ALLOW each gate MATCH', () => {
  const c = actor([LIVE.MANAGE_TRAINING, LIVE.MANAGE_STUDENT_TRAINING]);
  assert.equal(compareStaffLivePermission(c, LIVE.MANAGE_TRAINING).comparison, COMPARISON.MATCH);
  assert.equal(compareStaffLivePermission(c, LIVE.MANAGE_STUDENT_TRAINING).comparison, COMPARISON.MATCH);
});

test('Phase8.10 Actor D: neither — DENY both MATCH', () => {
  const d = actor([LIVE.VIEW_TEACHERS]);
  assert.equal(compareStaffLivePermission(d, LIVE.MANAGE_TRAINING).finalDecision, DECISION.DENY);
  assert.equal(compareStaffLivePermission(d, LIVE.MANAGE_STUDENT_TRAINING).finalDecision, DECISION.DENY);
  assert.equal(compareStaffLivePermission(d, LIVE.MANAGE_TRAINING).comparison, COMPARISON.MATCH);
});

test('Phase8.10 role restriction: teacher with grant still DENY staff gate', () => {
  const t = actor([LIVE.MANAGE_STUDENT_TRAINING], { role: 'teacher' });
  assert.equal(compareStaffLivePermission(t, LIVE.MANAGE_STUDENT_TRAINING).finalDecision, DECISION.DENY);
});

test('Phase8.10 branch scopeOk false DENY MATCH both sides', () => {
  const a = actor([LIVE.MANAGE_STUDENT_TRAINING]);
  const r = compareStaffLivePermission(a, LIVE.MANAGE_STUDENT_TRAINING, { scopeOk: false });
  assert.equal(r.live.decision, DECISION.DENY);
  assert.equal(r.enterprise.decision, DECISION.DENY);
  assert.equal(r.finalDecision, DECISION.DENY);
});

test('Phase8.10 rejected candidate course:update would widen — proven by Actor B held set', () => {
  // Document: if student_training mapped to course:update, Actor B would enterprise-ALLOW student_training
  const bHeld = expandLivePermissionsToEnterprise([LIVE.MANAGE_TRAINING]);
  assert.ok(bHeld.has(ENT.COURSE_UPDATE), 'manage_training expands to course:update');
  assert.ok(
    !bHeld.has(ENT.STUDENT_TRAINING_MANAGE),
    'dedicated code prevents widen from manage_training → student_training',
  );
});

test('Phase8.10 keys never merged', () => {
  assert.notDeepEqual(map.resolve('manage_training'), map.resolve('manage_student_training'));
});
