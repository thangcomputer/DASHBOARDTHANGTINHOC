/**
 * Phase 8.9 — LIVE vs Enterprise RBAC parity (observe-only).
 * Enterprise never becomes HTTP authority.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  LIVE,
  ENT,
  COMPARISON,
  DECISION,
  compareStaffLivePermission,
  compareStaffLiveAnyPermission,
  expandLivePermissionsToEnterprise,
  resolveEnterpriseRoleContract,
  toSafeParityLog,
  map,
} = require('../../services/rbacParity');
const { normalizeFamily } = require('../../services/policyShadow/cutoverAuthority');
const ROLES = require('../../shared/constants/roles');

function actor(opts = {}) {
  return {
    id: opts.id ?? 'u1',
    role: opts.role ?? 'staff',
    adminRole: opts.adminRole ?? 'STAFF',
    permissions: opts.permissions ?? [],
    userBranchId: opts.userBranchId ?? null,
  };
}

// ── Role alias parity ────────────────────────────────────────────────────────

test('Phase8.9 role: JWT+adminRole aliases', () => {
  assert.equal(
    resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'SUPER_ADMIN' }).enterpriseRole,
    ROLES.SUPER_ADMIN,
  );
  assert.equal(
    resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'HIGH_ADMIN' }).enterpriseRole,
    ROLES.HIGH_ADMIN,
  );
  assert.equal(
    resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'STAFF' }).enterpriseRole,
    ROLES.ADMIN_STAFF,
  );
  assert.equal(
    resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'SUPPORT' }).enterpriseRole,
    ROLES.SUPPORT_AGENT,
  );
  assert.equal(resolveEnterpriseRoleContract({ jwtRole: 'teacher' }).enterpriseRole, ROLES.TEACHER);
  assert.equal(resolveEnterpriseRoleContract({ jwtRole: 'student' }).enterpriseRole, ROLES.STUDENT);
});

test('Phase8.9 role: JWT admin alone not flattened; id=admin LEGACY_ROOT', () => {
  const bare = resolveEnterpriseRoleContract({ jwtRole: 'admin' });
  assert.equal(bare.enterpriseRole, null);
  assert.equal(bare.type, 'LEGACY_PRINCIPAL');
  const root = resolveEnterpriseRoleContract({ userId: 'admin' });
  assert.equal(root.type, 'LEGACY_ROOT');
  assert.equal(root.enterpriseRole, ROLES.SUPER_ADMIN);
});

// ── Mapping / permission parity ──────────────────────────────────────────────

test('Phase8.9 mapping contract keys', () => {
  assert.deepEqual(map.resolve('view_teachers'), [ENT.TEACHER_VIEW]);
  assert.deepEqual(map.resolve('manage_teachers'), [ENT.TEACHER_MANAGE]);
  assert.deepEqual(map.resolve('manage_hr'), [ENT.HR_MANAGE]);
  assert.deepEqual(map.resolve('view_branch_revenue'), [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
  assert.ok(!map.resolve('view_branch_revenue').includes(ENT.FINANCE_VIEW));
});

test('Phase8.9 HR: manage_hr ↔ hr:manage MATCH; not user:manage/finance', () => {
  const ok = actor({ permissions: [LIVE.MANAGE_HR] });
  const r = compareStaffLivePermission(ok, LIVE.MANAGE_HR);
  assert.equal(r.live.decision, DECISION.ALLOW);
  assert.equal(r.enterprise.decision, DECISION.ALLOW);
  assert.equal(r.comparison, COMPARISON.MATCH);
  assert.equal(r.finalDecision, r.live.decision);

  const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_HR]);
  assert.ok(held.has(ENT.HR_MANAGE));
  assert.ok(!held.has(ENT.USER_MANAGE));
  assert.ok(!held.has(ENT.FINANCE_VIEW));

  const staffOnly = actor({ permissions: [LIVE.MANAGE_STAFF] });
  const deny = compareStaffLivePermission(staffOnly, LIVE.MANAGE_HR);
  assert.equal(deny.live.decision, DECISION.DENY);
  assert.equal(deny.comparison, COMPARISON.MATCH);
});

test('Phase8.9 HR: branch scope preserved on both sides', () => {
  const ok = actor({ permissions: [LIVE.MANAGE_HR], userBranchId: 'A' });
  const same = compareStaffLivePermission(ok, LIVE.MANAGE_HR, { scopeOk: true });
  const cross = compareStaffLivePermission(ok, LIVE.MANAGE_HR, { scopeOk: false });
  assert.equal(same.comparison, COMPARISON.MATCH);
  assert.equal(same.finalDecision, DECISION.ALLOW);
  assert.equal(cross.live.decision, DECISION.DENY);
  assert.equal(cross.enterprise.decision, DECISION.DENY);
  assert.equal(cross.comparison, COMPARISON.MATCH);
  assert.equal(cross.finalDecision, DECISION.DENY);
});

test('Phase8.9 teacher: view vs manage separation', () => {
  const viewer = actor({ permissions: [LIVE.VIEW_TEACHERS] });
  const viewGate = compareStaffLivePermission(viewer, LIVE.VIEW_TEACHERS);
  const manageGate = compareStaffLivePermission(viewer, LIVE.MANAGE_TEACHERS);
  assert.equal(viewGate.comparison, COMPARISON.MATCH);
  assert.equal(viewGate.finalDecision, DECISION.ALLOW);
  assert.equal(manageGate.live.decision, DECISION.DENY);
  assert.equal(manageGate.comparison, COMPARISON.MATCH);

  const manager = actor({ permissions: [LIVE.MANAGE_TEACHERS] });
  const m = compareStaffLivePermission(manager, LIVE.MANAGE_TEACHERS);
  assert.equal(m.finalDecision, DECISION.ALLOW);
  assert.equal(m.comparison, COMPARISON.MATCH);

  const heldView = expandLivePermissionsToEnterprise([LIVE.VIEW_TEACHERS]);
  assert.ok(heldView.has(ENT.TEACHER_VIEW));
  assert.ok(!heldView.has(ENT.TEACHER_MANAGE));
  assert.ok(!heldView.has(ENT.TEACHER_UPDATE));
  assert.ok(!heldView.has(ENT.TEACHER_ASSIGN));
});

test('Phase8.9 teacher: SUPER / id=admin allow manage; create stays role authority', () => {
  const superA = actor({
    id: 'sa',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  });
  const root = actor({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] });
  assert.equal(compareStaffLivePermission(superA, LIVE.MANAGE_TEACHERS).finalDecision, DECISION.ALLOW);
  assert.equal(compareStaffLivePermission(root, LIVE.MANAGE_TEACHERS).finalDecision, DECISION.ALLOW);
  // create/delete are SUPER role gates — not manage_teachers mapping; document as role authority
  assert.equal(superA.adminRole, 'SUPER_ADMIN');
});

test('Phase8.9 finance: revenue-only vs manage separation', () => {
  const revenue = actor({ permissions: [LIVE.VIEW_BRANCH_REVENUE] });
  const read = compareStaffLiveAnyPermission(revenue, [
    LIVE.MANAGE_FINANCE,
    LIVE.VIEW_BRANCH_REVENUE,
  ]);
  assert.equal(read.finalDecision, DECISION.ALLOW);
  assert.equal(read.comparison, COMPARISON.MATCH);

  const mutate = compareStaffLivePermission(revenue, LIVE.MANAGE_FINANCE);
  assert.equal(mutate.live.decision, DECISION.DENY);
  assert.equal(mutate.finalDecision, DECISION.DENY);
  assert.equal(mutate.comparison, COMPARISON.MATCH);

  const held = expandLivePermissionsToEnterprise([LIVE.VIEW_BRANCH_REVENUE]);
  assert.deepEqual([...held], [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
  assert.ok(!held.has(ENT.FINANCE_VIEW));
  assert.ok(!held.has(ENT.FINANCE_PAYMENT_CREATE));
  assert.ok(!held.has(ENT.FINANCE_REFUND_APPROVE));
});

test('Phase8.9 finance: manager allow manage; payment/refund codes present', () => {
  const mgr = actor({ permissions: [LIVE.MANAGE_FINANCE] });
  const m = compareStaffLivePermission(mgr, LIVE.MANAGE_FINANCE);
  assert.equal(m.finalDecision, DECISION.ALLOW);
  assert.equal(m.comparison, COMPARISON.MATCH);
  const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
  assert.ok(held.has(ENT.FINANCE_VIEW));
  assert.ok(held.has(ENT.FINANCE_PAYMENT_CREATE));
  assert.ok(held.has(ENT.FINANCE_REFUND_APPROVE));
  assert.ok(!held.has(ENT.FINANCE_BRANCH_REVENUE_VIEW));
});

test('Phase8.9/8.10 training vs student_training separation; student_training MATCH dedicated code', () => {
  const t = map.resolve('manage_training');
  const st = map.resolve('manage_student_training');
  assert.ok(t.includes(ENT.EXAM_MANAGE));
  assert.deepEqual(st, [ENT.STUDENT_TRAINING_MANAGE]);
  assert.ok(!st.includes(ENT.COURSE_UPDATE));

  const studentTrainer = actor({ permissions: [LIVE.MANAGE_STUDENT_TRAINING] });
  const r = compareStaffLivePermission(studentTrainer, LIVE.MANAGE_STUDENT_TRAINING);
  assert.equal(r.finalDecision, DECISION.ALLOW);
  assert.equal(r.comparison, COMPARISON.MATCH);

  const trainer = actor({ permissions: [LIVE.MANAGE_TRAINING] });
  const tr = compareStaffLivePermission(trainer, LIVE.MANAGE_TRAINING);
  assert.equal(tr.comparison, COMPARISON.MATCH);
  // manage_training alone must NOT satisfy manage_student_training enterprise gate
  const cross = compareStaffLivePermission(trainer, LIVE.MANAGE_STUDENT_TRAINING);
  assert.equal(cross.live.decision, DECISION.DENY);
  assert.equal(cross.enterprise.decision, DECISION.DENY);
  assert.equal(cross.comparison, COMPARISON.MATCH);
});

test('Phase8.9 legacy-only → UNSUPPORTED; finalDecision still LIVE', () => {
  const a = actor({ permissions: [LIVE.MANAGE_SCHEDULE] });
  const r = compareStaffLivePermission(a, LIVE.MANAGE_SCHEDULE);
  assert.equal(r.comparison, COMPARISON.UNSUPPORTED);
  assert.equal(r.finalDecision, r.live.decision);
});

test('Phase8.9 actors: teacher/student/unauth deny staff gates; HIGH with grant', () => {
  assert.equal(
    compareStaffLivePermission(actor({ role: 'teacher', permissions: [LIVE.MANAGE_HR] }), LIVE.MANAGE_HR)
      .finalDecision,
    DECISION.DENY,
  );
  assert.equal(
    compareStaffLivePermission(actor({ role: 'student', permissions: [] }), LIVE.MANAGE_HR).finalDecision,
    DECISION.DENY,
  );
  assert.equal(
    compareStaffLivePermission(null, LIVE.MANAGE_HR).finalDecision,
    DECISION.DENY,
  );
  const high = actor({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [LIVE.MANAGE_TEACHERS],
  });
  assert.equal(compareStaffLivePermission(high, LIVE.MANAGE_TEACHERS).comparison, COMPARISON.MATCH);
  const highNo = actor({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [LIVE.VIEW_TEACHERS] });
  assert.equal(compareStaffLivePermission(highNo, LIVE.MANAGE_TEACHERS).finalDecision, DECISION.DENY);
});

test('Phase8.9 spoof: client permissions/role ignored — only trusted actor fields', () => {
  const trusted = actor({ permissions: [LIVE.VIEW_TEACHERS] });
  const untrusted = {
    ...trusted,
    // spoof fields must not be read by comparator
  };
  void {
    bodyRole: 'admin',
    bodyPermissions: [LIVE.MANAGE_TEACHERS, LIVE.MANAGE_FINANCE],
  };
  const r = compareStaffLivePermission(untrusted, LIVE.MANAGE_TEACHERS);
  assert.equal(r.finalDecision, DECISION.DENY);
});

test('Phase8.9 missing resource / no-branch: scopeOk false both DENY MATCH', () => {
  const a = actor({ permissions: [LIVE.MANAGE_HR] });
  const r = compareStaffLivePermission(a, LIVE.MANAGE_HR, { scopeOk: false });
  assert.equal(r.comparison, COMPARISON.MATCH);
  assert.equal(r.finalDecision, DECISION.DENY);
});

test('Phase8.9 wildcard / ALL isolation', () => {
  assert.equal(normalizeFamily('*'), null);
  assert.equal(normalizeFamily('ALL'), null);
  assert.equal(ENT.ALL, 'ALL');
  const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
  assert.ok(!held.has(ENT.ALL));
});

test('Phase8.9 finalDecision always LIVE; enterprise never overrides', () => {
  const cases = [
    compareStaffLivePermission(actor({ permissions: [LIVE.MANAGE_HR] }), LIVE.MANAGE_HR),
    compareStaffLivePermission(actor({ permissions: [] }), LIVE.MANAGE_HR),
    compareStaffLivePermission(actor({ permissions: [LIVE.MANAGE_SCHEDULE] }), LIVE.MANAGE_SCHEDULE),
  ];
  for (const r of cases) {
    assert.equal(r.finalDecision, r.live.decision);
  }
});

test('Phase8.9 observability log is safe metadata only', () => {
  const r = compareStaffLivePermission(actor({ permissions: [LIVE.MANAGE_HR] }), LIVE.MANAGE_HR);
  const log = toSafeParityLog(r, {
    family: 'employees',
    livePermission: LIVE.MANAGE_HR,
    requestId: 'r1',
    correlationId: 'c1',
  });
  const s = JSON.stringify(log);
  assert.ok(s.includes('RBAC_PARITY_COMPARE'));
  assert.ok(s.includes('MATCH'));
  assert.ok(!/password|Bearer |refreshToken|JWT_SECRET/i.test(s));
  assert.ok(!s.includes('req.body'));
});

test('Phase8.9/8.11 static: parity not authority on server/routes; observe-only in auth', () => {
  const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  assert.ok(!server.includes('rbacParity'));
  assert.ok(!server.includes('compareLiveEnterprise'));
  const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
  // Phase 8.11 may mount observeLiveStaffGate AFTER LIVE decision — never as authorize()
  assert.ok(!auth.includes('enterpriseAuthorize') && !auth.includes("require('../shared/middleware/authorize')"));
  if (auth.includes('rbacParity')) {
    assert.ok(auth.includes('observeLiveStaffGate'));
    assert.ok(auth.includes('liveDecision'));
    assert.ok(auth.includes('if (ok) next()'));
  }
  const inv = fs.readFileSync(path.join(__dirname, '../../routes/invoiceRoutes.js'), 'utf8');
  assert.ok(!inv.includes('rbacParity'));
});

test('Phase8.9 no fail-open: empty actor / missing perm → DENY', () => {
  assert.equal(compareStaffLivePermission({}, LIVE.MANAGE_HR).finalDecision, DECISION.DENY);
  assert.equal(
    compareStaffLivePermission(actor({ permissions: ['view_teachers'] }), LIVE.MANAGE_FINANCE)
      .finalDecision,
    DECISION.DENY,
  );
});
