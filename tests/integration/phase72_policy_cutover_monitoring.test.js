/**
 * Phase 7.2 — Controlled Policy-primary cutover for /api/monitoring ONLY.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../../services/policyShadow/cutoverAuthority');
const {
  buildSubject,
  evaluateLegacyMonitoring,
  evaluatePolicyMonitoring,
  compareDecisions,
} = require('../../services/policyShadow/monitoringPolicy');
const { monitoringCutoverGate } = require('../../middleware/monitoringCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';

const ENV_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const ENV_ON = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring' };

function sub(opts = {}) {
  const role = opts.role ?? 'staff';
  return buildSubject({
    user: {
      id: opts.id ?? ACTOR,
      role,
      adminRole: opts.adminRole,
    },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : (role === 'teacher' ? null : 'STAFF'),
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? null,
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyMonitoring(subject, action);
  const policy = evaluatePolicyMonitoring(subject, action, {}, untrusted);
  const cmp = compareDecisions(legacy, policy);
  assert.equal(cmp, 'MATCH', `${action}: ${cmp} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
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

function runGate(action, { user, policyShadow, body, query, headers }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = monitoringCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user: user || undefined,
      body: body || {},
      query: query || {},
      headers: headers || {},
      policyShadow: policyShadow || undefined,
      originalUrl: `/api/monitoring/${action}`,
      method: 'GET',
      requestId: 'p72',
      correlationId: 'p72',
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

function shadowFromSubject(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyMonitoring(subject, action);
  const policy = evaluatePolicyMonitoring(subject, action, {}, untrusted);
  return {
    action: `monitoring_${action}`,
    comparison: compareDecisions(legacy, policy),
    legacyDecision: legacy.decision,
    policyDecision: policy.decision,
    legacyReason: legacy.reason,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
  };
}

// ── Legacy mode ──────────────────────────────────────────────────────────────

test('Phase7.2 Legacy mode: toggle OFF — admin/staff ALLOW; teacher/student DENY; missing auth DENY', async () => {
  assert.equal(withEnv(ENV_OFF, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);

  for (const action of ['health', 'metrics', 'overview']) {
    const admin = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
    const staff = sub({ role: 'staff', adminRole: 'STAFF' });
    const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
    const student = sub({ id: 's1', role: 'student' });
    assert.equal(parity(action, admin).legacy.decision, 'ALLOW');
    assert.equal(parity(action, staff).legacy.decision, 'ALLOW');
    assert.equal(parity(action, teacher).legacy.decision, 'DENY');
    assert.equal(parity(action, student).legacy.decision, 'DENY');
    assert.equal(parity(action, buildSubject({ user: {}, actorDoc: null })).legacy.decision, 'DENY');

    const a = await runGate(action, {
      user: { id: ACTOR, role: 'admin' },
      policyShadow: shadowFromSubject(action, admin),
    }, ENV_OFF);
    assert.equal(a.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(a.nextCount, 1);

    const t = await runGate(action, {
      user: { id: 't1', role: 'teacher' },
      policyShadow: shadowFromSubject(action, teacher),
    }, ENV_OFF);
    assert.equal(t.nextCount, 0);
    assert.equal(t.statusCode, 403);
  }
});

// ── Policy mode ──────────────────────────────────────────────────────────────

test('Phase7.2 Policy mode: monitoring ON — admin/staff ALLOW; teacher/student/missing DENY', async () => {
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);

  for (const action of ['health', 'metrics', 'overview']) {
    const admin = sub({ role: 'admin', adminRole: 'SUPER_ADMIN' });
    const staff = sub({ role: 'staff', adminRole: 'STAFF' });
    const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
    const student = sub({ id: 's1', role: 'student' });
    assert.equal(parity(action, admin).policy.decision, 'ALLOW');
    assert.equal(parity(action, staff).policy.decision, 'ALLOW');
    assert.equal(parity(action, teacher).policy.decision, 'DENY');
    assert.equal(parity(action, student).policy.decision, 'DENY');

    const a = await runGate(action, {
      user: { id: ACTOR, role: 'admin' },
      policyShadow: shadowFromSubject(action, admin),
    }, ENV_ON);
    assert.equal(a.req.authzAuthority, AUTHORITY.POLICY);
    assert.equal(a.req.policyAuthoritative, true);
    assert.equal(a.nextCount, 1);

    const t = await runGate(action, {
      user: { id: 't1', role: 'teacher' },
      policyShadow: shadowFromSubject(action, teacher),
    }, ENV_ON);
    assert.equal(t.nextCount, 0);
    assert.equal(t.statusCode, 403);
    assert.equal(t.req.authzAuthority, AUTHORITY.POLICY);
  }
});

// ── Reset SUPER matrix ───────────────────────────────────────────────────────

test('Phase7.2 reset: SUPER ALLOW; HIGH_ADMIN/STAFF/SUPPORT/teacher/student DENY (parity)', () => {
  const cases = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'DENY'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'DENY'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'DENY'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
    [{ id: 's1', role: 'student' }, 'DENY'],
  ];
  for (const [opts, expected] of cases) {
    const s = sub(opts);
    const { legacy, policy } = parity('metrics_reset', s);
    assert.equal(legacy.decision, expected, `legacy ${JSON.stringify(opts)}`);
    assert.equal(policy.decision, expected, `policy ${JSON.stringify(opts)}`);
  }
});

test('Phase7.2 reset Policy mode: SUPER next(); STAFF Policy DENY without Legacy double-gate', async () => {
  const superSub = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const staffSub = sub({ role: 'staff', adminRole: 'STAFF' });

  const ok = await runGate('metrics_reset', {
    user: { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' },
    policyShadow: shadowFromSubject('metrics_reset', superSub),
  }, ENV_ON);
  assert.equal(ok.nextCount, 1);
  assert.equal(ok.req.policyAuthoritative, true);

  const deny = await runGate('metrics_reset', {
    user: { id: ACTOR, role: 'staff', adminRole: 'STAFF' },
    policyShadow: shadowFromSubject('metrics_reset', staffSub),
  }, ENV_ON);
  assert.equal(deny.nextCount, 0);
  assert.equal(deny.statusCode, 403);
  assert.equal(deny.bodyOut.message, 'Chi Super Admin');
});

// ── Spoof / isolation ────────────────────────────────────────────────────────

test('Phase7.2 spoof: teacher cannot escalate via body/query/header role/adminRole/permissions', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodyBranchId: 'branch-x',
    bodyTenantId: 'tenant-x',
  };
  const { policy } = parity('health', teacher, spoof);
  assert.equal(policy.decision, 'DENY');

  const r = await runGate('health', {
    user: { id: 't1', role: 'teacher' },
    body: { role: 'admin', adminRole: 'SUPER_ADMIN', permissions: ['all'], branchId: 'b', tenantId: 't' },
    query: { role: 'admin' },
    headers: { 'x-role': 'admin' },
    policyShadow: shadowFromSubject('health', teacher, spoof),
  }, ENV_ON);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

// ── Rollback ─────────────────────────────────────────────────────────────────

test('Phase7.2 rollback: ON→POLICY; OFF / remove allowlist / malformed → LEGACY', () => {
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(ENV_OFF, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: 'backups',
  }, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'banana',
    POLICY_CUTOVER_ROUTES: 'monitoring',
  }, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
});

test('Phase7.2 rollback gate: Policy ON then OFF switches authority without code change', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFromSubject('metrics', staff);

  const on = await runGate('metrics', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, ENV_ON);
  assert.equal(on.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(on.nextCount, 1);

  const off = await runGate('metrics', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, ENV_OFF);
  assert.equal(off.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(off.nextCount, 1);
});

// ── Policy failure → Legacy fallback ─────────────────────────────────────────

test('Phase7.2 Policy ERROR / UNKNOWN → Legacy fallback (isAdmin), not fail-open', async () => {
  const staffUser = { id: ACTOR, role: 'staff' };
  const teacherUser = { id: 't1', role: 'teacher' };

  const errStaff = await runGate('health', {
    user: staffUser,
    policyShadow: { comparison: 'ERROR', policyDecision: undefined, error: 'forced' },
  }, ENV_ON);
  assert.equal(errStaff.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(errStaff.nextCount, 1);

  const errTeacher = await runGate('health', {
    user: teacherUser,
    policyShadow: { comparison: 'ERROR', policyDecision: 'ALLOW' }, // ignore ALLOW on ERROR
  }, ENV_ON);
  assert.equal(errTeacher.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(errTeacher.statusCode, 403);

  const unk = await runGate('health', {
    user: staffUser,
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, ENV_ON);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(unk.nextCount, 1);

  const malformed = await runGate('health', {
    user: teacherUser,
    policyShadow: { comparison: 'MATCH', policyDecision: 'MAYBE' },
  }, ENV_ON);
  assert.equal(malformed.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(malformed.statusCode, 403);
});

// ── Behavior / side effects / isolation static ───────────────────────────────

test('Phase7.2 static: only monitoring cutover-wired; handlers/side-effects unchanged; defaults OFF', () => {
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/monitoringCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');

  assert.ok(mon.includes("guard('health')"));
  assert.ok(mon.includes("guard('metrics')"));
  assert.ok(mon.includes("guard('overview')"));
  assert.ok(mon.includes("guard('metrics_reset')"));
  assert.ok(mon.includes('monitoring.getHealth()'));
  assert.ok(mon.includes('monitoring.getMetrics()'));
  assert.ok(mon.includes('monitoring.getOverview()'));
  assert.ok(mon.includes('monitoring.resetMetrics()'));
  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(mon.includes('policyAuthoritative'));

  assert.ok(gate.includes("getAuthorizationAuthority('monitoring')"));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(!gate.includes('.save('));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('jwt.sign'));

  // No other routes import monitoringCutoverGate
  const routesDir = path.join(ROOT, 'routes');
  for (const name of fs.readdirSync(routesDir)) {
    if (!name.endsWith('.js') || name === 'monitoringRoutes.js') continue;
    const src = fs.readFileSync(path.join(routesDir, name), 'utf8');
    assert.ok(!src.includes('monitoringCutoverGate'), name);
    assert.ok(!src.includes('getAuthorizationAuthority'), name);
  }

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  // Phase 7.5 may allowlist monitoring with backups; never wildcard
  const routesLine = (env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1].trim();
  assert.ok(!routesLine.includes('*'));
  assert.ok(!perms.includes('MANAGE_MONITORING'));
  assert.ok(!perms.includes('VIEW_MONITORING'));
});

test('Phase7.2 observability: authority LEGACY vs POLICY recorded on req', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFromSubject('overview', staff);
  const legacyRun = await runGate('overview', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, ENV_OFF);
  assert.equal(legacyRun.req.authzFamily, 'monitoring');
  assert.equal(legacyRun.req.authzAuthority, AUTHORITY.LEGACY);

  const policyRun = await runGate('overview', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, ENV_ON);
  assert.equal(policyRun.req.authzAuthority, AUTHORITY.POLICY);
});
