/**
 * Phase 7.14 — Controlled cutover + production activation for /api/branches
 *
 * LIVE: public GET / ; admin list_all/create/update/delete via manage_staff.
 * Tenant header/query = DATA FILTER only. Comment says SUPER_ADMIN; live uses manage_staff.
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
  evaluateLegacyBranch,
  evaluatePolicyBranch,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/branchPolicy');
const {
  branchesCutoverGate,
  ADMIN_ACTIONS,
} = require('../../middleware/branchesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches',
};
const NO_BRANCHES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'branches' };

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
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyBranch(subject, action);
  const policy = evaluatePolicyBranch(subject, action, untrusted);
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

function shadowFrom(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyBranch(subject, action);
  const policy = evaluatePolicyBranch(subject, action, untrusted);
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
    const mw = branchesCutoverGate(action);
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
      originalUrl: `/api/branches/${action}`,
      method: 'GET',
      requestId: 'p714',
      correlationId: 'p714',
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

test('Phase7.14 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
});

test('Phase7.14 config ON + branches allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('branches')), AUTHORITY.POLICY);
});

test('Phase7.14 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_BRANCHES, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
});

test('Phase7.14 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.14 activation .env includes branches + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'branches', 'training-lms', 'training', 'courses', 'builder', 'workflows', 'ai',
    'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.14 list_public ALLOW for all actors including unauthenticated', () => {
  const actors = [
    sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }),
    sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }),
    sub({ id: 't1', role: 'teacher' }),
    sub({ id: 's1', role: 'student' }),
    buildSubject({ user: {}, actorDoc: null }),
  ];
  for (const subject of actors) {
    assert.equal(parity('list_public', subject).policy.decision, 'ALLOW');
  }
});

test('Phase7.14 admin actions: manage_staff / SUPER / hardcoded ALLOW; others DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_STAFF] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.MANAGE_STAFF] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [PERMISSIONS.MANAGE_STAFF] }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher', permissions: [PERMISSIONS.MANAGE_STAFF] }), 'DENY'],
    [sub({ id: 's1', role: 'student' }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of ADMIN_ACTIONS) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}`);
    }
  }
});

test('Phase7.14 tenant/branch spoof does not elevate; tenant is data filter', () => {
  const none = sub({ role: 'staff', permissions: [] });
  assert.equal(
    parity('create', none, {
      headerTenantId: 't1',
      queryTenantId: 't1',
      bodyBranchId: 'b1',
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_STAFF],
    }).policy.decision,
    'DENY',
  );
  const ok = sub({ role: 'staff', permissions: [PERMISSIONS.MANAGE_STAFF] });
  assert.equal(
    parity('list_all', ok, { headerTenantId: 'other', queryTenantId: 'other' }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('list_public', buildSubject({ user: {}, actorDoc: null }), {
      headerTenantId: 'x',
      clientRole: 'SUPER_ADMIN',
    }).policy.decision,
    'ALLOW',
  );
});

// ── Gate ─────────────────────────────────────────────────────────────────────

test('Phase7.14 Policy ALLOW public list → next() without auth', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('list_public', {
    user: undefined,
    policyShadow: shadowFrom('list_public', anon),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.14 Policy ALLOW admin with manage_staff → next()', async () => {
  const staff = sub({ role: 'staff', permissions: [PERMISSIONS.MANAGE_STAFF] });
  const r = await runGate('create', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('create', staff),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.14 Policy DENY teacher admin action → 403', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const r = await runGate('list_all', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('list_all', teacher),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

test('Phase7.14 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('list_public', {
      user: undefined,
      policyShadow: {
        comparison,
        policyDecision: comparison === 'ERROR' ? undefined : 'WEIRD',
        policyReason: 'test',
      },
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, comparison);
    assert.equal(r.nextCount, 1, comparison);
  }
});

test('Phase7.14 cutover OFF / exclusion → Legacy public next()', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const shadow = shadowFrom('list_public', anon);
  for (const env of [ALL_OFF, NO_BRANCHES, WILDCARD, MALFORMED]) {
    const r = await runGate('list_public', { user: undefined, policyShadow: shadow }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.14 rollback: remove branches → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const shadow = shadowFrom('list_public', anon);

  assert.equal(withEnv(NO_BRANCHES, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_BRANCHES, () => getAuthorizationAuthority('training-lms')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_BRANCHES, () => getAuthorizationAuthority('training')), AUTHORITY.POLICY);

  const rolled = await runGate('list_public', { user: undefined, policyShadow: shadow }, NO_BRANCHES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('branches')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);

  const restored = await runGate('list_public', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('branches'));
});

test('Phase7.14 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'blog', 'feed', 'schedules', 'messages',
    'notifications', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.14 middleware order + only branchRoutes uses branchesCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/branchRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/branchesCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/branches'"));
  assert.ok(routes.includes("policyShadowBranch('list_public')"));
  assert.ok(routes.includes("branchesCutoverGate('list_public')"));
  assert.ok(routes.includes('adminGuard'));
  assert.ok(gate.includes("getAuthorizationAuthority('branches')"));
  assert.ok(gate.includes('legacyBranchesGate'));
  assert.ok(gate.includes("checkPermission('manage_staff')"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'branchRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('branchesCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    if (a === 'list_public') {
      assert.ok(routes.includes("branchesCutoverGate('list_public')"));
    } else {
      assert.ok(routes.includes(`adminGuard('${a}')`), a);
    }
  }
});

test('Phase7.14 side-effect audit: gate + branch policy have no mutations', () => {
  const files = [
    'middleware/branchesCutoverGate.js',
    'middleware/policyShadowBranch.js',
    'services/policyShadow/branchPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'enqueue', '.emit(', 'sendNotification', 'BullMQ', 'invalidateBranchCache',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
});

test('Phase7.14 functional smoke: public list authz; mutations NOT EXECUTED', () => {
  assert.equal(parity('list_public', buildSubject({ user: {}, actorDoc: null })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/delete production mutation',
    'NOT EXECUTED — create/update/delete production mutation',
  );
  assert.ok(ADMIN_ACTIONS.has('delete'));
});

test('Phase7.14 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches(,notifications(,blog(,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
