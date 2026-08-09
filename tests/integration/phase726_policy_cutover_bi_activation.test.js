/**
 * Phase 7.26 — Controlled cutover + production activation for /api/bi
 *
 * LIVE: auth → branchFilter → policyShadowBI → biCutoverGate → handler.
 * Legacy checkAnyPermission retained inside biCutoverGate.
 * modules/finance BiController is unmounted — not migrated.
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
  evaluateLegacyBI,
  evaluatePolicyBI,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/biPolicy');
const { biCutoverGate } = require('../../middleware/biCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390b1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi',
};
const NO_BI = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'bi' };

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
  const legacy = evaluateLegacyBI(subject, action, ctx);
  const policy = evaluatePolicyBI(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyBI(subject, action, ctx);
  const policy = evaluatePolicyBI(subject, action, ctx, untrusted);
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
    const mw = biCutoverGate(action);
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
      originalUrl: `/api/bi/${action}`,
      method: 'GET',
      requestId: 'p726',
      correlationId: 'p726',
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
    // Legacy path may be async (checkAnyPermission) — finish via next or json
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch(() => finish());
  }));
}

test('Phase7.26 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
});

test('Phase7.26 config ON + bi allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('bi')), AUTHORITY.POLICY);
});

test('Phase7.26 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_BI, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
});

test('Phase7.26 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.26 activation .env includes bi + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees', 'evaluations', 'exam-results', 'feed',
      'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings', 'staff',
      'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'teachers', 'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments', 'quizzes', 'schedules', 'messages', 'settings', 'files',
    'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder',
    'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.26 parity actor matrix', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const staffFinance = sub({ permissions: [PERMISSIONS.MANAGE_FINANCE] });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ role: 'teacher', permissions: [] });
  const student = sub({ role: 'student', permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null });
  const superAdmin = sub({ adminRole: 'SUPER_ADMIN', permissions: [] });

  assert.equal(parity('overview', staffOk).policy.decision, 'ALLOW');
  assert.equal(parity('export', staffFinance).policy.decision, 'ALLOW');
  assert.equal(parity('overview', staffNone).policy.decision, 'DENY');
  assert.equal(parity('export', teacher).policy.decision, 'DENY');
  assert.equal(parity('overview', student).policy.decision, 'DENY');
  assert.equal(parity('overview', unauth).policy.decision, 'DENY');
  assert.equal(parity('overview', superAdmin).policy.decision, 'ALLOW');
});

test('Phase7.26 spoof resistance: role/permissions/branch cannot elevate', () => {
  const teacher = sub({ role: 'teacher', permissions: [] });
  assert.equal(parity('overview', teacher, {}, {
    clientRole: 'staff',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE],
    queryBranchId: BRANCH_A,
    bodyBranchId: BRANCH_A,
  }).policy.decision, 'DENY');

  const staffNone = sub({ permissions: [] });
  assert.equal(parity('export', staffNone, {}, {
    clientPermissions: [PERMISSIONS.MANAGE_FINANCE],
    clientAdminRole: 'SUPER_ADMIN',
  }).policy.decision, 'DENY');
});

test('Phase7.26 Policy ALLOW overview → next()', async () => {
  const subject = sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const r = await runGate('overview', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('overview', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.26 Policy DENY overview teacher → 403', async () => {
  const subject = sub({ role: 'teacher', permissions: [] });
  const r = await runGate('overview', {
    user: { id: ACTOR, role: 'teacher' },
    policyShadow: shadowFrom('overview', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, '403 Forbidden: Yêu cầu quyền Admin/Staff');
});

test('Phase7.26 Policy DENY missing permission → 403', async () => {
  const subject = sub({ permissions: [] });
  const r = await runGate('export', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('export', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền/i);
});

test('Phase7.26 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('overview', {
    user: null,
    policyShadow: shadowFrom('overview', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.26 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('overview', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('overview', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.26 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('overview', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] }));
  for (const env of [ALL_OFF, NO_BI, WILDCARD, MALFORMED]) {
    const r = await runGate('overview', {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.26 rollback: remove bi → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_BI, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_BI, () => getAuthorizationAuthority('evaluations')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_BI, () => getAuthorizationAuthority('proctor')), AUTHORITY.POLICY);

  const rolled = await runGate('overview', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadowFrom('overview', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] })),
  }, NO_BI);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('bi')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('bi')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('evaluations')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('bi'));
});

test('Phase7.26 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees',  'analytics', 'staff',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations', 'bi',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.26 middleware order + only biRoutes uses biCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/biRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/biCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/bi'"));
  assert.ok(server.includes("require('./routes/biRoutes')"));
  assert.ok(!server.includes('BiController'));
  assert.ok(routes.includes('biCutoverGate'));
  assert.ok(routes.includes('policyShadowBI'));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(!routes.includes('checkAnyPermission'));
  assert.ok(gate.includes("getAuthorizationAuthority('bi')"));
  assert.ok(gate.includes('legacyBIGate'));
  assert.ok(gate.includes('checkAnyPermission'));
  assert.ok(gate.includes('MANAGE_FINANCE'));
  assert.ok(gate.includes('VIEW_BRANCH_REVENUE'));
  assert.ok(!gate.includes('biService'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'biRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('biCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`guard('${a}')`), a);
  }
  assert.ok(routes.includes('biService.getOverview'));
  assert.ok(routes.includes('overviewToCsv'));
});

test('Phase7.26 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/biCutoverGate.js',
    'services/policyShadow/biPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', '.create(', 'NotificationService', 'emitDataRefresh', "io.emit(", 'queue.add', "require('../services/biService')"]) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowBI.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', 'emitDataRefresh', "io.emit(", "require('../services/biService')"]) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.26 functional smoke: overview/export authz; biService NOT EXECUTED', () => {
  assert.equal(parity('overview', sub({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] })).policy.decision, 'ALLOW');
  assert.equal(parity('export', sub({ permissions: [PERMISSIONS.MANAGE_FINANCE] })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — biService.getOverview / CSV production read',
    'NOT EXECUTED — biService.getOverview / CSV production read',
  );
});

test('Phase7.26 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
