/**
 * Phase 7.12 — Controlled cutover + production activation for /api/training
 *
 * LIVE mount: server.js → teachingGuideRoutes (NOT trainingRoutes / training-lms).
 * Single action: GET / → guide_list — auth-only (any authenticated role ALLOW).
 * Data filter: isActive + optional category — NOT authorization DENY.
 * No ownership / branch / tenant HTTP deny on this family.
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
  evaluateLegacyTraining,
  evaluatePolicyTraining,
  compareDecisions,
} = require('../../services/policyShadow/trainingLmsPolicy');
const { trainingCutoverGate } = require('../../middleware/trainingCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training',
};
const NO_TRAINING = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'training' };

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
  const legacy = evaluateLegacyTraining(subject, action);
  const policy = evaluatePolicyTraining(subject, action, {}, untrusted);
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
  const legacy = evaluateLegacyTraining(subject, action);
  const policy = evaluatePolicyTraining(subject, action, {}, untrusted);
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
    const mw = trainingCutoverGate(action);
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
      originalUrl: '/api/training',
      method: 'GET',
      requestId: 'p712',
      correlationId: 'p712',
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

test('Phase7.12 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
});

test('Phase7.12 config ON + training allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('training')), AUTHORITY.POLICY);
});

test('Phase7.12 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_TRAINING, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
});

test('Phase7.12 malformed / wildcard → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
});

test('Phase7.12 activation .env includes training + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'training', 'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity / actor matrix (auth-only guide_list) ─────────────────────────────

test('Phase7.12 guide_list: all authenticated roles ALLOW; unauthenticated DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [] }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] }), 'ALLOW'],
    [sub({ id: 's1', role: 'student' }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const [subject, expected] of cases) {
    const { policy } = parity('guide_list', subject);
    assert.equal(policy.decision, expected, `${subject.role || 'anon'}`);
  }
});

test('Phase7.12 specialty/ownership: teacher/student relationships are NOT HTTP authz on guides', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const student = sub({ id: 's1', role: 'student' });
  assert.equal(parity('guide_list', teacher).policy.decision, 'ALLOW');
  assert.equal(parity('guide_list', student).policy.decision, 'ALLOW');
  // Data filter (isActive/category) is handler-only — Policy mirrors ALLOW
  assert.equal(
    parity('guide_list', teacher, { bodyBranchId: 'other', bodyTeacherId: 'spoof' }).policy.decision,
    'ALLOW',
  );
});

test('Phase7.12 branch/tenant: not HTTP authz; spoofed body IDs do not elevate', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF', userBranchId: 'branch-a' });
  assert.equal(
    parity('guide_list', staff, {
      bodyBranchId: 'other',
      bodyTenantId: 't-x',
      clientRole: 'SUPER_ADMIN',
      clientPermissions: ['*'],
      bodyUserId: 'admin',
      bodyTeacherId: 'admin',
      bodyStudentId: 'admin',
    }).policy.decision,
    'ALLOW',
  );
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(
    parity('guide_list', anon, {
      clientRole: 'admin',
      bodyUserId: ACTOR,
      bodyTeacherId: ACTOR,
      bodyStudentId: ACTOR,
      bodyBranchId: 'b1',
    }).policy.decision,
    'DENY',
  );
});

// ── Gate ALLOW / DENY / fallback ─────────────────────────────────────────────

test('Phase7.12 Policy ALLOW authenticated → next()', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const r = await runGate('guide_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('guide_list', staff),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.policyAuthoritative, true);
});

test('Phase7.12 Policy DENY unauthenticated → 401', async () => {
  const anon = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('guide_list', {
    user: undefined,
    policyShadow: shadowFrom('guide_list', anon),
  }, PROD);
  assert.equal(r.statusCode, 401);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 0);
});

test('Phase7.12 Policy ERROR / UNKNOWN → Legacy fallback next()', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('guide_list', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: {
        comparison,
        policyDecision: comparison === 'ERROR' ? undefined : 'WEIRD',
        policyReason: 'test',
      },
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, comparison);
    assert.equal(r.nextCount, 1, comparison);
    assert.equal(r.req.policyAuthoritative, false);
  }
});

test('Phase7.12 cutover OFF / exclusion → Legacy next() (auth-only pass-through)', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('guide_list', staff);
  for (const env of [ALL_OFF, NO_TRAINING, WILDCARD, MALFORMED]) {
    const r = await runGate('guide_list', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.12 rollback: remove training → LEGACY; prior families stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('guide_list', staff);

  assert.equal(withEnv(NO_TRAINING, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_TRAINING, () => getAuthorizationAuthority('courses')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_TRAINING, () => getAuthorizationAuthority('builder')), AUTHORITY.POLICY);

  const rolled = await runGate('guide_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_TRAINING);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(rolled.nextCount, 1);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('courses')), AUTHORITY.LEGACY);

  const restored = await runGate('guide_list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('training'));
  assert.ok(restoredRoutes.includes('courses'));
  assert.ok(restoredRoutes.includes('backups'));
});

test('Phase7.12 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'quizzes', 'assignments', 'evaluations',  'proctor',
    'files', 'blog', 'feed', 'schedules', 'messages', 'notifications',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  // Phase 7.12 PROD constant intentionally excludes training-lms
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.12 middleware order + LIVE inventory: only teachingGuideRoutes uses trainingCutoverGate', () => {
  const guides = fs.readFileSync(path.join(ROOT, 'routes/teachingGuideRoutes.js'), 'utf8');
  const lms = fs.readFileSync(path.join(ROOT, 'routes/trainingRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/trainingCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/training',     teachingGuideRoutes)"));
  assert.ok(server.includes("app.use('/api/training-lms', trainingRoutes)"));
  assert.ok(guides.includes('authMiddleware'));
  assert.ok(guides.includes("policyShadowTrainingLms('guide_list')"));
  assert.ok(guides.includes("trainingCutoverGate('guide_list')"));
  const order = guides.indexOf("policyShadowTrainingLms('guide_list')");
  const gateIdx = guides.indexOf("trainingCutoverGate('guide_list')");
  assert.ok(order > -1 && gateIdx > order);

  assert.ok(!lms.includes('trainingCutoverGate'));
  assert.ok(gate.includes("getAuthorizationAuthority('training')"));
  assert.ok(gate.includes('legacyTrainingGate'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'teachingGuideRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('trainingCutoverGate'), name);
  }
});

test('Phase7.12 side-effect audit: gate + training shadow have no mutations', () => {
  const files = [
    'middleware/trainingCutoverGate.js',
    'middleware/policyShadowTrainingLms.js',
    'services/policyShadow/trainingLmsPolicy.js',
    'services/policyShadow/cutoverAuthority.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    '.remove(', 'enqueue', 'emit(', 'sendNotification', 'BullMQ',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
  // Read-only lookups are allowed in shadow (Teacher.findById lean)
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowTrainingLms.js'), 'utf8');
  assert.ok(shadow.includes('Teacher.findById'));
  assert.ok(shadow.includes('.lean()'));
});

test('Phase7.12 functional smoke: guide_list authz only; mutations NOT EXECUTED', () => {
  const staff = sub({ role: 'staff' });
  assert.equal(parity('guide_list', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/delete/enroll/assign production mutation',
    'NOT EXECUTED — create/update/delete/enroll/assign production mutation',
  );
});

test('Phase7.12 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training(,training-lms(,branches(,notifications(,blog(,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
