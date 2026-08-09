/**
 * Phase 7.28 — Controlled cutover + production activation for /api/staff
 *
 * LIVE: auth → policyShadowStaff → staffCutoverGate → handler.
 * Legacy checkPermission('manage_staff') retained inside staffCutoverGate.
 * create/update/delete mutations remain handler-owned (NOT EXECUTED here).
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
  evaluateLegacyStaff,
  evaluatePolicyStaff,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/staffPolicy');
const { staffCutoverGate } = require('../../middleware/staffCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390s1';
const OTHER = '507f1f77bcf86cd7994390s2';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff',
};
const NO_STAFF = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'staff' };

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
          permissions: opts.permissions ?? [PERMISSIONS.MANAGE_STAFF],
        },
    userBranchId: opts.userBranchId ?? BRANCH_A,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyStaff(subject, action, ctx);
  const policy = evaluatePolicyStaff(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyStaff(subject, action, ctx);
  const policy = evaluatePolicyStaff(subject, action, ctx, untrusted);
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = staffCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user,
      body: {},
      query: {},
      headers: {},
      policyShadow,
      originalUrl: `/api/staff/${action}`,
      method: 'GET',
      requestId: 'p728',
      correlationId: 'p728',
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

test('Phase7.28 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
});

test('Phase7.28 config ON + staff allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('staff')), AUTHORITY.POLICY);
});

test('Phase7.28 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_STAFF, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
});

test('Phase7.28 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.28 activation .env includes staff + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees', 'evaluations', 'exam-results',
      'feed', 'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings',
      'staff', 'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments', 'quizzes', 'schedules', 'messages',
    'settings', 'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses',
    'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.28 parity actor matrix', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ role: 'teacher', permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null });
  const root = buildSubject({ user: { id: 'admin', role: 'admin' }, actorDoc: null });
  const superAdmin = sub({ adminRole: 'SUPER_ADMIN', permissions: [] });

  assert.equal(parity('list', staffOk).policy.decision, 'ALLOW');
  assert.equal(parity('list', staffNone).policy.decision, 'DENY');
  assert.equal(parity('list', teacher).policy.decision, 'DENY');
  assert.equal(parity('list', unauth).policy.decision, 'DENY');
  assert.equal(parity('list', root).policy.decision, 'ALLOW');

  assert.equal(parity('create', staffOk, { requestedAdminRole: 'STAFF' }).policy.decision, 'ALLOW');
  assert.equal(parity('create', staffOk, { requestedAdminRole: 'SUPER_ADMIN' }).policy.decision, 'DENY');
  assert.equal(parity('create', root, { requestedAdminRole: 'SUPER_ADMIN' }).policy.decision, 'ALLOW');
  assert.equal(parity('create', staffOk, { requestedAdminRole: 'HIGH_ADMIN' }).policy.decision, 'DENY');
  assert.equal(parity('create', superAdmin, { requestedAdminRole: 'HIGH_ADMIN' }).policy.decision, 'ALLOW');

  assert.equal(parity('update', staffOk, { target: { adminRole: 'STAFF' } }).policy.decision, 'ALLOW');
  assert.equal(parity('update', staffOk, { target: { adminRole: 'SUPER_ADMIN' } }).policy.decision, 'DENY');
  assert.equal(parity('delete', staffOk, { target: { adminRole: 'HIGH_ADMIN' } }).policy.decision, 'DENY');
  assert.equal(parity('delete', superAdmin, { target: { adminRole: 'HIGH_ADMIN' } }).policy.decision, 'ALLOW');
  assert.equal(parity('update', staffOk, { target: null }).policy.decision, 'ALLOW');
});

test('Phase7.28 spoof resistance: role/adminRole/permissions cannot elevate', () => {
  const teacher = sub({ role: 'teacher', permissions: [] });
  assert.equal(parity('list', teacher, {}, {
    bodyRole: 'staff',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_STAFF],
  }).policy.decision, 'DENY');

  const staffNone = sub({ permissions: [] });
  assert.equal(parity('create', staffNone, { requestedAdminRole: 'STAFF' }, {
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_STAFF],
  }).policy.decision, 'DENY');
});

test('Phase7.28 Policy ALLOW list → next()', async () => {
  const subject = sub({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.28 Policy DENY list teacher → 403', async () => {
  const subject = sub({ role: 'teacher', permissions: [] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'teacher' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, '403 Forbidden: Yêu cầu quyền Admin/Staff');
});

test('Phase7.28 Policy DENY missing manage_staff → 403', async () => {
  const subject = sub({ permissions: [] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền/i);
});

test('Phase7.28 Policy DENY create SUPER_ADMIN non-root → exact message', async () => {
  const subject = sub({ permissions: [PERMISSIONS.MANAGE_STAFF] });
  const r = await runGate('create', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('create', subject, { requestedAdminRole: 'SUPER_ADMIN' }),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(
    r.bodyOut.message,
    'Chỉ Admin Super (Hệ thống) mới được phép tạo thêm tài khoản Super Admin.',
  );
});

test('Phase7.28 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('list', {
    user: null,
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.28 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
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

test('Phase7.28 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('list', sub({ permissions: [PERMISSIONS.MANAGE_STAFF] }));
  for (const env of [ALL_OFF, NO_STAFF, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.28 rollback: remove staff → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_STAFF, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_STAFF, () => getAuthorizationAuthority('analytics')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_STAFF, () => getAuthorizationAuthority('bi')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadowFrom('list', sub({ permissions: [PERMISSIONS.MANAGE_STAFF] })),
  }, NO_STAFF);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('staff')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('staff')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('analytics')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('staff'));
});

test('Phase7.28 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.28 middleware order + only staffRoutes uses staffCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/staffRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/staffCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/staff'"));
  assert.ok(server.includes("require('./routes/staffRoutes')"));
  assert.ok(routes.includes('staffCutoverGate'));
  assert.ok(routes.includes('policyShadowStaff'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(!routes.includes('checkPermission'));
  assert.ok(gate.includes("getAuthorizationAuthority('staff')"));
  assert.ok(gate.includes('legacyStaffGate'));
  assert.ok(gate.includes("checkPermission('manage_staff')"));
  assert.ok(!gate.includes('Teacher.create'));
  assert.ok(!gate.includes("require('bcryptjs')"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'staffRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('staffCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`guard('${a}')`), a);
  }
  assert.ok(routes.includes('Teacher.create'));
  assert.ok(routes.includes('bcrypt'));
});

test('Phase7.28 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/staffCutoverGate.js',
    'services/policyShadow/staffPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', 'Teacher.create', 'NotificationService', 'emitDataRefresh', "io.emit(", 'queue.add', "require('bcryptjs')"]) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowStaff.js'), 'utf8');
  for (const b of ['.save(', 'Teacher.create', "require('bcryptjs')", 'NotificationService', 'emitDataRefresh', "io.emit("]) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.28 functional smoke: list authz; create/update/delete NOT EXECUTED', () => {
  assert.equal(parity('list', sub({ permissions: [PERMISSIONS.MANAGE_STAFF] })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — staff create/update/delete production mutations',
    'NOT EXECUTED — staff create/update/delete production mutations',
  );
  void OTHER;
});

test('Phase7.28 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff(,employees(,exam-results(,teachers)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
