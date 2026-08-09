/**
 * Wave 6.13 — Policy SHADOW for LIVE /api/tenants.
 * Legacy: authMiddleware + isSuperAdmin (no permission taxonomy).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyTenant,
  evaluatePolicyTenant,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/tenantPolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TENANT_A = '507f1f77bcf86cd7994390t1';
const TENANT_B = '507f1f77bcf86cd7994390t2';
const ACTOR_ID = '507f1f77bcf86cd799439011';
const ROOT = path.join(__dirname, '../..');

function subject(opts = {}) {
  return buildSubject({
    user: {
      id: opts.id === undefined ? ACTOR_ID : opts.id,
      role: opts.role ?? 'admin',
    },
    actorDoc: opts.actorDoc === null
      ? null
      : {
          adminRole: opts.adminRole ?? 'STAFF',
          permissions: opts.permissions ?? [],
          role: opts.role ?? 'admin',
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertMatch(label, subj, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyTenant(subj, action, ctx);
  const policy = evaluatePolicyTenant(subj, action, ctx, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

const ALL_ACTIONS = [...ACTIONS];

test('Wave6.13: SUPER_ADMIN + hardcoded admin ALLOW all tenant actions', () => {
  const root = subject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const superDb = subject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  for (const a of ALL_ACTIONS) {
    assert.equal(assertMatch(`root-${a}`, root, a).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`super-${a}`, superDb, a).legacy.decision, 'ALLOW');
  }
});

test('Wave6.13: HIGH_ADMIN / STAFF / SUPPORT DENY even with SYSTEM_SETTINGS', () => {
  const high = subject({
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.MANAGE_STAFF],
  });
  const staff = subject({
    role: 'staff',
    adminRole: 'STAFF',
    permissions: Object.values(PERMISSIONS),
  });
  const support = subject({
    role: 'staff',
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_MESSAGES],
  });
  for (const a of ['list', 'create', 'update', 'get']) {
    assert.equal(assertMatch(`high-${a}`, high, a).legacy.decision, 'DENY');
    assert.equal(assertMatch(`staff-${a}`, staff, a).legacy.decision, 'DENY');
    assert.equal(assertMatch(`sup-${a}`, support, a).legacy.decision, 'DENY');
  }
});

test('Wave6.13: teacher/student DENY; missing actor DENY', () => {
  const teacher = subject({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const student = subject({
    id: 's1',
    role: 'student',
    adminRole: null,
    permissions: [],
  });
  const missing = subject({ id: '', role: '', adminRole: null, actorDoc: null });
  assert.equal(assertMatch('teach', teacher, 'list').legacy.decision, 'DENY');
  assert.equal(assertMatch('stud', student, 'create').legacy.decision, 'DENY');
  assert.equal(assertMatch('miss', missing, 'list').legacy.decision, 'DENY');
});

test('Wave6.13: no invented manage_tenants — permissions ignored for gate', () => {
  const staff = subject({
    role: 'staff',
    adminRole: 'STAFF',
    permissions: ['manage_tenants', 'view_tenants', PERMISSIONS.SYSTEM_SETTINGS],
  });
  assert.equal(assertMatch('fake-perm', staff, 'list').legacy.decision, 'DENY');
});

test('Wave6.13: same/cross tenant ALLOW for SUPER (no ownership gate)', () => {
  const superDb = subject({ adminRole: 'SUPER_ADMIN', permissions: [], userBranchId: null });
  assert.equal(
    assertMatch('same-t', superDb, 'get', { paramsId: TENANT_A, resourceTenant: { _id: TENANT_A } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('cross-t', superDb, 'stats', { paramsId: TENANT_B, resourceTenant: { _id: TENANT_B } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('miss-res', superDb, 'get', { paramsId: 'deadbeef', resourceTenant: null }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.13: branch ignored for HTTP — SUPER ALLOW A/B; STAFF DENY regardless', () => {
  const superDb = subject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: BRANCH_A,
  });
  const staff = subject({
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_STAFF],
    userBranchId: BRANCH_A,
  });
  assert.equal(assertMatch('s-a', superDb, 'meta_branches').legacy.decision, 'ALLOW');
  assert.equal(
    assertMatch('s-b', superDb, 'assign_branch', {}, { bodyBranchId: BRANCH_B }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('st-a', staff, 'assign_branch', {}, { bodyBranchId: BRANCH_A }).legacy.decision,
    'DENY',
  );
});

test('Wave6.13: spoof role/adminRole/permissions/tenant/branch cannot widen', () => {
  const high = subject({
    adminRole: 'HIGH_ADMIN',
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertMatch('spoof', high, 'create', {}, {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
      bodyUserId: 'admin',
      bodyTenantId: TENANT_A,
      queryTenantId: TENANT_B,
      bodyBranchId: BRANCH_B,
      queryBranchId: BRANCH_B,
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.13: malformed/missing id still ALLOW for SUPER (handler 404)', () => {
  const superDb = subject({ adminRole: 'SUPER_ADMIN', permissions: [] });
  assert.equal(
    assertMatch('bad-id', superDb, 'update', { paramsId: 'not-an-objectid' }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.13 fail-closed: Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/tenantPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowTenant');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/tenantPolicy');
  policyMod.evaluatePolicyTenant = () => {
    throw new Error('forced tenant policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'SUPER_ADMIN', permissions: [], role: 'admin' }) };
    },
  });
  try {
    const { policyShadowTenant } = require('../../middleware/policyShadowTenant');
    const mw = policyShadowTenant('list');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR_ID, role: 'admin' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/tenants',
      requestId: 'req-wave613',
      correlationId: 'corr-wave613',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/tenantPolicy');
    require('../../middleware/policyShadowTenant');
  }
});

test('Wave6.13 static: isSuperAdmin remains; Policy shadow-only; CQRS OFF; modules unmounted', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/tenantRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'services/tenantService.js'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');

  for (const a of ALL_ACTIONS) {
    assert.ok(routes.includes(`guard('${a}')`) || routes.includes(`policyShadowTenant('${a}')`), a);
  }
  // Phase 7.6: Legacy isSuperAdmin retained inside tenantsCutoverGate (not removed)
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/tenantsCutoverGate.js'), 'utf8');
  assert.ok(routes.includes('tenantsCutoverGate'));
  assert.ok(gate.includes('isSuperAdmin'));
  assert.ok(routes.includes('policyShadowTenant'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(!routes.includes('checkPermission'));
  assert.ok(!routes.includes('branchFilter'));

  assert.ok(server.includes("app.use('/api/tenants'"));
  assert.ok(!server.includes("require('./modules/tenant"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  // Do not invent manage_tenants in live permission authority
  assert.ok(!/MANAGE_TENANT|manage_tenants|view_tenants/.test(perms));

  // Service uses field allowlist (not new Tenant(req.body))
  assert.ok(service.includes('async function createTenant({ name, code'));
  assert.ok(service.includes('if (patch.name != null)'));
  assert.ok(!/\bio\.emit\(/.test(routes));
  assert.ok(!/\bio\.emit\(/.test(service));
});

test('Wave6.13 static: shadow middleware always next(); no HTTP 403', () => {
  const src = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowTenant.js'), 'utf8');
  assert.ok(src.includes('return next()'));
  assert.ok(!/res\.status\(403\)/.test(src));
  assert.ok(src.includes('POLICY_MISMATCH'));
  assert.ok(src.includes('POLICY_SHADOW_ERROR'));
});

test('Wave6.13 inventory: modules/tenant + rbac tenant.policy UNMOUNTED', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(!server.includes('modules/tenant'));
  assert.ok(!server.includes('tenant.policy'));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/tenant/tenantRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/rbac/policies/tenant.policy.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'middleware/tenantContext.js')));
  // tenantContext is NOT used on /api/tenants live routes
  const routes = fs.readFileSync(path.join(ROOT, 'routes/tenantRoutes.js'), 'utf8');
  assert.ok(!routes.includes('tenantContext'));
});
