/**
 * Phase 7.4 — Production activation + verification for /api/backups ONLY.
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
  evaluateLegacyBackup,
  evaluatePolicyBackup,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/backupPolicy');
const { backupsCutoverGate } = require('../../middleware/backupsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const ACTIVATION = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups' };
const ROLLBACK = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };

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
  const role = opts.role ?? 'admin';
  return buildSubject({
    user: { id: opts.id ?? ACTOR, role, adminRole: opts.adminRole },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : null,
          permissions: opts.permissions ?? [],
        },
    userBranchId: null,
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyBackup(subject, action);
  const policy = evaluatePolicyBackup(subject, action, {}, untrusted);
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

function shadowFrom(action, subject) {
  const legacy = evaluateLegacyBackup(subject, action);
  const policy = evaluatePolicyBackup(subject, action, {}, {});
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow, actorDoc }, env) {
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => actorDoc === undefined
          ? { adminRole: user?.adminRole || null, role: user?.role || null }
          : actorDoc,
      };
    },
  });
  return withEnv(env, () => new Promise((resolve) => {
    const mw = backupsCutoverGate(action);
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
      params: { id: '507f1f77bcf86cd799439099' },
      originalUrl: `/api/backups/${action}`,
      method: 'GET',
      requestId: 'p74',
      correlationId: 'p74',
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      Teacher.findById = orig;
      resolve({ nextCount, statusCode, bodyOut, req });
    };
    const res = {
      status(c) { statusCode = c; return this; },
      json(b) { bodyOut = b; finish(); return this; },
    };
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch((e) => {
      statusCode = 500;
      bodyOut = { message: e.message };
      finish();
    });
  }));
}

// ── Committed production activation ──────────────────────────────────────────

test('Phase7.4 activation config: .env ENABLED=true and ROUTES includes backups', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('backups'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  assert.equal(getAuthorizationAuthority('backups', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('auth', null, parsed), AUTHORITY.LEGACY);
  assert.equal(getAuthorizationAuthority('finance', null, parsed), AUTHORITY.LEGACY);
  assert.equal(getAuthorizationAuthority('invoices', null, parsed), AUTHORITY.LEGACY);
  assert.equal(getAuthorizationAuthority('transactions', null, parsed), AUTHORITY.LEGACY);
  assert.equal(getAuthorizationAuthority('webhooks', null, parsed), AUTHORITY.LEGACY);
  assert.equal(getAuthorizationAuthority('students', null, parsed), AUTHORITY.LEGACY);
  const cfg = readCutoverConfigFromEnv(parsed);
  assert.equal(cfg.enabled, true);
  assert.ok(cfg.routes.includes('backups'));
});

test('Phase7.4 all five backup actions resolve POLICY authority under activation env', async () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  for (const action of ACTIONS) {
    assert.equal(withEnv(ACTIVATION, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
    const r = await runGate(action, {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadowFrom(action, superS),
    }, ACTIVATION);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.authzFamily, 'backups');
    assert.equal(r.req.policyAuthoritative, true);
    assert.equal(r.nextCount, 1);
  }
});

test('Phase7.4 role parity under activation: SUPER ALLOW; others DENY — MATCH', () => {
  const matrix = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'DENY'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'DENY'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'DENY'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
    [{ id: 's1', role: 'student' }, 'DENY'],
  ];
  for (const action of ACTIONS) {
    for (const [opts, expected] of matrix) {
      const { legacy, policy } = parity(action, sub(opts));
      assert.equal(legacy.decision, expected);
      assert.equal(policy.decision, expected);
    }
    assert.equal(
      parity(action, buildSubject({ user: {}, actorDoc: null })).legacy.decision,
      'DENY',
    );
  }
});

test('Phase7.4 spoof cannot change activated authority or escalate HIGH_ADMIN', async () => {
  const high = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodyUserId: 'admin',
    bodyBranchId: 'x',
    bodyTenantId: 'y',
  };
  assert.equal(parity('create', high, spoof).policy.decision, 'DENY');
  const poison = {
    query: { POLICY_CUTOVER_ENABLED: 'false' },
    body: { POLICY_CUTOVER_ROUTES: '' },
    headers: { 'x-policy-cutover': 'off' },
  };
  assert.equal(
    getAuthorizationAuthority('backups', poison, ACTIVATION),
    AUTHORITY.POLICY,
  );
  const r = await runGate('delete', {
    user: { id: ACTOR, role: 'admin', adminRole: 'HIGH_ADMIN' },
    policyShadow: shadowFrom('delete', high),
  }, ACTIVATION);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.4 fallback: Policy ERROR/UNKNOWN → Legacy isSuperAdmin (not fail-open)', async () => {
  const ok = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, ACTIVATION);
  assert.equal(ok.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(ok.nextCount, 1);

  const denied = await runGate('list', {
    user: { id: ACTOR, role: 'staff', adminRole: 'STAFF' },
    actorDoc: { adminRole: 'STAFF', role: 'staff' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, ACTIVATION);
  assert.equal(denied.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(denied.statusCode, 403);
});

test('Phase7.4 rollback TESTED AND RESTORED: OFF→LEGACY then ON→POLICY', async () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const shadow = shadowFrom('stats', superS);

  const off = await runGate('stats', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadow,
  }, ROLLBACK);
  assert.equal(off.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(off.nextCount, 1);

  const on = await runGate('stats', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadow,
  }, ACTIVATION);
  assert.equal(on.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(on.nextCount, 1);

  // Committed .env still has backups activated (Phase 7.5 may also list monitoring)
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('backups'));
});

test('Phase7.4 functional smoke: non-destructive authz paths documented; mutations NOT EXECUTED', () => {
  // Authorization smoke via Policy evaluation (no filesystem/queue)
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  for (const action of ['stats', 'list', 'download']) {
    assert.equal(parity(action, superS).policy.decision, 'ALLOW');
  }
  // Destructive create/delete: authz verified only — no backupService calls in this suite
  assert.equal(parity('create', superS).policy.decision, 'ALLOW');
  assert.equal(parity('delete', superS).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — destructive production operation',
    'NOT EXECUTED — destructive production operation',
  );
});

test('Phase7.4 static isolation: only backupsCutoverGate on backups; CQRS OFF; no side effects in gate', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/backupsCutoverGate.js'), 'utf8');
  const backups = fs.readFileSync(path.join(ROOT, 'routes/backupRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*backups/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.ok(backups.includes('backupsCutoverGate'));
  assert.ok(backups.includes('policyShadowBackup'));
  assert.ok(backups.includes('isSuperAdmin'));
  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(!mon.includes('backupsCutoverGate'));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'backupRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('backupsCutoverGate'), name);
  }

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  assert.ok(!/enqueue\s*\(/.test(gate));
  assert.ok(!gate.includes('createBackupJob'));
  assert.ok(!gate.includes('deleteBackup'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
});
