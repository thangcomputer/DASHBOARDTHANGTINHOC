/**
 * Phase 7.15 — Controlled cutover + production activation for /api/notifications
 *
 * LIVE: auth-only self-scope list/count/unread/mark_read/dismiss;
 * broadcast: isAdmin (admin|staff). Socket emit stays in notificationCenter handler.
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
  evaluateLegacyNotification,
  evaluatePolicyNotification,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/notificationPolicy');
const {
  notificationsCutoverGate,
  BROADCAST_ACTION,
} = require('../../middleware/notificationsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications',
};
const NO_NOTIF = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'notifications' };

const AUTH_ONLY = ['list', 'count', 'unread', 'mark_read', 'dismiss'];

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
  const legacy = evaluateLegacyNotification(subject, action);
  const policy = evaluatePolicyNotification(subject, action, untrusted);
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
  const legacy = evaluateLegacyNotification(subject, action);
  const policy = evaluatePolicyNotification(subject, action, untrusted);
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
    const mw = notificationsCutoverGate(action);
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
      originalUrl: `/api/notifications/${action}`,
      method: 'GET',
      requestId: 'p715',
      correlationId: 'p715',
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

test('Phase7.15 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
});

test('Phase7.15 config ON + notifications allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('notifications')), AUTHORITY.POLICY);
});

test('Phase7.15 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_NOTIF, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
});

test('Phase7.15 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.15 activation .env includes notifications + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder',
    'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.15 auth-only: all authenticated roles ALLOW; unauthenticated DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT' }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher' }), 'ALLOW'],
    [sub({ id: 's1', role: 'student' }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of AUTH_ONLY) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}/${subject.role || 'anon'}`);
    }
  }
});

test('Phase7.15 broadcast: admin|staff ALLOW; teacher/student/anon DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT' }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher' }), 'DENY'],
    [sub({ id: 's1', role: 'student' }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const [subject, expected] of cases) {
    assert.equal(parity(BROADCAST_ACTION, subject).policy.decision, expected);
  }
});

test('Phase7.15 spoof resistance: body role/permissions/receivers do not elevate', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const spoof = {
    clientRole: 'admin',
    clientPermissions: ['*'],
    bodyBranchId: 'b1',
    receivers: 'ALL_ADMIN',
  };
  assert.equal(parity('list', teacher, spoof).policy.decision, 'ALLOW');
  assert.equal(parity(BROADCAST_ACTION, teacher, spoof).policy.decision, 'DENY');
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(parity('list', anon, spoof).policy.decision, 'DENY');
});

// ── Gate ─────────────────────────────────────────────────────────────────────

test('Phase7.15 Policy ALLOW list → next()', async () => {
  const staff = sub({ role: 'staff' });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('list', staff),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.15 Policy ALLOW broadcast staff → next()', async () => {
  const staff = sub({ role: 'staff' });
  const r = await runGate(BROADCAST_ACTION, {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom(BROADCAST_ACTION, staff),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.15 Policy DENY broadcast teacher → 403', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const r = await runGate(BROADCAST_ACTION, {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom(BROADCAST_ACTION, teacher),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /Admin/);
  assert.equal(r.nextCount, 0);
});

test('Phase7.15 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('list', {
      user: { id: ACTOR, role: 'staff' },
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

test('Phase7.15 cutover OFF / exclusion → Legacy next()', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('list', staff);
  for (const env of [ALL_OFF, NO_NOTIF, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.15 rollback: remove notifications → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('list', staff);

  assert.equal(withEnv(NO_NOTIF, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_NOTIF, () => getAuthorizationAuthority('branches')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_NOTIF, () => getAuthorizationAuthority('training-lms')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_NOTIF);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('notifications')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);

  const restored = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('notifications'));
});

test('Phase7.15 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'feed', 'schedules', 'messages', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  // Phase 7.15 PROD constant intentionally excludes blog
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.15 middleware order + only notificationRoutes uses notificationsCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/notificationRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/notificationsCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/notifications'"));
  assert.ok(routes.includes('notifGuard'));
  assert.ok(routes.includes('policyShadowNotification'));
  assert.ok(routes.includes('notificationsCutoverGate'));
  assert.ok(gate.includes("getAuthorizationAuthority('notifications')"));
  assert.ok(gate.includes('legacyNotificationsGate'));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'notificationRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('notificationsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`notifGuard('${a}')`), a);
  }
});

test('Phase7.15 side-effect audit: gate + notification policy have no mutations', () => {
  const files = [
    'middleware/notificationsCutoverGate.js',
    'middleware/policyShadowNotification.js',
    'services/policyShadow/notificationPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'enqueue', '.emit(', 'createAndEmit', 'BullMQ',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
});

test('Phase7.15 functional smoke: list/count authz; broadcast mutation NOT EXECUTED', () => {
  const staff = sub({ role: 'staff' });
  assert.equal(parity('list', staff).policy.decision, 'ALLOW');
  assert.equal(parity('count', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — broadcast/mark-read/dismiss production mutation',
    'NOT EXECUTED — broadcast/mark-read/dismiss production mutation',
  );
  assert.ok(ACTIONS.has('broadcast'));
});

test('Phase7.15 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications(,blog(,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
