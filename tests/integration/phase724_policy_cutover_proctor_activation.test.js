/**
 * Phase 7.24 — Controlled cutover + production activation for /api/proctor
 *
 * LIVE: auth → policyShadowProctor → proctorCutoverGate → handler
 * events_user Legacy fallback: isAdmin; ingest/list remain service-owned.
 * modules/exam/routes/proctorRoutes.js is unmounted — not migrated.
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
  evaluateLegacyProctor,
  evaluatePolicyProctor,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/proctorPolicy');
const {
  proctorCutoverGate,
} = require('../../middleware/proctorCutoverGate');

const ROOT = path.join(__dirname, '../..');
const USER_A = '507f1f77bcf86cd7994390u1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor',
};
const NO_PROCTOR = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'proctor' };

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
    user: { id: opts.id ?? USER_A, role },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? BRANCH_A,
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyProctor(subject, action);
  const policy = evaluatePolicyProctor(subject, action, {}, untrusted);
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
  const legacy = evaluateLegacyProctor(subject, action);
  const policy = evaluatePolicyProctor(subject, action, {}, untrusted);
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
    const mw = proctorCutoverGate(action);
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
      originalUrl: `/api/proctor/${action}`,
      method: 'GET',
      requestId: 'p724',
      correlationId: 'p724',
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

test('Phase7.24 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
});

test('Phase7.24 config ON + proctor allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('proctor')), AUTHORITY.POLICY);
});

test('Phase7.24 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_PROCTOR, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
});

test('Phase7.24 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.24 activation .env includes proctor + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('proctor'));
  assert.ok(routes.every((r) => [
    'ai', 'assignments', 'backups', 'blog', 'branches', 'builder', 'courses', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers', 'feed',
    'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings',
    'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
  ].includes(r)));
  for (const fam of [
    'proctor', 'assignments', 'quizzes', 'schedules', 'messages', 'settings', 'files', 'feed',
    'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder',
    'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.24 parity: ingest/me auth-only; events_user admin|staff', () => {
  const staff = sub({ role: 'staff' });
  const teacher = sub({ role: 'teacher', adminRole: null });
  const student = sub({ id: USER_A, role: 'student' });
  const unauth = buildSubject({ user: {}, actorDoc: null });

  for (const action of ['events_ingest', 'events_me']) {
    assert.equal(parity(action, staff).policy.decision, 'ALLOW');
    assert.equal(parity(action, teacher).policy.decision, 'ALLOW');
    assert.equal(parity(action, student).policy.decision, 'ALLOW');
    assert.equal(parity(action, unauth).policy.decision, 'DENY');
  }
  assert.equal(parity('events_user', staff).policy.decision, 'ALLOW');
  assert.equal(parity('events_user', sub({ role: 'admin', adminRole: 'SUPER_ADMIN' })).policy.decision, 'ALLOW');
  assert.equal(parity('events_user', teacher).policy.decision, 'DENY');
  assert.equal(parity('events_user', student).policy.decision, 'DENY');
});

test('Phase7.24 spoof resistance: role/userId/permissions cannot elevate', () => {
  const teacher = sub({ role: 'teacher', adminRole: null, permissions: [] });
  assert.equal(parity('events_user', teacher, {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['manage_everything'],
    bodyUserId: 'admin',
    paramsUserId: USER_A,
    bodyBranchId: BRANCH_A,
    bodyTenantId: 't1',
  }).policy.decision, 'DENY');
});

test('Phase7.24 Policy ALLOW events_me → next()', async () => {
  const subject = sub({ role: 'teacher', adminRole: null });
  const r = await runGate('events_me', {
    user: { id: USER_A, role: 'teacher' },
    policyShadow: shadowFrom('events_me', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.24 Policy DENY events_user teacher → 403 Legacy isAdmin message', async () => {
  const subject = sub({ role: 'teacher', adminRole: null });
  const r = await runGate('events_user', {
    user: { id: USER_A, role: 'teacher' },
    policyShadow: shadowFrom('events_user', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Quyền truy cập bị từ chối: Yêu cầu quyền Admin');
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.24 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('events_me', {
    user: null,
    policyShadow: shadowFrom('events_me', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.24 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('events_me', {
    user: { id: USER_A, role: 'teacher' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('events_me', {
    user: { id: USER_A, role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.24 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('events_me', sub({ role: 'teacher', adminRole: null }));
  for (const env of [ALL_OFF, NO_PROCTOR, WILDCARD, MALFORMED]) {
    const r = await runGate('events_me', {
      user: { id: USER_A, role: 'teacher' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.24 rollback: remove proctor → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_PROCTOR, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_PROCTOR, () => getAuthorizationAuthority('assignments')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_PROCTOR, () => getAuthorizationAuthority('quizzes')), AUTHORITY.POLICY);

  const rolled = await runGate('events_me', {
    user: { id: USER_A, role: 'teacher' },
    policyShadow: shadowFrom('events_me', sub({ role: 'teacher', adminRole: null })),
  }, NO_PROCTOR);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('proctor')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('proctor')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('assignments')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('proctor'));
});

test('Phase7.24 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'evaluations',  'bi',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.24 middleware order + only proctorRoutes uses proctorCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/proctorRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/proctorCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/proctor'"));
  assert.ok(server.includes("require('./routes/proctorRoutes')"));
  assert.ok(!server.includes("require('./modules/exam/routes/proctorRoutes"));
  assert.ok(routes.includes('proctorGuard'));
  assert.ok(routes.includes("proctorGuard('events_ingest')"));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('proctor')"));
  assert.ok(gate.includes('legacyProctorGate'));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(!gate.includes('ingestEvents'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'proctorRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('proctorCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`proctorGuard('${a}')`), a);
  }
  assert.ok(routes.includes('proctorAudit.ingestEvents'));
});

test('Phase7.24 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/proctorCutoverGate.js',
    'services/policyShadow/proctorPolicy.js',
    'middleware/policyShadowProctor.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', '.create(', 'ingestEvents', 'NotificationService', "io.emit(", 'queue.add']) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowProctor.js'), 'utf8');
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.24 functional smoke: authz only; ingest NOT EXECUTED', () => {
  assert.equal(parity('events_me', sub({ role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — proctor ingest/list production mutation',
    'NOT EXECUTED — proctor ingest/list production mutation',
  );
});

test('Phase7.24 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
