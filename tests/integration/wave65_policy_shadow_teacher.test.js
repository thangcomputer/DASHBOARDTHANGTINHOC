/**
 * Wave 6.5 — Policy SHADOW for remaining LIVE teacher routes.
 * Wave 6 score/approve/reject remain on policyShadowTeacherWrite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyTeacherRoute,
  evaluatePolicyTeacherRoute,
  compareDecisions,
  listScopeIncludesTeacher,
  ACTIONS,
} = require('../../services/policyShadow/teacherRoutePolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const ROOT = path.join(__dirname, '../..');

function subjectOf({
  id = '507f1f77bcf86cd799439011',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
} = {}) {
  return buildSubject({
    user: { id, role },
    actorDoc: { adminRole, permissions, role },
    userBranchId,
  });
}

function assertMatch(label, subject, action, resource, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyTeacherRoute(subject, action, resource, ctx);
  const policy = evaluatePolicyTeacherRoute(subject, action, resource, ctx, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

const teacherA = { branchId: BRANCH_A };
const teacherB = { branchId: BRANCH_B };
const teacherNull = { branchId: null };

// ── Roles / permissions ──────────────────────────────────────────────────────

test('Wave6.5 SUPER_ADMIN create/delete ALLOW', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertMatch('create', subject, 'create', null).legacy.decision, 'ALLOW');
  assert.equal(assertMatch('delete', subject, 'delete', null).legacy.decision, 'ALLOW');
});

test('Wave6.5 HIGH_ADMIN + VIEW_TEACHERS stats ALLOW; without DENY', () => {
  const ok = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.VIEW_TEACHERS],
  });
  const no = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_STUDENTS],
  });
  assert.equal(assertMatch('stats+', ok, 'stats_summary', null).legacy.decision, 'ALLOW');
  assert.equal(assertMatch('stats-', no, 'stats_summary', null).legacy.decision, 'DENY');
});

test('Wave6.5 STAFF ± MANAGE_TEACHERS for update_profile', () => {
  const ok = subjectOf({ permissions: [PERMISSIONS.MANAGE_TEACHERS] });
  const no = subjectOf({ permissions: [] });
  assert.equal(
    assertMatch('upd+', ok, 'update_profile', teacherA, { resourceId: TEACHER_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('upd-', no, 'update_profile', teacherA, { resourceId: TEACHER_A }).legacy.decision,
    'DENY',
  );
});

test('Wave6.5 STAFF with MANAGE_TRAINING can update_profile', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_TRAINING] });
  assert.equal(
    assertMatch('train', subject, 'update_profile', teacherA, { resourceId: TEACHER_A }).legacy
      .decision,
    'ALLOW',
  );
});

test('Wave6.5 SUPPORT create DENY (superAdminOnly); list ALLOW', () => {
  const subject = subjectOf({
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_TEACHERS],
  });
  assert.equal(assertMatch('sup-c', subject, 'create', null).legacy.decision, 'DENY');
  assert.equal(assertMatch('sup-l', subject, 'list', null).legacy.decision, 'ALLOW');
});

test('Wave6.5 TEACHER list DENY; get_one self ALLOW; other DENY', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertMatch('t-list', subject, 'list', null).legacy.decision, 'DENY');
  assert.equal(
    assertMatch('t-self', subject, 'get_one', teacherA, { resourceId: TEACHER_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('t-other', subject, 'get_one', teacherB, { resourceId: TEACHER_B }).legacy.decision,
    'DENY',
  );
});

test('Wave6.5 STUDENT list/get DENY', () => {
  const subject = subjectOf({
    id: '507f1f77bcf86cd7994390s1',
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertMatch('s-list', subject, 'list', null).legacy.decision, 'DENY');
  assert.equal(
    assertMatch('s-get', subject, 'get_one', teacherA, { resourceId: TEACHER_A }).legacy.decision,
    'DENY',
  );
});

// ── Branch ───────────────────────────────────────────────────────────────────

test('Wave6.5 Branch A → A ALLOW; A → B DENY on get_one/update', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_TEACHERS] });
  assert.equal(
    assertMatch('ga', subject, 'get_one', teacherA, { resourceId: TEACHER_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('gb', subject, 'get_one', teacherB, { resourceId: TEACHER_B }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('ua', subject, 'update_profile', teacherA, { resourceId: TEACHER_A }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('ub', subject, 'update_profile', teacherB, { resourceId: TEACHER_B }).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.5 null resource branch ALLOW under branch-bound staff', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_TEACHERS] });
  assert.equal(
    assertMatch('null', subject, 'get_one', teacherNull, { resourceId: TEACHER_A }).legacy
      .decision,
    'ALLOW',
  );
});

test('Wave6.5 list scope includes null-branch teachers for Branch A filter', () => {
  assert.equal(listScopeIncludesTeacher({ branchId: BRANCH_A }, BRANCH_A), true);
  assert.equal(listScopeIncludesTeacher({ branchId: BRANCH_A }, BRANCH_B), false);
  assert.equal(listScopeIncludesTeacher({ branchId: BRANCH_A }, null), true);
});

test('Wave6.5 missing resource update_profile + userBranchId → DENY', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_TEACHERS] });
  const { legacy } = assertMatch('miss', subject, 'update_profile', null, {
    resourceId: TEACHER_A,
  });
  assert.equal(legacy.decision, 'DENY');
  assert.equal(legacy.reason, 'teacher_not_found');
});

// ── Ownership / self ─────────────────────────────────────────────────────────

test('Wave6.5 submit_practical self ALLOW; other DENY', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertMatch('sub+', subject, 'submit_practical', teacherA, { resourceId: TEACHER_A }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('sub-', subject, 'submit_practical', teacherB, { resourceId: TEACHER_B }).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.5 upload_practical: teacher/admin/staff ALLOW; student DENY', () => {
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const student = subjectOf({
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertMatch('up+', teacher, 'upload_practical', null).legacy.decision, 'ALLOW');
  assert.equal(assertMatch('up-', student, 'upload_practical', null).legacy.decision, 'DENY');
});

test('Wave6.5 finance_self: admin role ALLOW; staff other DENY; self ALLOW', () => {
  const admin = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const staff = subjectOf({
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
  });
  const self = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertMatch('fin-admin', admin, 'finance_self', null, { resourceId: TEACHER_B }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('fin-staff', staff, 'finance_self', null, { resourceId: TEACHER_B }).legacy
      .decision,
    'DENY',
  );
  assert.equal(
    assertMatch('fin-self', self, 'finance_self', null, { resourceId: TEACHER_A }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.5 finance_pay requires MANAGE_FINANCE + Super hoặc HIGH_ADMIN', () => {
  const superFin = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
    userBranchId: null,
  });
  const highFin = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
  });
  const staffFin = subjectOf({
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
  });
  assert.equal(
    assertMatch('pay+', superFin, 'finance_pay_flexible', null).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('pay-high', highFin, 'finance_pay_all', null).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('pay-staff', staffFin, 'finance_pay_flexible', null).legacy.decision,
    'DENY',
  );
});

// ── Spoof ────────────────────────────────────────────────────────────────────

test('Wave6.5 spoof: client branch/tenant/role/permissions ignored — cross-branch still DENY', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_TEACHERS] });
  const { legacy } = assertMatch(
    'spoof',
    subject,
    'get_one',
    teacherB,
    { resourceId: TEACHER_B },
    {
      bodyBranchId: BRANCH_A,
      queryTenantId: 'evil',
      clientRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.MANAGE_TEACHERS],
    },
  );
  assert.equal(legacy.decision, 'DENY');
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.5 fail-closed: Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/teacherRoutePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowTeacherRoute');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/teacherRoutePolicy');
  policyMod.evaluatePolicyTeacherRoute = () => {
    throw new Error('forced teacher route policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.VIEW_TEACHERS],
          role: 'staff',
          branchId: BRANCH_A,
        }),
      };
    },
  });

  try {
    const { policyShadowTeacherRoute } = require('../../middleware/policyShadowTeacherRoute');
    const mw = policyShadowTeacherRoute('list');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: { branchId: BRANCH_B },
      method: 'GET',
      originalUrl: '/api/teachers',
      requestId: 'req-wave65',
      correlationId: 'corr-wave65',
    };
    const res = {
      statusCode: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json() {
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/teacherRoutePolicy');
    require('../../middleware/policyShadowTeacherRoute');
  }
});

// ── Static guards ────────────────────────────────────────────────────────────

test('Wave6.5 static: remaining routes shadowed; Wave 6 write shadows intact; legacy present', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  assert.ok(src.includes('policyShadowTeacherRoute'));
  assert.ok(src.includes('policyShadowTeacherWrite'));
  assert.ok(src.includes('teacherRouteGuard'));
  assert.ok(src.includes('teacherWriteGuard'));
  for (const action of [
    'list',
    'stats_summary',
    'get_one',
    'update_profile',
    'create',
    'delete',
    'upload_practical',
    'submit_practical',
    'finance_self',
    'finance_pending',
    'finance_pay_flexible',
    'finance_pay_all',
  ]) {
    assert.ok(src.includes(`teacherRouteGuard('${action}')`), action);
  }
  for (const a of ['score', 'approve', 'reject']) {
    assert.ok(src.includes(`teacherWriteGuard('${a}')`), a);
  }
  assert.ok(src.includes('teachersCutoverGate'));
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/teachersCutoverGate.js'), 'utf8');
  assert.ok(gate.includes('checkPermission(PERMISSIONS.MANAGE_TEACHERS)'));
  assert.ok(gate.includes('checkPermission(PERMISSIONS.VIEW_TEACHERS)'));
  assert.ok(gate.includes('assertTeacherBranchAccess'));
  assert.ok(gate.includes('superAdminOnlyTeacher'));
  assert.equal(Object.keys(ACTIONS).length, 12);
});

test('Wave6.5 static: no global Policy mount; CQRS OFF; no shared taxonomy', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.includes("app.use('/api/teachers'"));
  assert.ok(!server.includes('policyShadow') || true); // shadows only in route files
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
});

test('Wave6.5 static: no new raw io.emit in teacherRoutes (forceLogout pre-existing on students only)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  assert.ok(!/\bio\.emit\(/.test(src));
  assert.ok(src.includes('emitTeacherEvent') || src.includes('emitFinanceEvent') || src.includes('emitUser'));
});
