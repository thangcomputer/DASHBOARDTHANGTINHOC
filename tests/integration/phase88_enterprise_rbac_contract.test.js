/**
 * Phase 8.8 — Enterprise RBAC catalog & mapping CONTRACT tests.
 * Does NOT exercise LIVE authorization, authorize(), or Cutover.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const PERMISSIONS = require('../../shared/constants/permissions');
const ROLES = require('../../shared/constants/roles');
const map = require('../../shared/constants/legacyPermissionMapping');
const {
  ADMIN_ROLE_TO_ENTERPRISE,
  ROLE_ALIAS_TABLE,
  resolveEnterpriseRoleContract,
} = require('../../shared/constants/roleAliasContract');
const { normalizeFamily } = require('../../services/policyShadow/cutoverAuthority');

test('Phase8.8 catalog: new enterprise permissions exist', () => {
  assert.equal(PERMISSIONS.HR_MANAGE, 'hr:manage');
  assert.equal(PERMISSIONS.TEACHER_MANAGE, 'teacher:manage');
  assert.equal(PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW, 'finance:branch_revenue:view');
  assert.equal(PERMISSIONS.TEACHER_VIEW, 'teacher:view');
});

test('Phase8.8 mapping: manage_hr → hr:manage', () => {
  assert.deepEqual(map.resolve('manage_hr'), [PERMISSIONS.HR_MANAGE]);
  assert.equal(map.getMappingStatus('manage_hr'), 'MATCH');
});

test('Phase8.8 mapping: manage_teachers → teacher:manage', () => {
  assert.deepEqual(map.resolve('manage_teachers'), [PERMISSIONS.TEACHER_MANAGE]);
});

test('Phase8.8 mapping: view_teachers → teacher:view', () => {
  assert.deepEqual(map.resolve('view_teachers'), [PERMISSIONS.TEACHER_VIEW]);
});

test('Phase8.8 mapping: view_branch_revenue → finance:branch_revenue:view', () => {
  assert.deepEqual(map.resolve('view_branch_revenue'), [PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW]);
});

test('Phase8.8 mapping: view_branch_revenue != finance:view', () => {
  const rev = map.resolve('view_branch_revenue');
  assert.ok(!rev.includes(PERMISSIONS.FINANCE_VIEW));
  assert.ok(rev.includes(PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW));
});

test('Phase8.8 mapping: manage_finance has payment/refund; not revenue-only', () => {
  const fin = map.resolve('manage_finance');
  assert.ok(fin.includes(PERMISSIONS.FINANCE_VIEW));
  assert.ok(fin.includes(PERMISSIONS.FINANCE_PAYMENT_CREATE));
  assert.ok(fin.includes(PERMISSIONS.FINANCE_REFUND_APPROVE));
  assert.ok(!fin.includes(PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW));
  assert.notDeepEqual(fin, [PERMISSIONS.FINANCE_VIEW]);
});

test('Phase8.8/8.10 mapping: manage_training != manage_student_training enterprise codes', () => {
  const t = map.resolve('manage_training');
  const st = map.resolve('manage_student_training');
  assert.ok(t.includes(PERMISSIONS.EXAM_MANAGE));
  assert.ok(t.includes(PERMISSIONS.COURSE_UPDATE));
  assert.deepEqual(st, [PERMISSIONS.STUDENT_TRAINING_MANAGE]);
  assert.ok(!st.includes(PERMISSIONS.COURSE_UPDATE));
  assert.ok(!st.includes(PERMISSIONS.EXAM_MANAGE));
  assert.notDeepEqual(t, st);
});

test('Phase8.8 mapping: view_evaluations remains legacy-only', () => {
  assert.deepEqual(map.resolve('view_evaluations'), []);
  assert.equal(map.getMappingStatus('view_evaluations'), 'LEGACY_ONLY');
  assert.equal(map.isLegacyOnly('view_evaluations'), true);
});

test('RBAC-S1 mapping: schedule/messages/logs are PARTIAL (shadow)', () => {
  for (const k of ['manage_schedule', 'manage_messages', 'view_logs']) {
    assert.equal(map.isLegacyOnly(k), false);
    assert.equal(map.getMappingStatus(k), 'PARTIAL');
    assert.ok(map.resolve(k).length > 0);
  }
  assert.ok(map.resolve('manage_messages').includes('ticket:close'));
  assert.ok(map.resolve('manage_messages').includes('message:view'));
  assert.ok(!map.resolve('manage_messages').includes('ticket:delete'));
});

test('Phase8.8 roles: HIGH_ADMIN exists; STAFF/SUPPORT aliases', () => {
  assert.equal(ROLES.HIGH_ADMIN, 'HIGH_ADMIN');
  assert.equal(ROLES.SUPPORT_AGENT, 'SUPPORT_AGENT');
  assert.equal(ADMIN_ROLE_TO_ENTERPRISE.STAFF, ROLES.ADMIN_STAFF);
  assert.equal(ADMIN_ROLE_TO_ENTERPRISE.SUPPORT, ROLES.SUPPORT_AGENT);
  assert.equal(ADMIN_ROLE_TO_ENTERPRISE.HIGH_ADMIN, ROLES.HIGH_ADMIN);
});

test('Phase8.8 roles: JWT admin not flattened', () => {
  const noRole = resolveEnterpriseRoleContract({ jwtRole: 'admin' });
  assert.equal(noRole.enterpriseRole, null);
  assert.equal(noRole.type, 'LEGACY_PRINCIPAL');
  const withHigh = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'HIGH_ADMIN' });
  assert.equal(withHigh.enterpriseRole, ROLES.HIGH_ADMIN);
  const withStaff = resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'STAFF' });
  assert.equal(withStaff.enterpriseRole, ROLES.ADMIN_STAFF);
});

test('Phase8.8 roles: id=admin legacy root; teacher/student MATCH', () => {
  const root = resolveEnterpriseRoleContract({ userId: 'admin' });
  assert.equal(root.type, 'LEGACY_ROOT');
  assert.equal(root.enterpriseRole, ROLES.SUPER_ADMIN);
  assert.equal(resolveEnterpriseRoleContract({ jwtRole: 'teacher' }).enterpriseRole, ROLES.TEACHER);
  assert.equal(resolveEnterpriseRoleContract({ jwtRole: 'student' }).enterpriseRole, ROLES.STUDENT);
  assert.ok(ROLE_ALIAS_TABLE.some((r) => r.live === 'id=admin' && r.type === 'LEGACY_ROOT'));
});

test('Phase8.8 security: enterprise ALL is not cutover wildcard; * rejected', () => {
  assert.equal(PERMISSIONS.ALL, 'ALL');
  assert.equal(normalizeFamily('*'), null);
  assert.equal(normalizeFamily('ALL'), null);
  for (const [k, v] of Object.entries(map)) {
    if (!Array.isArray(v)) continue;
    assert.ok(!v.includes('*'), k);
    assert.ok(!v.includes(PERMISSIONS.ALL), k);
  }
  assert.ok(!map.resolve('manage_finance').includes(PERMISSIONS.ALL));
  assert.ok(!map.resolve('view_branch_revenue').includes(PERMISSIONS.ALL));
});
