/**
 * Phase 7.6 — Controlled cutover + production activation for /api/tenants
 * (alongside existing backups + monitoring Policy-primary).
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
  evaluateLegacyTenant,
  evaluatePolicyTenant,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/tenantPolicy');
const { tenantsCutoverGate } = require('../../middleware/tenantsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants' };
const NO_TENANTS = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups,monitoring' };
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
    userBranchId: opts.userBranchId ?? null,
  });
}

function parity(action, subject, untrusted = {}, ctx = {}) {
  const legacy = evaluateLegacyTenant(subject, action, ctx);
  const policy = evaluatePolicyTenant(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyTenant(subject, action, ctx);
  const policy = evaluatePolicyTenant(subject, action, ctx, untrusted);
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
    const mw = tenantsCutoverGate(action);
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
      originalUrl: `/api/tenants/${action}`,
      method: 'GET',
      requestId: 'p76',
      correlationId: 'p76',
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

test('Phase7.6 activation config: .env ENABLED=true ROUTES includes backups,monitoring,tenants', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('backups'));
  assert.ok(routes.includes('monitoring'));
  assert.ok(routes.includes('tenants'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  assert.equal(getAuthorizationAuthority('tenants', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('backups', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('monitoring', null, parsed), AUTHORITY.POLICY);
  for (const fam of ['auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  const cfg = readCutoverConfigFromEnv(parsed);
  assert.equal(cfg.enabled, true);
  assert.ok(cfg.routes.includes('tenants'));
  assert.ok(cfg.routes.includes('backups'));
  assert.ok(cfg.routes.includes('monitoring'));
  assert.ok(!cfg.routes.includes('*'));
});

test('Phase7.6 all seven tenant actions resolve POLICY under production allowlist', async () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  for (const action of ACTIONS) {
    const r = await runGate(action, {
      user: { id: 'admin', role: 'admin' },
      policyShadow: shadowFrom(action, superS),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.authzFamily, 'tenants');
    assert.equal(r.req.policyAuthoritative, true);
    assert.equal(r.nextCount, 1, action);
  }
});

test('Phase7.6 role matrix MATCH Legacy isSuperAdmin (SUPER ALLOW; all others DENY)', () => {
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
      assert.equal(legacy.decision, expected, `${action} ${JSON.stringify(opts)}`);
      assert.equal(policy.decision, expected);
    }
    assert.equal(
      parity(action, buildSubject({ user: {}, actorDoc: null })).legacy.decision,
      'DENY',
    );
  }
});

test('Phase7.6 spoof cannot escalate non-SUPER; request cannot disable cutover', async () => {
  const high = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['manage_tenants', '*'],
    bodyTenantId: 't-x',
    queryTenantId: 't-y',
    bodyBranchId: 'b-x',
    queryBranchId: 'b-y',
  };
  for (const action of ['list', 'create', 'assign_branch']) {
    assert.equal(parity(action, high, spoof).policy.decision, 'DENY');
  }
  assert.equal(
    getAuthorizationAuthority('tenants', {
      body: { POLICY_CUTOVER_ENABLED: 'false' },
      query: { POLICY_CUTOVER_ROUTES: '' },
      headers: { 'x-tenant-id': 'spoof' },
    }, PROD),
    AUTHORITY.POLICY,
  );
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'admin', adminRole: 'HIGH_ADMIN' },
    policyShadow: shadowFrom('list', high, spoof),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.6 resource semantics: status/branchId/paramsId do not alter SUPER gate', () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const high = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  assert.equal(
    parity('list', superS, {}, { paramsId: null }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('assign_branch', superS, { bodyBranchId: 'client-branch' }, { paramsId: 'tenant-1' }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('get', high, { queryTenantId: 'other' }, { paramsId: 'missing-resource' }).policy.decision,
    'DENY',
  );
  // Missing resource: SUPER still ALLOW (handler may 404) — authz is not 404
  assert.equal(
    parity('stats', superS, {}, { paramsId: 'does-not-exist' }).policy.decision,
    'ALLOW',
  );
});

test('Phase7.6 fallback: Policy ERROR/UNKNOWN/malformed → Legacy isSuperAdmin (never fail-open)', async () => {
  const ok = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(ok.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(ok.nextCount, 1);

  // Missing id → Legacy isSuperAdmin DENY 403 without DB (proves no fail-open on UNKNOWN)
  const deny = await runGate('list', {
    user: { role: 'staff' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(deny.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(deny.statusCode, 403);
  assert.equal(deny.nextCount, 0);

  const malformed = await runGate('create', {
    user: { role: 'staff' },
    policyShadow: { comparison: 'MATCH', policyDecision: 'MAYBE' },
  }, PROD);
  assert.equal(malformed.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(malformed.statusCode, 403);
  assert.equal(malformed.nextCount, 0);
});

test('Phase7.6 rollback TESTED AND RESTORED: remove tenants → LEGACY; restore → POLICY; backups+monitoring stay POLICY', async () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const shadow = shadowFrom('list', superS);

  assert.equal(withEnv(NO_TENANTS, () => getAuthorizationAuthority('tenants')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_TENANTS, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_TENANTS, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadow,
  }, NO_TENANTS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(rolled.nextCount, 1);

  const restored = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('tenants')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);

  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('backups'));
  assert.ok(restoredRoutes.includes('monitoring'));
  assert.ok(restoredRoutes.includes('tenants'));
});

test('Phase7.6 functional smoke: non-destructive authz PASS; mutations NOT EXECUTED', () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  for (const action of ['list', 'meta_branches', 'stats', 'get']) {
    assert.equal(parity(action, superS).policy.decision, 'ALLOW');
  }
  assert.equal(parity('create', superS).policy.decision, 'ALLOW');
  assert.equal(parity('update', superS).policy.decision, 'ALLOW');
  assert.equal(parity('assign_branch', superS).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — destructive/persistent production mutation',
    'NOT EXECUTED — destructive/persistent production mutation',
  );
});

test('Phase7.6 static: wiring + isolation + CQRS OFF + no Policy side effects + no wildcard', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/tenantRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/tenantsCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowTenant.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/tenantPolicy.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const backups = fs.readFileSync(path.join(ROOT, 'routes/backupRoutes.js'), 'utf8');
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*tenants/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*backups/.test(env));
  assert.ok(!/POLICY_CUTOVER_ROUTES\s*=\s*.*\*/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1]));

  for (const a of ACTIONS) {
    assert.ok(routes.includes(`guard('${a}')`), a);
  }
  assert.ok(routes.includes('tenantsCutoverGate'));
  assert.ok(routes.includes('policyShadowTenant'));
  assert.ok(gate.includes("getAuthorizationAuthority('tenants')"));
  assert.ok(gate.includes('isSuperAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(!gate.includes('createTenant'));
  assert.ok(!gate.includes('updateTenant'));
  assert.ok(!gate.includes('assignBranch'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
  assert.ok(shadow.includes('return next()'));
  assert.ok(!policy.includes('MANAGE_TENANTS'));
  assert.ok(!/MANAGE_TENANT|manage_tenants|view_tenants/.test(perms));

  assert.ok(backups.includes('backupsCutoverGate'));
  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(!backups.includes('tenantsCutoverGate'));
  assert.ok(!mon.includes('tenantsCutoverGate'));

  assert.ok(server.includes("app.use('/api/tenants'"));
  assert.ok(!server.includes("require('./modules/tenant"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'tenantRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('tenantsCutoverGate'), name);
  }
});
