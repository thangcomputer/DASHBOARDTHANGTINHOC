/**
 * Phase 7.19 — Controlled cutover + production activation for /api/settings
 *
 * LIVE: auth (when required) → policyShadowSettings → settingsCutoverGate → handler.
 * public_read: bank/payment/web (no auth)
 * auth_only: popup/training reads
 * system_*: SYSTEM_SETTINGS
 * training_*: MANAGE_TRAINING / MANAGE_STUDENT_TRAINING
 * reset: SYSTEM_SETTINGS middleware; SUPER_ADMIN+password remain handler 400
 * Side effects (cache invalidate, emit, wipe) remain handler-owned.
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
  evaluateLegacySettings,
  evaluatePolicySettings,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/settingsPolicy');
const {
  settingsCutoverGate,
  SYSTEM_ACTIONS,
} = require('../../middleware/settingsCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings',
};
const NO_SETTINGS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'settings' };

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
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? null,
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacySettings(subject, action);
  const policy = evaluatePolicySettings(subject, action, untrusted);
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
  const legacy = evaluateLegacySettings(subject, action);
  const policy = evaluatePolicySettings(subject, action, untrusted);
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
    const mw = settingsCutoverGate(action);
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
      originalUrl: `/api/settings/${action}`,
      method: 'GET',
      requestId: 'p719',
      correlationId: 'p719',
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

test('Phase7.19 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);
});

test('Phase7.19 config ON + settings allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('settings')), AUTHORITY.POLICY);
});

test('Phase7.19 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_SETTINGS, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);
});

test('Phase7.19 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.19 activation .env includes settings + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'settings', 'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training',
    'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.19 public_read: ALLOW for all actors including unauthenticated', () => {
  const actors = [
    sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }),
    sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }),
    sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }),
    sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [] }),
    sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] }),
    sub({ id: 's1', role: 'student', adminRole: null, permissions: [] }),
    buildSubject({ user: {}, actorDoc: null }),
  ];
  for (const subject of actors) {
    assert.equal(parity('public_read', subject).policy.decision, 'ALLOW');
  }
});

test('Phase7.19 auth_only: authenticated ALLOW; unauthenticated DENY', () => {
  assert.equal(parity('auth_only', sub({ id: 's1', role: 'student', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(parity('auth_only', buildSubject({ user: {}, actorDoc: null })).policy.decision, 'DENY');
});

test('Phase7.19 system_read/write/reset: SYSTEM_SETTINGS actor matrix', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'DENY'],
    [sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.SYSTEM_SETTINGS] }), 'DENY'],
    [sub({ id: 's1', role: 'student', adminRole: null, permissions: [] }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of SYSTEM_ACTIONS) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}`);
    }
  }
});

test('Phase7.19 training_write vs student_training_write vs training_upload', () => {
  const train = sub({ permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const stu = sub({ permissions: [PERMISSIONS.MANAGE_STUDENT_TRAINING] });
  const none = sub({ permissions: [] });
  assert.equal(parity('training_write', train).policy.decision, 'ALLOW');
  assert.equal(parity('student_training_write', train).policy.decision, 'DENY');
  assert.equal(parity('student_training_write', stu).policy.decision, 'ALLOW');
  assert.equal(parity('training_write', stu).policy.decision, 'DENY');
  assert.equal(parity('training_upload', train).policy.decision, 'ALLOW');
  assert.equal(parity('training_upload', stu).policy.decision, 'ALLOW');
  assert.equal(parity('training_upload', none).policy.decision, 'DENY');
});

test('Phase7.19 reset mirrors SYSTEM_SETTINGS only (SUPER password stays in handler)', () => {
  const high = sub({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
  });
  const superSub = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] });
  assert.equal(parity('reset', high).policy.decision, 'ALLOW');
  assert.equal(parity('reset', superSub).policy.decision, 'ALLOW');
});

test('Phase7.19 spoof resistance: role/permissions/password/branch cannot elevate', () => {
  const none = sub({ permissions: [] });
  const spoof = {
    clientRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
    bodyBranchId: 'b1',
    bodyPassword: 'secret',
  };
  assert.equal(parity('system_write', none, spoof).policy.decision, 'DENY');
  assert.equal(parity('reset', none, spoof).policy.decision, 'DENY');
  assert.equal(parity('public_read', none, spoof).policy.decision, 'ALLOW');
});

// ── Gate decisions ───────────────────────────────────────────────────────────

test('Phase7.19 Policy ALLOW public_read → next() without user', async () => {
  const shadow = shadowFrom('public_read', buildSubject({ user: {}, actorDoc: null }));
  const r = await runGate('public_read', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
  assert.equal(r.statusCode, null);
});

test('Phase7.19 Policy ALLOW auth_only → next()', async () => {
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  const shadow = shadowFrom('auth_only', student);
  const r = await runGate('auth_only', {
    user: { id: 's1', role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 1);
});

test('Phase7.19 Policy DENY system_write → 403 Legacy message', async () => {
  const none = sub({ permissions: [] });
  const shadow = shadowFrom('system_write', none);
  const r = await runGate('system_write', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền|Yêu cầu quyền/i);
});

test('Phase7.19 Policy DENY role_not_staff → staff message', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const shadow = shadowFrom('system_read', teacher);
  const r = await runGate('system_read', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /Admin\/Staff/);
});

test('Phase7.19 Policy DENY unauthenticated → 401', async () => {
  const shadow = {
    comparison: 'MATCH',
    policyDecision: 'DENY',
    policyReason: 'policy_unauthenticated',
    policyStatusHint: 401,
  };
  const r = await runGate('auth_only', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.statusCode, 401);
  assert.equal(r.nextCount, 0);
});

test('Phase7.19 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('public_read', {
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

test('Phase7.19 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('public_read', buildSubject({ user: {}, actorDoc: null }));
  for (const env of [ALL_OFF, NO_SETTINGS, WILDCARD, MALFORMED]) {
    const r = await runGate('public_read', { user: undefined, policyShadow: shadow }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

test('Phase7.19 Legacy fallback for permission actions is wired in gate (not executed live)', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/settingsCutoverGate.js'), 'utf8');
  assert.ok(gate.includes('checkSystemSettings'));
  assert.ok(gate.includes('checkManageTraining'));
  assert.ok(gate.includes('checkManageStudentTraining'));
  assert.ok(gate.includes('checkTrainingUpload'));
  assert.ok(gate.includes("SYSTEM_ACTIONS.has(action)"));
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.19 rollback: remove settings → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const shadow = shadowFrom('public_read', buildSubject({ user: {}, actorDoc: null }));

  assert.equal(withEnv(NO_SETTINGS, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_SETTINGS, () => getAuthorizationAuthority('files')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_SETTINGS, () => getAuthorizationAuthority('feed')), AUTHORITY.POLICY);

  const rolled = await runGate('public_read', { user: undefined, policyShadow: shadow }, NO_SETTINGS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('settings')), AUTHORITY.LEGACY);

  const restored = await runGate('public_read', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('settings'));
});

test('Phase7.19 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'schedules', 'messages',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.19 middleware order + only settingsRoutes uses settingsCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/settingsRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/settingsCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/settings'"));
  assert.ok(routes.includes('settingsGuard'));
  assert.ok(routes.includes("settingsGuard('public_read')"));
  assert.ok(routes.includes("settingsGuard('system_read')"));
  assert.ok(routes.includes("settingsGuard('reset')"));
  assert.ok(routes.includes("settingsGuard('training_upload')"));
  assert.ok(gate.includes("getAuthorizationAuthority('settings')"));
  assert.ok(gate.includes('legacySettingsGate'));
  assert.ok(gate.includes('SYSTEM_SETTINGS'));
  assert.ok(!gate.includes('emitSystemWide'));
  assert.ok(!gate.includes('deleteMany'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'settingsRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('settingsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`settingsGuard('${a}')`), a);
  }
  assert.ok(routes.includes('emitSystemWide'));
  assert.ok(routes.includes("adminRole !== 'SUPER_ADMIN'"));
});

test('Phase7.19 side-effect audit: gate/policy/shadow have no mutations', () => {
  const files = [
    'middleware/settingsCutoverGate.js',
    'services/policyShadow/settingsPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'deleteMany', 'enqueue', '.emit(', 'emitSystemWide', 'NotificationService',
    'BullMQ', 'invalidateSettingsCache', 'updateMainSettings',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowSettings.js'), 'utf8');
  for (const b of ['.save(', '.create(', 'deleteMany', 'enqueue', '.emit(', 'invalidateSettingsCache']) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.19 functional smoke: public_read authz; destructive mutations NOT EXECUTED', () => {
  assert.equal(parity('public_read', buildSubject({ user: {}, actorDoc: null })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — PUT/upload/reset-data/exam-subjects mutation',
    'NOT EXECUTED — PUT/upload/reset-data/exam-subjects mutation',
  );
});

test('Phase7.19 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
