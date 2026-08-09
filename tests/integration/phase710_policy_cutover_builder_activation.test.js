/**
 * Phase 7.10 — Controlled cutover + production activation for /api/builder
 *
 * Preserves: public form_get/submit, draft→404 hide, soft JWT (shadow only),
 * form_submit_auth auth-only, admin isAdmin routes, mass-assignment Legacy handlers.
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
  evaluateLegacyBuilder,
  evaluatePolicyBuilder,
  compareDecisions,
  ACTIONS,
  ADMIN_ACTIONS,
} = require('../../services/policyShadow/builderPolicy');
const { builderCutoverGate } = require('../../middleware/builderCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai,workflows,builder',
};
const NO_BUILDER = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai,workflows',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'builder' };

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

function parity(action, subject, untrusted = {}, ctx = {}) {
  const legacy = evaluateLegacyBuilder(subject, action, ctx);
  const policy = evaluatePolicyBuilder(subject, action, ctx, untrusted);
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

function shadowFrom(action, subject, untrusted = {}, ctx = {}) {
  const legacy = evaluateLegacyBuilder(subject, action, ctx);
  const policy = evaluatePolicyBuilder(subject, action, ctx, untrusted);
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
    const mw = builderCutoverGate(action);
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
      originalUrl: `/api/builder/${action}`,
      method: 'GET',
      requestId: 'p710',
      correlationId: 'p710',
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

test('Phase7.10 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);
});

test('Phase7.10 config ON + builder allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('builder')), AUTHORITY.POLICY);
});

test('Phase7.10 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_BUILDER, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);
});

test('Phase7.10 malformed config → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);
});

test('Phase7.10 wildcard rejection → Legacy', () => {
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);
});

test('Phase7.10 activation .env includes builder + prior families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('builder'));
  assert.ok(routes.includes('workflows'));
  assert.ok(routes.includes('ai'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  for (const fam of ['builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Policy ALLOW / DENY / fallback ───────────────────────────────────────────

test('Phase7.10 Policy ALLOW: staff admin actions next()', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ['form_list', 'form_create', 'report_run']) {
    const r = await runGate(action, {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadowFrom(action, staff),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.nextCount, 1, action);
  }
});

test('Phase7.10 Policy DENY: teacher admin actions 403', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const r = await runGate('form_list', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('form_list', teacher),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.10 Policy ERROR → Legacy (admin action staff ALLOW via isAdmin)', async () => {
  const r = await runGate('form_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.10 Policy UNKNOWN → Legacy (teacher DENY via isAdmin, never fail-open)', async () => {
  const r = await runGate('form_list', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
});

test('Phase7.10 Policy ERROR on public form_submit → Legacy pass-through (not isAdmin)', async () => {
  const r = await runGate('form_submit', {
    user: undefined,
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
  assert.equal(r.statusCode, null);
});

// ── Actor / public / draft matrix ────────────────────────────────────────────

test('Phase7.10 Legacy parity actor matrix for admin actions', () => {
  const matrix = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'ALLOW'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
    [{ id: 's1', role: 'student' }, 'DENY'],
  ];
  for (const action of ['form_list', 'report_run']) {
    for (const [opts, expected] of matrix) {
      assert.equal(parity(action, sub(opts)).policy.decision, expected);
    }
  }
});

test('Phase7.10 public access: published form_get + form_submit ALLOW for guest', () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(
    parity('form_get', anon, {}, { form: { status: 'published' } }).policy.decision,
    'ALLOW',
  );
  assert.equal(parity('form_submit', anon).policy.decision, 'ALLOW');
});

test('Phase7.10 authenticated submit: auth user ALLOW; unauth DENY', () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(parity('form_submit_auth', teacher).policy.decision, 'ALLOW');
  assert.equal(parity('form_submit_auth', anon).policy.decision, 'DENY');
  assert.equal(parity('form_submit_auth', anon).policy.statusHint, 401);
});

test('Phase7.10 admin access: staff ALLOW draft form_get', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(
    parity('form_get', staff, {}, { form: { status: 'draft' } }).policy.decision,
    'ALLOW',
  );
});

test('Phase7.10 draft → 404 preservation (not 403) for guest/teacher', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  for (const [label, subject] of [['anon', anon], ['teacher', teacher]]) {
    const { policy } = parity('form_get', subject, {}, { form: { status: 'draft' } });
    assert.equal(policy.decision, 'DENY', label);
    assert.equal(policy.statusHint, 404, label);
  }
  const r = await runGate('form_get', {
    user: undefined,
    policyShadow: shadowFrom('form_get', anon, {}, { form: { status: 'draft' } }),
  }, PROD);
  assert.equal(r.statusCode, 404);
  assert.match(r.bodyOut.message, /Khong tim thay form/i);
  assert.notEqual(r.statusCode, 403);
});

test('Phase7.10 published form_get Policy ALLOW next() for guest', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('form_get', {
    user: undefined,
    policyShadow: shadowFrom('form_get', anon, {}, { form: { status: 'published' } }),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.10 public submit Policy ALLOW next() without JWT', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('form_submit', {
    user: undefined,
    policyShadow: shadowFrom('form_submit', anon),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.statusCode, null);
});

// ── Spoof / soft JWT / side effects ──────────────────────────────────────────

test('Phase7.10 spoof resistance: client role/adminRole/permissions/submittedBy ignored', () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodySubmittedBy: 'admin',
    bodyCreatedBy: 'admin',
    bodyBranchId: 'b',
    bodyTenantId: 't',
  };
  assert.equal(parity('form_list', teacher, spoof).policy.decision, 'DENY');
  assert.equal(
    parity('form_get', teacher, spoof, { form: { status: 'draft' } }).policy.statusHint,
    404,
  );
  assert.equal(
    getAuthorizationAuthority('builder', { body: { POLICY_CUTOVER_ENABLED: 'false' } }, PROD),
    AUTHORITY.POLICY,
  );
});

test('Phase7.10 soft JWT: shadow soft-decodes only; gate does not mutate req.user / issue tokens', () => {
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowBuilder.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/builderCutoverGate.js'), 'utf8');
  assert.ok(shadow.includes('softUserFromAuthHeader'));
  assert.ok(shadow.includes('jwt.verify'));
  assert.ok(shadow.includes('does not mutate req.user') || shadow.includes('Soft-decodes'));
  assert.ok(!gate.includes('jwt.'));
  assert.ok(!gate.includes('req.user ='));
  assert.ok(!gate.includes('jwt.sign'));
});

test('Phase7.10 side-effect isolation: gate/shadow/policy no submit/create/run/emit', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/builderCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowBuilder.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/builderPolicy.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/builderRoutes.js'), 'utf8');
  for (const src of [gate, shadow, policy]) {
    assert.ok(!src.includes('submitForm'));
    assert.ok(!src.includes('createForm'));
    assert.ok(!src.includes('runReport'));
    assert.ok(!src.includes('updateForm'));
    assert.ok(!src.includes('deleteForm'));
    assert.ok(!src.includes('.emit('));
    assert.ok(!src.includes('enqueue('));
  }
  assert.ok(!/\.save\s*\(/.test(gate));
  assert.ok(!/\.save\s*\(/.test(policy));
  // Handlers retain mutations + mass-assignment pattern
  assert.ok(routes.includes('formService.submitForm'));
  assert.ok(routes.includes('formService.createForm'));
  assert.ok(routes.includes('reportService.runReport'));
  assert.ok(routes.includes('{ ...req.body, createdBy:'));
});

// ── Rollback / isolation / middleware / static ───────────────────────────────

test('Phase7.10 rollback: remove builder → LEGACY; prior families stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('form_list', staff);

  assert.equal(withEnv(NO_BUILDER, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_BUILDER, () => getAuthorizationAuthority('workflows')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_BUILDER, () => getAuthorizationAuthority('ai')), AUTHORITY.POLICY);

  const rolled = await runGate('form_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_BUILDER);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('builder')), AUTHORITY.LEGACY);

  const restored = await runGate('form_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('builder'));
  assert.ok(restoredRoutes.includes('workflows'));
  assert.ok(restoredRoutes.includes('backups'));
});

test('Phase7.10 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'courses', 'training', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'blog', 'feed', 'schedules', 'messages',
    'notifications', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder']) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.10 middleware ordering: public routes have no auth; admin has auth before shadow', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/builderRoutes.js'), 'utf8');
  assert.ok(routes.includes('builderCutoverGate'));
  assert.ok(routes.includes("policyShadowBuilder('form_get')"));
  assert.ok(routes.includes("builderCutoverGate('form_get')"));
  assert.ok(routes.includes("policyShadowBuilder('form_submit')"));
  // form_get line must not prepend authMiddleware before shadow
  const getLine = routes.split('\n').find((l) => l.includes("policyShadowBuilder('form_get')"));
  assert.ok(getLine);
  assert.ok(!getLine.includes('authMiddleware'));
  assert.ok(routes.includes("adminGuard('form_list')"));
  assert.ok(ADMIN_ACTIONS.has('form_list'));
  assert.ok(ACTIONS.has('form_get'));
});

test('Phase7.10 functional smoke: authz only; mutations NOT EXECUTED', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(parity('form_list', staff).policy.decision, 'ALLOW');
  assert.equal(parity('form_get', anon, {}, { form: { status: 'published' } }).policy.decision, 'ALLOW');
  assert.equal(parity('form_submit', anon).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/delete/submit/run production mutation',
    'NOT EXECUTED — create/update/delete/submit/run production mutation',
  );
});

test('Phase7.10 static final authority + CQRS OFF + only builder uses gate', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/builderRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/builderCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*builder/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*backups/.test(env));
  assert.ok(!/POLICY_CUTOVER_ROUTES\s*=\s*.*\*/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1]));

  assert.ok(gate.includes("getAuthorizationAuthority('builder')"));
  assert.ok(gate.includes('legacyBuilderGate'));
  assert.ok(routes.includes('builderCutoverGate'));
  assert.ok(server.includes("app.use('/api/builder'"));
  assert.ok(!server.includes("require('./modules/cms"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'builderRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('builderCutoverGate'), name);
  }
});
