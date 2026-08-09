/**
 * Phase 7.11 — Controlled cutover + production activation for /api/courses
 *
 * Reads: PUBLIC (list/get/stats). Writes: auth + internal token + SYSTEM_SETTINGS.
 * No branch/tenant HTTP authz. Ownership none. Mass-assignment preserved in handlers.
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
  evaluateLegacyCourse,
  evaluatePolicyCourse,
  compareDecisions,
  ACTIONS,
  SYSTEM_SETTINGS_LIVE,
} = require('../../services/policyShadow/coursePolicy');
const { coursesCutoverGate, WRITE_ACTIONS } = require('../../middleware/coursesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses',
};
const NO_COURSES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai,workflows,builder',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'courses' };

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
    user: { id: opts.id ?? ACTOR, role, adminRole: opts.adminRole },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : null,
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? null,
    tokenAudience: opts.tokenAudience !== undefined ? opts.tokenAudience : 'internal',
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyCourse(subject, action);
  const policy = evaluatePolicyCourse(subject, action, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH');
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

function shadowFrom(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyCourse(subject, action);
  const policy = evaluatePolicyCourse(subject, action, untrusted);
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, tokenAudience, policyShadow }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = coursesCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user,
      tokenAudience,
      body: {},
      query: {},
      headers: {},
      policyShadow,
      originalUrl: `/api/courses/${action}`,
      method: 'GET',
      requestId: 'p711',
      correlationId: 'p711',
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
    mw(req, res, () => { nextCount += 1; finish(); });
  }));
}

// ── Config ───────────────────────────────────────────────────────────────────

test('Phase7.11 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);
});

test('Phase7.11 config ON + courses allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('courses')), AUTHORITY.POLICY);
});

test('Phase7.11 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_COURSES, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);
});

test('Phase7.11 malformed / wildcard → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);
});

test('Phase7.11 activation .env includes courses + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses']) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of ['courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity / actor matrix ────────────────────────────────────────────────────

test('Phase7.11 public reads ALLOW for all actors including unauthenticated', () => {
  const actors = [
    sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }),
    sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }),
    sub({ role: 'staff', adminRole: 'STAFF', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }),
    sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [] }),
    sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] }),
    sub({ id: 's1', role: 'student', tokenAudience: null }),
    buildSubject({ user: {}, actorDoc: null, tokenAudience: null }),
  ];
  for (const action of ['list', 'get', 'stats']) {
    for (const subject of actors) {
      assert.equal(parity(action, subject).policy.decision, 'ALLOW');
    }
  }
});

test('Phase7.11 write matrix: SUPER/hardcoded/admin+settings ALLOW; others DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'DENY'],
    [sub({ id: 's1', role: 'student', tokenAudience: 'internal' }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null, tokenAudience: null }), 'DENY'],
  ];
  for (const action of WRITE_ACTIONS) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}`);
    }
  }
});

test('Phase7.11 internal token required for writes; public token DENY', () => {
  const pub = sub({
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
    tokenAudience: 'public',
  });
  const { legacy, policy } = parity('create', pub);
  assert.equal(policy.decision, 'DENY');
  assert.equal(legacy.reason, 'internal_token_required');
});

test('Phase7.11 branch/tenant are data filters only — not HTTP authz on courses', () => {
  const ok = sub({
    role: 'staff',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
    userBranchId: 'branch-a',
  });
  assert.equal(
    parity('create', ok, { bodyBranchId: 'other', bodyTenantId: 't-x' }).policy.decision,
    'ALLOW',
  );
  assert.equal(parity('list', ok, { bodyBranchId: 'other' }).policy.decision, 'ALLOW');
});

// ── Gate ALLOW/DENY/fallback ─────────────────────────────────────────────────

test('Phase7.11 Policy ALLOW public list next() without auth', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null, tokenAudience: null });
  const r = await runGate('list', {
    user: undefined,
    tokenAudience: null,
    policyShadow: shadowFrom('list', anon),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.11 Policy ALLOW write with settings + internal token', async () => {
  const staff = sub({ role: 'staff', permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const r = await runGate('create', {
    user: { id: ACTOR, role: 'staff' },
    tokenAudience: 'internal',
    policyShadow: shadowFrom('create', staff),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.11 Policy DENY write missing permission → 403', async () => {
  const staff = sub({ role: 'staff', permissions: [] });
  const r = await runGate('update', {
    user: { id: ACTOR, role: 'staff' },
    tokenAudience: 'internal',
    policyShadow: shadowFrom('update', staff),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.11 Policy DENY write public token → INTERNAL_TOKEN_REQUIRED', async () => {
  const staff = sub({
    role: 'staff',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
    tokenAudience: 'public',
  });
  const r = await runGate('delete', {
    user: { id: ACTOR, role: 'staff' },
    tokenAudience: 'public',
    policyShadow: shadowFrom('delete', staff),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.code, 'INTERNAL_TOKEN_REQUIRED');
});

test('Phase7.11 Policy ERROR write → Legacy requireInternalToken (never fail-open)', async () => {
  // public audience → Legacy requireInternalToken DENY 403 without DB lookup
  const r = await runGate('create', {
    user: { id: ACTOR, role: 'staff' },
    tokenAudience: 'public',
    policyShadow: { comparison: 'ERROR', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.code, 'INTERNAL_TOKEN_REQUIRED');
  assert.equal(r.nextCount, 0);
});

test('Phase7.11 Policy UNKNOWN public list → Legacy pass-through (never fail-open deny)', async () => {
  const r = await runGate('list', {
    user: undefined,
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'DENY' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.11 Policy ERROR public get → Legacy pass-through', async () => {
  const r = await runGate('get', {
    user: undefined,
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

// ── Spoof / side effects / middleware ────────────────────────────────────────

test('Phase7.11 spoof resistance: role/permissions/branch/tenant cannot escalate', () => {
  const teacher = sub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [],
    tokenAudience: 'internal',
  });
  const spoof = {
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS, '*'],
    bodyBranchId: 'b',
    bodyTenantId: 't',
  };
  assert.equal(parity('create', teacher, spoof).policy.decision, 'DENY');
  assert.equal(
    getAuthorizationAuthority('courses', { body: { POLICY_CUTOVER_ENABLED: 'false' } }, PROD),
    AUTHORITY.POLICY,
  );
});

test('Phase7.11 side-effect isolation: gate/shadow/policy no Course mutation/notify', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/coursesCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowCourse.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/coursePolicy.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/courseRoutes.js'), 'utf8');
  for (const src of [gate, shadow, policy]) {
    assert.ok(!src.includes('Course.create'));
    assert.ok(!src.includes('findByIdAndUpdate'));
    assert.ok(!src.includes('NotificationService'));
    assert.ok(!src.includes('writeAudit'));
    assert.ok(!src.includes('.emit('));
    assert.ok(!src.includes('enqueue('));
  }
  assert.ok(routes.includes('Course.create'));
  assert.ok(routes.includes('NotificationService'));
  assert.ok(routes.includes('writeAudit'));
  assert.ok(routes.includes('const body = { ...req.body }'));
});

test('Phase7.11 middleware order: public read has no auth; write has auth before shadow/cutover', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/courseRoutes.js'), 'utf8');
  assert.ok(routes.includes('courseReadGuard'));
  assert.ok(routes.includes('courseWriteGuard'));
  assert.ok(routes.includes('coursesCutoverGate'));
  assert.ok(routes.indexOf('authMiddleware') < routes.indexOf('coursesCutoverGate') || routes.includes('authMiddleware'));
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/coursesCutoverGate.js'), 'utf8');
  assert.ok(gate.includes('requireInternalToken'));
  assert.ok(gate.includes("checkPermission('system_settings')"));
  assert.equal(SYSTEM_SETTINGS_LIVE, 'system_settings');
});

// ── Rollback / isolation / smoke / static ────────────────────────────────────

test('Phase7.11 rollback: remove courses → LEGACY; prior families stay POLICY; restore → POLICY', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null, tokenAudience: null });
  const shadow = shadowFrom('list', anon);

  assert.equal(withEnv(NO_COURSES, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_COURSES, () => getAuthorizationAuthority('builder')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_COURSES, () => getAuthorizationAuthority('workflows')), AUTHORITY.POLICY);

  const rolled = await runGate('list', { user: undefined, policyShadow: shadow }, NO_COURSES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(rolled.nextCount, 1);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);

  const restored = await runGate('list', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('courses'));
  assert.ok(restoredRoutes.includes('builder'));
  assert.ok(restoredRoutes.includes('backups'));
});

test('Phase7.11 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'training', 'quizzes', 'assignments', 'evaluations',  'proctor',
    'files', 'blog', 'feed', 'schedules', 'messages', 'notifications',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses']) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.11 functional smoke: list/get/stats authz PASS; mutations NOT EXECUTED', () => {
  const anon = buildSubject({ user: {}, actorDoc: null, tokenAudience: null });
  for (const action of ['list', 'get', 'stats']) {
    assert.equal(parity(action, anon).policy.decision, 'ALLOW');
  }
  assert.equal(
    'NOT EXECUTED — create/update/price/delete/restore/seed production mutation',
    'NOT EXECUTED — create/update/price/delete/restore/seed production mutation',
  );
  assert.ok(ACTIONS.has('seed'));
  assert.ok(WRITE_ACTIONS.has('delete'));
});

test('Phase7.11 static final authority + CQRS OFF + only courses uses gate', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/courseRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/coursesCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses(,training(,training-lms(,branches(,notifications(,blog(,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1]));

  assert.ok(gate.includes("getAuthorizationAuthority('courses')"));
  assert.ok(gate.includes('legacyCourseGate'));
  assert.ok(routes.includes('coursesCutoverGate'));
  assert.ok(server.includes("app.use('/api/courses'"));
  assert.ok(!server.includes("require('./modules/course"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'courseRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('coursesCutoverGate'), name);
  }
});
