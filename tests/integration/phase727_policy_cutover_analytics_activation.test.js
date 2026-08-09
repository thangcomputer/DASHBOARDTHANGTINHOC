/**
 * Phase 7.27 — Controlled cutover + production activation for /api/analytics
 *
 * LIVE: auth → branchFilter → policyShadowAnalytics → analyticsCutoverGate → handler.
 * Legacy checkAnyPermission retained inside analyticsCutoverGate.
 * modules/analytics twin is unmounted — not migrated.
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
  evaluateLegacyAnalytics,
  evaluatePolicyAnalytics,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/analyticsPolicy');
const { analyticsCutoverGate } = require('../../middleware/analyticsCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390a1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics',
};
const NO_ANALYTICS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'analytics' };

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
    actorDoc: role === 'student' || role === 'teacher'
      ? { role, adminRole: null, permissions: [] }
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [PERMISSIONS.VIEW_BRANCH_REVENUE],
        },
    userBranchId: opts.userBranchId ?? BRANCH_A,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyAnalytics(subject, action, ctx);
  const policy = evaluatePolicyAnalytics(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyAnalytics(subject, action, ctx);
  const policy = evaluatePolicyAnalytics(subject, action, ctx, untrusted);
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
    const mw = analyticsCutoverGate(action);
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
      originalUrl: `/api/analytics/${action}`,
      method: 'GET',
      requestId: 'p727',
      correlationId: 'p727',
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

test('Phase7.27 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
});

test('Phase7.27 config ON + analytics allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('analytics')), AUTHORITY.POLICY);
});

test('Phase7.27 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_ANALYTICS, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
});

test('Phase7.27 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.27 activation .env includes analytics + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees', 'evaluations', 'exam-results',
      'feed', 'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings', 'staff',
      'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'teachers', 'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments', 'quizzes', 'schedules', 'messages', 'settings',
    'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder',
    'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.27 parity actor matrix', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const staffFinance = sub({ permissions: [PERMISSIONS.MANAGE_FINANCE] });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ role: 'teacher', permissions: [] });
  const student = sub({ role: 'student', permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null });
  const superAdmin = sub({ adminRole: 'SUPER_ADMIN', permissions: [] });

  assert.equal(parity('revenue', staffOk).policy.decision, 'ALLOW');
  assert.equal(parity('enrollment', staffFinance).policy.decision, 'ALLOW');
  assert.equal(parity('branches', staffOk).policy.decision, 'ALLOW');
  assert.equal(parity('revenue', staffNone).policy.decision, 'DENY');
  assert.equal(parity('enrollment', teacher).policy.decision, 'DENY');
  assert.equal(parity('branches', student).policy.decision, 'DENY');
  assert.equal(parity('revenue', unauth).policy.decision, 'DENY');
  assert.equal(parity('branches', superAdmin).policy.decision, 'ALLOW');
});

test('Phase7.27 spoof resistance: role/permissions/branch cannot elevate', () => {
  const teacher = sub({ role: 'teacher', permissions: [] });
  assert.equal(parity('revenue', teacher, {}, {
    clientRole: 'staff',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE],
    queryBranchId: BRANCH_A,
    bodyBranchId: BRANCH_A,
  }).policy.decision, 'DENY');

  const staffNone = sub({ permissions: [] });
  assert.equal(parity('branches', staffNone, {}, {
    clientPermissions: [PERMISSIONS.MANAGE_FINANCE],
    clientAdminRole: 'SUPER_ADMIN',
  }).policy.decision, 'DENY');
});

test('Phase7.27 Policy ALLOW revenue → next()', async () => {
  const subject = sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const r = await runGate('revenue', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('revenue', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.27 Policy DENY revenue teacher → 403', async () => {
  const subject = sub({ role: 'teacher', permissions: [] });
  const r = await runGate('revenue', {
    user: { id: ACTOR, role: 'teacher' },
    policyShadow: shadowFrom('revenue', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, '403 Forbidden: Yêu cầu quyền Admin/Staff');
});

test('Phase7.27 Policy DENY missing permission → 403', async () => {
  const subject = sub({ permissions: [] });
  const r = await runGate('enrollment', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('enrollment', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền/i);
});

test('Phase7.27 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('branches', {
    user: null,
    policyShadow: shadowFrom('branches', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.27 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('revenue', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('revenue', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.27 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('revenue', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] }));
  for (const env of [ALL_OFF, NO_ANALYTICS, WILDCARD, MALFORMED]) {
    const r = await runGate('revenue', {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.27 rollback: remove analytics → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_ANALYTICS, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_ANALYTICS, () => getAuthorizationAuthority('bi')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_ANALYTICS, () => getAuthorizationAuthority('evaluations')), AUTHORITY.POLICY);

  const rolled = await runGate('revenue', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadowFrom('revenue', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] })),
  }, NO_ANALYTICS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('analytics')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('analytics')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('bi')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('analytics'));
});

test('Phase7.27 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees',  'staff',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations', 'bi', 'analytics',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.27 middleware order + only analyticsRoutes uses analyticsCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/analyticsRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/analyticsCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/analytics'"));
  assert.ok(server.includes("require('./routes/analyticsRoutes')"));
  assert.ok(!server.includes("modules/analytics"));
  assert.ok(routes.includes('analyticsCutoverGate'));
  assert.ok(routes.includes('policyShadowAnalytics'));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(!routes.includes('checkAnyPermission'));
  assert.ok(gate.includes("getAuthorizationAuthority('analytics')"));
  assert.ok(gate.includes('legacyAnalyticsGate'));
  assert.ok(gate.includes('checkAnyPermission'));
  assert.ok(gate.includes('MANAGE_FINANCE'));
  assert.ok(gate.includes('VIEW_BRANCH_REVENUE'));
  assert.ok(!gate.includes('sumFinancialRevenue'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'analyticsRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('analyticsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`guard('${a}')`), a);
  }
  assert.ok(routes.includes('sumFinancialRevenue'));
  assert.ok(routes.includes('buildBaseFilter'));
});

test('Phase7.27 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/analyticsCutoverGate.js',
    'services/policyShadow/analyticsPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', '.create(', 'NotificationService', 'emitDataRefresh', "io.emit(", 'queue.add', 'sumFinancialRevenue']) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowAnalytics.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', 'emitDataRefresh', "io.emit(", 'sumFinancialRevenue']) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.27 functional smoke: revenue/enrollment/branches authz; aggregates NOT EXECUTED', () => {
  assert.equal(parity('revenue', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] })).policy.decision, 'ALLOW');
  assert.equal(parity('enrollment', sub({ permissions: [PERMISSIONS.MANAGE_FINANCE] })).policy.decision, 'ALLOW');
  assert.equal(parity('branches', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — analytics revenue/enrollment/branches production reads',
    'NOT EXECUTED — analytics revenue/enrollment/branches production reads',
  );
});

test('Phase7.27 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
