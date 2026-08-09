/**
 * Phase 7.5 — Production activation + verification for /api/monitoring
 * (alongside existing /api/backups Policy-primary).
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
  evaluateLegacyMonitoring,
  evaluatePolicyMonitoring,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/monitoringPolicy');
const { monitoringCutoverGate } = require('../../middleware/monitoringCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups,monitoring' };
const BACKUPS_ONLY = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups' };
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };

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
  const legacy = evaluateLegacyMonitoring(subject, action);
  const policy = evaluatePolicyMonitoring(subject, action, {}, untrusted);
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
  const legacy = evaluateLegacyMonitoring(subject, action);
  const policy = evaluatePolicyMonitoring(subject, action, {}, untrusted);
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
    const mw = monitoringCutoverGate(action);
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
      originalUrl: `/api/monitoring/${action}`,
      method: 'GET',
      requestId: 'p75',
      correlationId: 'p75',
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

// ── Production config ────────────────────────────────────────────────────────

test('Phase7.5 activation config: .env ENABLED=true ROUTES includes backups,monitoring', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('backups'));
  assert.ok(routes.includes('monitoring'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  assert.equal(getAuthorizationAuthority('monitoring', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('backups', null, parsed), AUTHORITY.POLICY);
  for (const fam of ['auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  const cfg = readCutoverConfigFromEnv(parsed);
  assert.equal(cfg.enabled, true);
  assert.ok(cfg.routes.includes('monitoring'));
  assert.ok(cfg.routes.includes('backups'));
});

test('Phase7.5 all four monitoring actions resolve POLICY under production allowlist', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ['health', 'metrics', 'overview']) {
    const r = await runGate(action, {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadowFrom(action, staff),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.policyAuthoritative, true);
    assert.equal(r.nextCount, 1);
  }
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const reset = await runGate('metrics_reset', {
    user: { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' },
    policyShadow: shadowFrom('metrics_reset', superS),
  }, PROD);
  assert.equal(reset.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(reset.nextCount, 1);
});

test('Phase7.5 role matrix MATCH Legacy isAdmin (SUPPORT with role=staff ALLOW; reset SUPER-only)', () => {
  // Legacy isAdmin: role admin|staff — adminRole SUPPORT does NOT deny if role is staff
  const matrixHealth = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'ALLOW'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
    [{ id: 's1', role: 'student' }, 'DENY'],
  ];
  for (const action of ['health', 'metrics', 'overview']) {
    for (const [opts, expected] of matrixHealth) {
      const { legacy, policy } = parity(action, sub(opts));
      assert.equal(legacy.decision, expected, `${action} ${JSON.stringify(opts)}`);
      assert.equal(policy.decision, expected);
    }
    assert.equal(parity(action, buildSubject({ user: {}, actorDoc: null })).legacy.decision, 'DENY');
  }
  const resetMatrix = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'DENY'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'DENY'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'DENY'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
  ];
  for (const [opts, expected] of resetMatrix) {
    const { legacy, policy } = parity('metrics_reset', sub(opts));
    assert.equal(legacy.decision, expected);
    assert.equal(policy.decision, expected);
  }
});

test('Phase7.5 spoof cannot escalate teacher; request cannot disable cutover', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodyBranchId: 'b',
    bodyTenantId: 't',
  };
  assert.equal(parity('health', teacher, spoof).policy.decision, 'DENY');
  assert.equal(
    getAuthorizationAuthority('monitoring', {
      body: { POLICY_CUTOVER_ENABLED: 'false' },
      query: { POLICY_CUTOVER_ROUTES: '' },
    }, PROD),
    AUTHORITY.POLICY,
  );
  const r = await runGate('health', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('health', teacher, spoof),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.5 fallback: Policy ERROR/UNKNOWN → Legacy isAdmin (not fail-open)', async () => {
  const ok = await runGate('metrics', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(ok.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(ok.nextCount, 1);

  const deny = await runGate('metrics', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(deny.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(deny.statusCode, 403);
});

test('Phase7.5 rollback TESTED AND RESTORED: remove monitoring → LEGACY; restore → POLICY; backups stays POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('overview', staff);

  assert.equal(withEnv(BACKUPS_ONLY, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
  assert.equal(withEnv(BACKUPS_ONLY, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);

  const rolled = await runGate('overview', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, BACKUPS_ONLY);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  const restored = await runGate('overview', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);

  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('backups'));
  assert.ok(restoredRoutes.includes('monitoring'));
});

test('Phase7.5 functional smoke: non-destructive authz PASS; metrics_reset NOT EXECUTED destructively', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ['health', 'metrics', 'overview']) {
    assert.equal(parity(action, staff).policy.decision, 'ALLOW');
  }
  assert.equal(
    'NOT EXECUTED — destructive production operation',
    'NOT EXECUTED — destructive production operation',
  );
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  assert.equal(parity('metrics_reset', superS).policy.decision, 'ALLOW');
});

test('Phase7.5 static: wiring + isolation + CQRS OFF + no Policy side effects', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/monitoringCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowMonitoring.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*backups/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*monitoring/.test(env));
  assert.ok(!/POLICY_CUTOVER_ROUTES\s*=\s*.*\*/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));

  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(mon.includes('policyShadowMonitoring'));
  assert.ok(mon.includes('isAdmin'));
  assert.ok(mon.includes('monitoring.getHealth()'));
  assert.ok(mon.includes('monitoring.getMetrics()'));
  assert.ok(mon.includes('monitoring.getOverview()'));
  assert.ok(mon.includes('monitoring.resetMetrics()'));

  assert.ok(gate.includes("getAuthorizationAuthority('monitoring')"));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(!gate.includes('resetMetrics'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
  assert.ok(shadow.includes('return next()'));

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'monitoringRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('monitoringCutoverGate'), name);
  }
});
