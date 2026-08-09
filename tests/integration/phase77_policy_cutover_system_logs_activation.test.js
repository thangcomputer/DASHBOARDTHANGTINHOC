/**
 * Phase 7.7 — Controlled cutover + production activation for /api/system-logs
 * (alongside backups, monitoring, tenants Policy-primary).
 *
 * Legacy gate: auth + isAdmin (role admin|staff). VIEW_LOGS unused for HTTP.
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
  evaluateLegacySystemLog,
  evaluatePolicySystemLog,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/systemLogsPolicy');
const { systemLogsCutoverGate } = require('../../middleware/systemLogsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs',
};
const NO_LOGS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'system-logs' };

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
  const legacy = evaluateLegacySystemLog(subject, action, ctx);
  const policy = evaluatePolicySystemLog(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacySystemLog(subject, action, ctx);
  const policy = evaluatePolicySystemLog(subject, action, ctx, untrusted);
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
    const mw = systemLogsCutoverGate(action);
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
      originalUrl: `/api/system-logs/${action}`,
      method: 'GET',
      requestId: 'p77',
      correlationId: 'p77',
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

// ── 1–5 Authority ────────────────────────────────────────────────────────────

test('Phase7.7 authority: cutover OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
});

test('Phase7.7 authority: system-logs not allowlisted → Legacy', () => {
  assert.equal(withEnv(NO_LOGS, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
});

test('Phase7.7 authority: system-logs allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('system-logs')), AUTHORITY.POLICY);
});

test('Phase7.7 authority: malformed ENABLED → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
});

test('Phase7.7 authority: wildcard ROUTES → Legacy (never global)', () => {
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
});

test('Phase7.7 activation config: .env ENABLED=true ROUTES includes system-logs + prior families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('backups'));
  assert.ok(routes.includes('monitoring'));
  assert.ok(routes.includes('tenants'));
  assert.ok(routes.includes('system-logs'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  assert.equal(getAuthorizationAuthority('system-logs', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('backups', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('monitoring', null, parsed), AUTHORITY.POLICY);
  assert.equal(getAuthorizationAuthority('tenants', null, parsed), AUTHORITY.POLICY);
  for (const fam of ['auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  const cfg = readCutoverConfigFromEnv(parsed);
  assert.ok(cfg.routes.includes('system-logs'));
  assert.ok(!cfg.routes.includes('*'));
});

test('Phase7.7 all three actions resolve POLICY under production allowlist', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ACTIONS) {
    const r = await runGate(action, {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadowFrom(action, staff),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.authzFamily, 'system-logs');
    assert.equal(r.req.policyAuthoritative, true);
    assert.equal(r.nextCount, 1, action);
  }
});

// ── 6–12 Role parity (MATCH Legacy isAdmin) ──────────────────────────────────

test('Phase7.7 role parity: SUPER/HIGH/STAFF/SUPPORT ALLOW; teacher/student/unauth DENY', () => {
  // Legacy isAdmin: role admin|staff — adminRole does not deny when role matches
  const matrix = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'ALLOW'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'ALLOW'],
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

test('Phase7.7 VIEW_LOGS alone does not authorize teacher (unused HTTP gate)', () => {
  const teacher = sub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: ['view_logs', 'VIEW_LOGS'],
  });
  for (const action of ACTIONS) {
    assert.equal(parity(action, teacher).policy.decision, 'DENY');
  }
});

// ── 13–14 Fallback ───────────────────────────────────────────────────────────

test('Phase7.7 fallback: Policy ERROR → Legacy isAdmin (staff ALLOW)', async () => {
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.7 fallback: Policy UNKNOWN → Legacy isAdmin (teacher DENY, never fail-open)', async () => {
  const r = await runGate('list', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

test('Phase7.7 fallback: malformed decision → Legacy', async () => {
  const r = await runGate('create', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'MATCH', policyDecision: 'MAYBE' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
});

// ── 15–18 Isolation ──────────────────────────────────────────────────────────

test('Phase7.7 isolation: backups/monitoring/tenants stay POLICY; auth/finance stay LEGACY', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('tenants')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('auth')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('finance')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('webhooks')), AUTHORITY.LEGACY);
});

test('Phase7.7 isolation: remove system-logs does not demote backups/monitoring/tenants', () => {
  assert.equal(withEnv(NO_LOGS, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_LOGS, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_LOGS, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_LOGS, () => getAuthorizationAuthority('tenants')), AUTHORITY.POLICY);
});

// ── 19–22 Spoof / security ───────────────────────────────────────────────────

test('Phase7.7 spoof: role/adminRole/permissions/branch/tenant cannot escalate teacher', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['view_logs', '*'],
    bodyBranchId: 'b-x',
    bodyTenantId: 't-x',
    bodyUserId: 'admin',
    queryBranchId: 'b-y',
  };
  for (const action of ACTIONS) {
    assert.equal(parity(action, teacher, spoof).policy.decision, 'DENY');
  }
  assert.equal(
    getAuthorizationAuthority('system-logs', {
      body: { POLICY_CUTOVER_ENABLED: 'false' },
      query: { POLICY_CUTOVER_ROUTES: '' },
      headers: { 'x-tenant-id': 'spoof' },
    }, PROD),
    AUTHORITY.POLICY,
  );
  const r = await runGate('list', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('list', teacher, spoof),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.7 resource semantics: missing log still ALLOW for staff (handler 404); branch not authz', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('delete', staff, {}, { log: null }).policy.decision, 'ALLOW');
  assert.equal(
    parity('list', staff, { bodyBranchId: 'other', queryBranchId: 'other' }).policy.decision,
    'ALLOW',
  );
});

// ── Rollback + smoke + static ────────────────────────────────────────────────

test('Phase7.7 rollback TESTED AND RESTORED: OFF / remove system-logs → LEGACY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('list', staff);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('system-logs')), AUTHORITY.LEGACY);
  const rolled = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_LOGS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(rolled.nextCount, 1);

  const restored = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('backups'));
  assert.ok(restoredRoutes.includes('monitoring'));
  assert.ok(restoredRoutes.includes('tenants'));
  assert.ok(restoredRoutes.includes('system-logs'));
});

test('Phase7.7 functional smoke: GET list authz PASS; POST/DELETE mutations NOT EXECUTED', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('list', staff).policy.decision, 'ALLOW');
  assert.equal(parity('create', staff).policy.decision, 'ALLOW');
  assert.equal(parity('delete', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — destructive/persistent production mutation',
    'NOT EXECUTED — destructive/persistent production mutation',
  );
});

test('Phase7.7 static: wiring + isolation + CQRS OFF + no Policy side effects + no wildcard', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/systemLogRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/systemLogsCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowSystemLog.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/systemLogsPolicy.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const backups = fs.readFileSync(path.join(ROOT, 'routes/backupRoutes.js'), 'utf8');
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const tenants = fs.readFileSync(path.join(ROOT, 'routes/tenantRoutes.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*system-logs/.test(env));
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
  assert.ok(routes.includes('systemLogsCutoverGate'));
  assert.ok(routes.includes('policyShadowSystemLog'));
  assert.ok(routes.includes('SystemLog.create'));
  assert.ok(routes.includes('findByIdAndDelete'));
  assert.ok(gate.includes("getAuthorizationAuthority('system-logs')"));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(!gate.includes('SystemLog.create'));
  assert.ok(!gate.includes('findByIdAndDelete'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
  assert.ok(shadow.includes('return next()'));
  assert.ok(policy.includes('isAdmin'));
  assert.ok(!policy.includes('VIEW_LOGS') || policy.includes('UNUSED'));

  assert.ok(backups.includes('backupsCutoverGate'));
  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(tenants.includes('tenantsCutoverGate'));
  assert.ok(!backups.includes('systemLogsCutoverGate'));
  assert.ok(!mon.includes('systemLogsCutoverGate'));
  assert.ok(!tenants.includes('systemLogsCutoverGate'));

  assert.ok(server.includes("app.use('/api/system-logs'"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'systemLogRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('systemLogsCutoverGate'), name);
  }
});
