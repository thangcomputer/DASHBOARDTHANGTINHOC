/**
 * Wave 6.11 — Policy SHADOW for LIVE staff / branches / employees.
 * Legacy remains HTTP authority; Policy always next().
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildStaffSubject,
  evaluateLegacyStaff,
  evaluatePolicyStaff,
  compareDecisions: compareStaff,
} = require('../../services/policyShadow/staffPolicy');
const {
  buildSubject: buildBranchSubject,
  evaluateLegacyBranch,
  evaluatePolicyBranch,
  compareDecisions: compareBranch,
} = require('../../services/policyShadow/branchPolicy');
const {
  buildSubject: buildEmpSubject,
  evaluateLegacyEmployee,
  evaluatePolicyEmployee,
  compareDecisions: compareEmp,
} = require('../../services/policyShadow/employeePolicy');
const {
  MANAGE_STAFF_LIVE,
  MANAGE_HR_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const STAFF_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439022';
const ROOT = path.join(__dirname, '../..');

function staffSubject(opts = {}) {
  return buildStaffSubject({
    user: {
      id: opts.id ?? STAFF_ID,
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function branchSubject(opts = {}) {
  return buildBranchSubject({
    user: {
      id: opts.id ?? STAFF_ID,
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function empSubject(opts = {}) {
  return buildEmpSubject({
    user: {
      id: opts.id ?? STAFF_ID,
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertStaffMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyStaff(subject, action, ctx);
  const policy = evaluatePolicyStaff(subject, action, ctx, untrusted);
  const result = compareStaff(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertBranchMatch(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyBranch(subject, action);
  const policy = evaluatePolicyBranch(subject, action, untrusted);
  const result = compareBranch(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertEmpMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyEmployee(subject, action, ctx);
  const policy = evaluatePolicyEmployee(subject, action, ctx, untrusted);
  const result = compareEmp(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

// ── Staff ────────────────────────────────────────────────────────────────────

test('Wave6.11 STAFF: manage_staff ALLOW; missing/VIEW/unrelated DENY', () => {
  const ok = staffSubject({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const none = staffSubject({ permissions: [] });
  const view = staffSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  const hr = staffSubject({ permissions: [PERMISSIONS.MANAGE_HR] });
  assert.equal(assertStaffMatch('list+', ok, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertStaffMatch('list-', none, 'list').legacy.decision, 'DENY');
  assert.equal(assertStaffMatch('view-', view, 'list').legacy.decision, 'DENY');
  assert.equal(assertStaffMatch('hr-', hr, 'list').legacy.decision, 'DENY');
});

test('Wave6.11 STAFF: teacher/student DENY; SUPER/hardcoded ALLOW', () => {
  const teacher = staffSubject({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_STAFF],
  });
  const student = staffSubject({
    id: 's1',
    role: 'student',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_STAFF],
  });
  const root = staffSubject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const superDb = staffSubject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertStaffMatch('teach', teacher, 'list').legacy.decision, 'DENY');
  assert.equal(assertStaffMatch('stud', student, 'create', { requestedAdminRole: 'STAFF' }).legacy.decision, 'DENY');
  assert.equal(assertStaffMatch('root', root, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertStaffMatch('super', superDb, 'list').legacy.decision, 'ALLOW');
});

test('Wave6.11 STAFF: create SUPER needs root; HIGH needs SUPER; STAFF ok with perm', () => {
  const high = staffSubject({
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_STAFF],
  });
  const staff = staffSubject({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const root = staffSubject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  });
  const superDb = staffSubject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  });
  assert.equal(
    assertStaffMatch('c-super-high', high, 'create', { requestedAdminRole: 'SUPER_ADMIN' }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('c-super-root', root, 'create', { requestedAdminRole: 'SUPER_ADMIN' }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertStaffMatch('c-high-staff', staff, 'create', { requestedAdminRole: 'HIGH_ADMIN' }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('c-high-super', superDb, 'create', { requestedAdminRole: 'HIGH_ADMIN' }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertStaffMatch('c-staff', staff, 'create', { requestedAdminRole: 'STAFF' }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.11 STAFF: update/delete SUPER/HIGH gates + missing → ALLOW(404)', () => {
  const staff = staffSubject({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const root = staffSubject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  });
  const superDb = staffSubject({ adminRole: 'SUPER_ADMIN', permissions: [] });
  assert.equal(
    assertStaffMatch('u-super', staff, 'update', { target: { adminRole: 'SUPER_ADMIN' } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('u-super-root', root, 'update', { target: { adminRole: 'SUPER_ADMIN' } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertStaffMatch('u-high', staff, 'update', { target: { adminRole: 'HIGH_ADMIN' } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('u-high-super', superDb, 'update', { target: { adminRole: 'HIGH_ADMIN' } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertStaffMatch('u-rolechg', staff, 'update', {
      target: { adminRole: 'STAFF' },
      roleChanging: true,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('u-miss', staff, 'update', { target: null }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertStaffMatch('d-super', staff, 'delete', { target: { adminRole: 'SUPER_ADMIN' } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertStaffMatch('d-miss', staff, 'delete', { target: null }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.11 STAFF: spoof role/adminRole/permissions/branch ignored for actor', () => {
  const none = staffSubject({ permissions: [] });
  assert.equal(
    assertStaffMatch('spoof', none, 'list', {}, {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.MANAGE_STAFF],
      bodyBranchId: BRANCH_B,
      bodyTenantId: 't1',
    }).legacy.decision,
    'DENY',
  );
});

// ── Branches ─────────────────────────────────────────────────────────────────

test('Wave6.11 BRANCH: public list ALLOW; admin ops need manage_staff', () => {
  const anon = buildBranchSubject({ user: {}, actorDoc: null, userBranchId: null });
  const ok = branchSubject({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const none = branchSubject({ permissions: [] });
  const teacher = branchSubject({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_STAFF],
  });
  assert.equal(assertBranchMatch('pub', anon, 'list_public').legacy.decision, 'ALLOW');
  assert.equal(assertBranchMatch('all+', ok, 'list_all').legacy.decision, 'ALLOW');
  assert.equal(assertBranchMatch('all-', none, 'list_all').legacy.decision, 'DENY');
  assert.equal(assertBranchMatch('create+', ok, 'create').legacy.decision, 'ALLOW');
  assert.equal(assertBranchMatch('upd-', none, 'update').legacy.decision, 'DENY');
  assert.equal(assertBranchMatch('del-t', teacher, 'delete').legacy.decision, 'DENY');
});

test('Wave6.11 BRANCH: spoof tenant/role does not widen admin ops', () => {
  const none = branchSubject({ permissions: [] });
  assert.equal(
    assertBranchMatch('spoof', none, 'create', {
      bodyBranchId: BRANCH_A,
      queryTenantId: 'all',
      headerTenantId: 'evil',
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_STAFF],
    }).legacy.decision,
    'DENY',
  );
});

// ── Employees ────────────────────────────────────────────────────────────────

test('Wave6.11 EMP: manage_hr ALLOW; VIEW/unrelated/teacher DENY; list is data-filter', () => {
  const ok = empSubject({ permissions: [PERMISSIONS.MANAGE_HR] });
  const view = empSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  const staffPerm = empSubject({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const teacher = empSubject({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_HR],
  });
  for (const a of ['list', 'stats', 'payroll', 'create']) {
    assert.equal(assertEmpMatch(`${a}+`, ok, a).legacy.decision, 'ALLOW');
    assert.equal(assertEmpMatch(`${a}-`, view, a).legacy.decision, 'DENY');
  }
  assert.equal(assertEmpMatch('staffperm', staffPerm, 'list').legacy.decision, 'DENY');
  assert.equal(assertEmpMatch('teach', teacher, 'list').legacy.decision, 'DENY');
});

test('Wave6.11 EMP: branch A→A ALLOW; A→B DENY; SUPER unbound ALLOW; missing ALLOW(404)', () => {
  const staffA = empSubject({
    permissions: [PERMISSIONS.MANAGE_HR],
    userBranchId: BRANCH_A,
  });
  const superU = empSubject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertEmpMatch('a-a', staffA, 'update', { employee: { branchId: BRANCH_A } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertEmpMatch('a-b', staffA, 'update', { employee: { branchId: BRANCH_B } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEmpMatch('a-b-del', staffA, 'delete', { employee: { branchId: BRANCH_B } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEmpMatch('a-b-pay', staffA, 'pay', { employee: { branchId: BRANCH_B } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEmpMatch('super-b', superU, 'update', { employee: { branchId: BRANCH_B } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertEmpMatch('miss', staffA, 'update', { employee: null }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.11 EMP: spoof body.branchId/tenant/role ignored; HIGH needs manage_hr', () => {
  const none = empSubject({ permissions: [], userBranchId: BRANCH_A });
  const high = empSubject({
    adminRole: 'HIGH_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const highOk = empSubject({
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_HR],
    userBranchId: null,
  });
  assert.equal(
    assertEmpMatch('spoof', none, 'list', {}, {
      bodyBranchId: BRANCH_B,
      bodyTenantId: 't1',
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_HR],
    }).legacy.decision,
    'DENY',
  );
  assert.equal(assertEmpMatch('high-', high, 'list').legacy.decision, 'DENY');
  assert.equal(assertEmpMatch('high+', highOk, 'list').legacy.decision, 'ALLOW');
});

test('Wave6.11 EMP: SUPPORT with manage_hr + own branch; null emp branch cross DENY', () => {
  const support = empSubject({
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_HR],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertEmpMatch('sup-a', support, 'pay', { employee: { branchId: BRANCH_A } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertEmpMatch('sup-null', support, 'pay', { employee: { branchId: null } }).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.11 fail-closed: staff Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/staffPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowStaff');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/staffPolicy');
  policyMod.evaluatePolicyStaff = () => {
    throw new Error('forced staff policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_STAFF], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowStaff } = require('../../middleware/policyShadowStaff');
    const mw = policyShadowStaff('list');
    let nextCount = 0;
    const req = {
      user: { id: STAFF_ID, role: 'staff' },
      params: {},
      body: {},
      method: 'GET',
      originalUrl: '/api/staff',
      requestId: 'req-wave611',
      correlationId: 'corr-wave611',
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
    require('../../services/policyShadow/staffPolicy');
    require('../../middleware/policyShadowStaff');
  }
});

test('Wave6.11 fail-closed: employee Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/employeePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowEmployee');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/employeePolicy');
  policyMod.evaluatePolicyEmployee = () => {
    throw new Error('forced employee policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_HR], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowEmployee } = require('../../middleware/policyShadowEmployee');
    const mw = policyShadowEmployee('list');
    let nextCount = 0;
    const req = {
      user: { id: STAFF_ID, role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      method: 'GET',
      originalUrl: '/api/employees',
      requestId: 'req-wave611-e',
      correlationId: 'corr-wave611-e',
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
    require('../../services/policyShadow/employeePolicy');
    require('../../middleware/policyShadowEmployee');
  }
});

// ── Static guards ────────────────────────────────────────────────────────────

test('Wave6.11 static: legacy middleware remains; Policy shadow-only; CQRS OFF', () => {
  const staff = fs.readFileSync(path.join(ROOT, 'routes/staffRoutes.js'), 'utf8');
  const branches = fs.readFileSync(path.join(ROOT, 'routes/branchRoutes.js'), 'utf8');
  const employees = fs.readFileSync(path.join(ROOT, 'routes/employeeRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');

  for (const a of ['list', 'create', 'update', 'delete']) {
    assert.ok(staff.includes(`guard('${a}')`) || staff.includes(`policyShadowStaff('${a}')`), a);
  }
  assert.ok(staff.includes('policyShadowStaff'));
  assert.ok(staff.includes('staffCutoverGate'));
  assert.ok(!staff.includes("checkPermission('manage_staff')"));
  const staffGate = fs.readFileSync(path.join(ROOT, 'middleware/staffCutoverGate.js'), 'utf8');
  assert.ok(staffGate.includes("checkPermission('manage_staff')"));
  assert.ok(staffGate.includes("getAuthorizationAuthority('staff')"));

  assert.ok(branches.includes("policyShadowBranch('list_public')"));
  assert.ok(branches.includes('branchesCutoverGate'));
  for (const a of ['list_all', 'create', 'update', 'delete']) {
    assert.ok(branches.includes(`adminGuard('${a}')`) || branches.includes(`policyShadowBranch('${a}')`), a);
  }
  // Legacy manage_staff retained inside branchesCutoverGate
  const branchGate = fs.readFileSync(path.join(ROOT, 'middleware/branchesCutoverGate.js'), 'utf8');
  assert.ok(branchGate.includes("checkPermission('manage_staff')"));
  assert.ok(branchGate.includes("getAuthorizationAuthority('branches')"));

  for (const a of ['list', 'stats', 'create', 'update', 'delete', 'pay', 'payroll']) {
    assert.ok(employees.includes(`hrGuard('${a}')`) || employees.includes(`policyShadowEmployee('${a}')`), a);
  }
  assert.ok(employees.includes('branchFilter'));
  assert.ok(employees.includes('policyShadowEmployee'));
  assert.ok(employees.includes('employeesCutoverGate'));
  assert.ok(!employees.includes('checkPermission(PERMISSIONS.MANAGE_HR)'));
  const empGate = fs.readFileSync(path.join(ROOT, 'middleware/employeesCutoverGate.js'), 'utf8');
  assert.ok(empGate.includes('MANAGE_HR'));
  assert.ok(empGate.includes("getAuthorizationAuthority('employees')"));
  // Mass-assignment preserved (P2) — do not fix in shadow wave
  assert.ok(employees.includes('const updates = { ...req.body }'));

  assert.ok(server.includes("app.use('/api/staff'"));
  assert.ok(server.includes("app.use('/api/branches'"));
  assert.ok(server.includes("app.use('/api/employees'"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_STAFF), MANAGE_STAFF_LIVE);
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_HR), MANAGE_HR_LIVE);
});

test('Wave6.11 static: shadow middleware always next(); no 403', () => {
  for (const rel of [
    'middleware/policyShadowStaff.js',
    'middleware/policyShadowBranch.js',
    'middleware/policyShadowEmployee.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
    assert.ok(src.includes('POLICY_MISMATCH') || src.includes('POLICY_SHADOW_ERROR'));
  }
});
