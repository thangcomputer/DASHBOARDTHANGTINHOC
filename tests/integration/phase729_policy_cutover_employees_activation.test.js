/**
 * Phase 7.29 — Controlled cutover + production activation for /api/employees
 *
 * LIVE: auth → branchFilter → policyShadowEmployee → employeesCutoverGate → handler.
 * Legacy checkPermission(MANAGE_HR) retained inside employeesCutoverGate.
 * create/update/delete/pay mutations + socket emits remain handler-owned (NOT EXECUTED).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AUTHORITY,
  getAuthorizationAuthority,
  readCutoverConfigFromEnv,
} = require('../../services/policyShadow/cutoverAuthority');
const {
  buildSubject,
  evaluateLegacyEmployee,
  evaluatePolicyEmployee,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/employeePolicy');
const { employeesCutoverGate } = require('../../middleware/employeesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390e1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees',
};
const NO_EMPLOYEES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'employees' };

function parseDotEnvFile() {
  const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const parsed = {};
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) parsed[m[1].trim()] = m[2].trim();
  }
  return parsed;
}

function sub(opts = {}) {
  const role = opts.role ?? 'staff';
  return buildSubject({
    user: { id: opts.id ?? ACTOR, role },
    actorDoc: role === 'teacher' || role === 'student'
      ? { role, adminRole: null, permissions: [] }
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [PERMISSIONS.MANAGE_HR],
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyEmployee(subject, action, ctx);
  const policy = evaluatePolicyEmployee(subject, action, ctx, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH', action);
  return { legacy, policy };
}

function withEnv(env, fn) {
  const prevE = process.env.POLICY_CUTOVER_ENABLED;
  const prevR = process.env.POLICY_CUTOVER_ROUTES;
  process.env.POLICY_CUTOVER_ENABLED = env.POLICY_CUTOVER_ENABLED;
  process.env.POLICY_CUTOVER_ROUTES = env.POLICY_CUTOVER_ROUTES;
  try {
    return fn();
  } finally {
    if (prevE === undefined) delete process.env.POLICY_CUTOVER_ENABLED;
    else process.env.POLICY_CUTOVER_ENABLED = prevE;
    if (prevR === undefined) delete process.env.POLICY_CUTOVER_ROUTES;
    else process.env.POLICY_CUTOVER_ROUTES = prevR;
  }
}

function shadowFrom(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyEmployee(subject, action, ctx);
  const policy = evaluatePolicyEmployee(subject, action, ctx, untrusted);
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow, userBranchId }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = employeesCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user,
      userBranchId,
      body: {},
      query: {},
      headers: {},
      policyShadow,
      originalUrl: `/api/employees/${action}`,
      method: 'GET',
      requestId: 'p729',
      correlationId: 'p729',
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ nextCount, statusCode, bodyOut, req });
    };
    const res = {
      status(c) { statusCode = c; return this; },
      json(b) { bodyOut = b; finish(); return this; },
    };
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch(() => finish());
  }));
}

test('Phase7.29 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
});

test('Phase7.29 config ON + employees allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('employees')), AUTHORITY.POLICY);
});

test('Phase7.29 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_EMPLOYEES, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
});

test('Phase7.29 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.29 activation .env includes employees + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees',
      'evaluations', 'exam-results', 'feed', 'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules',
      'settings', 'staff', 'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments', 'quizzes', 'schedules',
    'messages', 'settings', 'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training',
    'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students', 'invoices', 'transactions', 'webhooks']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.29 parity actor matrix', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.MANAGE_HR] });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ role: 'teacher', permissions: [] });
  const student = sub({ role: 'student', permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null });
  const root = buildSubject({ user: { id: 'admin', role: 'admin' }, actorDoc: null });
  const superAdmin = sub({ adminRole: 'SUPER_ADMIN', permissions: [], userBranchId: null });
  const highOk = sub({ adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.MANAGE_HR] });
  const highNone = sub({ adminRole: 'HIGH_ADMIN', permissions: [] });

  for (const action of ['list', 'stats', 'create', 'payroll']) {
    assert.equal(parity(action, staffOk).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, staffNone).policy.decision, 'DENY', action);
    assert.equal(parity(action, teacher).policy.decision, 'DENY', action);
    assert.equal(parity(action, student).policy.decision, 'DENY', action);
    assert.equal(parity(action, unauth).policy.decision, 'DENY', action);
    assert.equal(parity(action, root).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, superAdmin).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, highOk).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, highNone).policy.decision, 'DENY', action);
  }

  for (const action of ['update', 'delete', 'pay']) {
    assert.equal(parity(action, staffOk, { employee: { branchId: BRANCH_A } }).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, staffOk, { employee: { branchId: BRANCH_B } }).policy.decision, 'DENY', action);
    assert.equal(parity(action, staffOk, { employee: null }).policy.decision, 'ALLOW', `${action} missing`);
    assert.equal(
      parity(action, superAdmin, { employee: { branchId: BRANCH_B } }).policy.decision,
      'ALLOW',
      `${action} super unbound`,
    );
  }
});

test('Phase7.29 spoof resistance: role/permissions/branch/tenant cannot elevate', () => {
  const teacher = sub({ role: 'teacher', permissions: [] });
  assert.equal(parity('list', teacher, {}, {
    clientRole: 'staff',
    clientPermissions: [PERMISSIONS.MANAGE_HR],
    bodyBranchId: BRANCH_A,
    bodyTenantId: 't1',
  }).policy.decision, 'DENY');

  const staffOk = sub({ permissions: [PERMISSIONS.MANAGE_HR] });
  assert.equal(parity('update', staffOk, { employee: { branchId: BRANCH_B } }, {
    bodyBranchId: BRANCH_A,
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.MANAGE_HR],
  }).policy.decision, 'DENY');
});

test('Phase7.29 missing resource: Policy ALLOW → handler 404 semantics', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.MANAGE_HR] });
  for (const action of ['update', 'delete', 'pay']) {
    const r = parity(action, staffOk, { employee: null });
    assert.equal(r.policy.decision, 'ALLOW');
    assert.equal(r.legacy.reason, 'missing_employee_handler_404');
  }
});

test('Phase7.29 Policy ALLOW list → next()', async () => {
  const subject = sub({ permissions: [PERMISSIONS.MANAGE_HR] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    userBranchId: BRANCH_A,
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.29 Policy DENY list teacher → 403', async () => {
  const subject = sub({ role: 'teacher', permissions: [] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'teacher' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, '403 Forbidden: Yêu cầu quyền Admin/Staff');
});

test('Phase7.29 Policy DENY missing manage_hr → 403', async () => {
  const subject = sub({ permissions: [] });
  const r = await runGate('stats', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('stats', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền/i);
});

test('Phase7.29 Policy DENY cross-branch update/delete/pay → exact messages', async () => {
  const subject = sub({ permissions: [PERMISSIONS.MANAGE_HR] });
  const ctx = { employee: { branchId: BRANCH_B } };
  const upd = await runGate('update', {
    user: { id: ACTOR, role: 'staff' },
    userBranchId: BRANCH_A,
    policyShadow: shadowFrom('update', subject, ctx),
  }, PROD);
  assert.equal(upd.statusCode, 403);
  assert.equal(upd.bodyOut.message, 'Bạn không có quyền sửa nhân viên chi nhánh khác');

  const del = await runGate('delete', {
    user: { id: ACTOR, role: 'staff' },
    userBranchId: BRANCH_A,
    policyShadow: shadowFrom('delete', subject, ctx),
  }, PROD);
  assert.equal(del.statusCode, 403);
  assert.equal(del.bodyOut.message, 'Không có quyền xóa nhân viên chi nhánh khác');

  const pay = await runGate('pay', {
    user: { id: ACTOR, role: 'staff' },
    userBranchId: BRANCH_A,
    policyShadow: shadowFrom('pay', subject, ctx),
  }, PROD);
  assert.equal(pay.statusCode, 403);
  assert.equal(pay.bodyOut.message, 'Không có quyền trả lương nhân viên chi nhánh khác');
});

test('Phase7.29 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('list', {
    user: null,
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.29 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.29 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('list', sub({ permissions: [PERMISSIONS.MANAGE_HR] }));
  for (const env of [ALL_OFF, NO_EMPLOYEES, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.29 rollback A/B/C: remove employees → LEGACY; global OFF; restore → POLICY', async () => {
  assert.equal(withEnv(NO_EMPLOYEES, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_EMPLOYEES, () => getAuthorizationAuthority('staff')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_EMPLOYEES, () => getAuthorizationAuthority('analytics')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadowFrom('list', sub({ permissions: [PERMISSIONS.MANAGE_HR] })),
  }, NO_EMPLOYEES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('employees')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);

  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('employees')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('staff')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('employees'));
});

test('Phase7.29 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers', 
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.29 middleware order + only employeeRoutes uses employeesCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/employeeRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/employeesCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/employees'"));
  assert.ok(server.includes("require('./routes/employeeRoutes')"));
  assert.ok(routes.includes('employeesCutoverGate'));
  assert.ok(routes.includes('policyShadowEmployee'));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(!routes.includes('checkPermission'));
  assert.ok(gate.includes("getAuthorizationAuthority('employees')"));
  assert.ok(gate.includes('legacyEmployeesGate'));
  assert.ok(gate.includes('MANAGE_HR'));
  assert.ok(!gate.includes('Employee.create'));
  assert.ok(!gate.includes('PayrollLog.create'));
  assert.ok(!gate.includes('emitEmployeesChanged'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'employeeRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('employeesCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`hrGuard('${a}')`), a);
  }
  assert.ok(routes.includes('emitEmployeesChanged'));
  assert.ok(routes.includes('PayrollLog.create'));
});

test('Phase7.29 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/employeesCutoverGate.js',
    'services/policyShadow/employeePolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of [
      '.save(', 'Employee.create', 'PayrollLog.create', 'emitEmployeesChanged',
      'emitDataRefresh', "io.emit(", 'queue.add', 'NotificationService',
    ]) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowEmployee.js'), 'utf8');
  for (const b of ['.save(', 'Employee.create', 'PayrollLog.create', 'emitEmployeesChanged', 'emitDataRefresh', "io.emit("]) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.29 functional smoke: list/stats authz; mutations NOT EXECUTED', () => {
  assert.equal(parity('list', sub({ permissions: [PERMISSIONS.MANAGE_HR] })).policy.decision, 'ALLOW');
  assert.equal(parity('stats', sub({ permissions: [PERMISSIONS.MANAGE_HR] })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — employees create/update/delete/pay production mutations',
    'NOT EXECUTED — employees create/update/delete/pay production mutations',
  );
});

test('Phase7.29 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees(,exam-results(,teachers)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
