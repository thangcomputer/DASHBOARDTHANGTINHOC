/**
 * Phase 7.3 — Controlled Policy-primary cutover prep/verification for /api/backups ONLY.
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
  evaluateLegacyBackup,
  evaluatePolicyBackup,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/backupPolicy');
const { backupsCutoverGate } = require('../../middleware/backupsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const ENV_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const ENV_ON = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups' };
const ENV_MON_ONLY = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring' };

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

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyBackup(subject, action);
  const policy = evaluatePolicyBackup(subject, action, {}, untrusted);
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

function shadowFromSubject(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyBackup(subject, action);
  const policy = evaluatePolicyBackup(subject, action, {}, untrusted);
  return {
    action: `backup_${action}`,
    comparison: compareDecisions(legacy, policy),
    legacyDecision: legacy.decision,
    policyDecision: policy.decision,
    legacyReason: legacy.reason,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
  };
}

function runGate(action, { user, policyShadow, body, query, headers, actorDoc }, env) {
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
      user: user || undefined,
      body: body || {},
      query: query || {},
      headers: headers || {},
      policyShadow: policyShadow || undefined,
      params: { id: '507f1f77bcf86cd799439099' },
      originalUrl: `/api/backups/${action}`,
      method: 'GET',
      requestId: 'p73',
      correlationId: 'p73',
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
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch((err) => {
      statusCode = 500;
      bodyOut = { success: false, message: err.message };
      finish();
    });
  }));
}

// ── Authority helper ─────────────────────────────────────────────────────────

test('Phase7.3 authority: OFF / missing allowlist / monitoring-only / malformed / wildcard → LEGACY; backups ON → POLICY', () => {
  assert.equal(withEnv(ENV_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: '',
  }, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ENV_MON_ONLY, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('monitoring')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: 'backups,monitoring',
  }, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: '*',
  }, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: 'not-a-family',
  }, () => getAuthorizationAuthority('unknown')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'banana',
    POLICY_CUTOVER_ROUTES: 'backups',
  }, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: 'monitoring',
  }, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
});

// ── Role parity (all actions) ────────────────────────────────────────────────

test('Phase7.3 roles: SUPER ALLOW; HIGH/STAFF/SUPPORT/teacher/student/missing DENY — all actions MATCH', () => {
  const roles = [
    [{ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'SUPER_ADMIN' }, 'ALLOW'],
    [{ role: 'admin', adminRole: 'HIGH_ADMIN' }, 'DENY'],
    [{ role: 'staff', adminRole: 'STAFF' }, 'DENY'],
    [{ role: 'staff', adminRole: 'SUPPORT' }, 'DENY'],
    [{ id: 't1', role: 'teacher', adminRole: null }, 'DENY'],
    [{ id: 's1', role: 'student' }, 'DENY'],
    [{ id: '', role: '' }, 'DENY'],
  ];
  for (const action of ACTIONS) {
    for (const [opts, expected] of roles) {
      const s = opts.id === ''
        ? buildSubject({ user: {}, actorDoc: null })
        : sub(opts);
      const { legacy, policy } = parity(action, s);
      assert.equal(legacy.decision, expected, `${action} legacy ${JSON.stringify(opts)}`);
      assert.equal(policy.decision, expected, `${action} policy ${JSON.stringify(opts)}`);
    }
  }
});

test('Phase7.3 resources: missing/malformed id still authz SUPER-only (handler 404 after ALLOW)', () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ['download', 'delete']) {
    assert.equal(parity(action, superS).legacy.decision, 'ALLOW');
    assert.equal(parity(action, staff).legacy.decision, 'DENY');
  }
  assert.equal(parity('create', superS).legacy.decision, 'ALLOW');
  assert.equal(parity('list', superS).legacy.decision, 'ALLOW');
  assert.equal(parity('stats', superS).legacy.decision, 'ALLOW');
});

// ── Spoof ────────────────────────────────────────────────────────────────────

test('Phase7.3 spoof: HIGH_ADMIN/teacher cannot escalate via body/query/header', async () => {
  const high = sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: ['*'] });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodyBranchId: 'b1',
    bodyTenantId: 't1',
  };
  assert.equal(parity('create', high, spoof).policy.decision, 'DENY');

  const r = await runGate('create', {
    user: { id: ACTOR, role: 'admin', adminRole: 'HIGH_ADMIN' },
    actorDoc: { adminRole: 'HIGH_ADMIN', role: 'admin' },
    body: { role: 'admin', adminRole: 'SUPER_ADMIN', permissions: ['all'], userId: 'admin' },
    query: { role: 'admin', adminRole: 'SUPER_ADMIN' },
    headers: { 'x-admin-role': 'SUPER_ADMIN' },
    policyShadow: shadowFromSubject('create', high, spoof),
  }, ENV_ON);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

// ── Gate Legacy vs Policy ────────────────────────────────────────────────────

test('Phase7.3 gate Legacy OFF: hardcoded admin ALLOW; staff DENY via isSuperAdmin', async () => {
  const adminShadow = shadowFromSubject('list', sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }));
  const ok = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: adminShadow,
  }, ENV_OFF);
  assert.equal(ok.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(ok.nextCount, 1);

  const staff = await runGate('list', {
    user: { id: ACTOR, role: 'staff', adminRole: 'STAFF' },
    actorDoc: { adminRole: 'STAFF', role: 'staff' },
    policyShadow: shadowFromSubject('list', sub({ role: 'staff', adminRole: 'STAFF' })),
  }, ENV_OFF);
  assert.equal(staff.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(staff.statusCode, 403);
});

test('Phase7.3 gate Policy ON: SUPER ALLOW skips isSuperAdmin; HIGH DENY', async () => {
  const superS = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  const high = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });

  const ok = await runGate('stats', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: shadowFromSubject('stats', superS),
  }, ENV_ON);
  assert.equal(ok.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(ok.req.policyAuthoritative, true);
  assert.equal(ok.nextCount, 1);

  const deny = await runGate('delete', {
    user: { id: ACTOR, role: 'admin', adminRole: 'HIGH_ADMIN' },
    policyShadow: shadowFromSubject('delete', high),
  }, ENV_ON);
  assert.equal(deny.statusCode, 403);
  assert.match(deny.bodyOut.message, /Super Admin/i);
  assert.equal(deny.nextCount, 0);
});

// ── Rollback + failure safety ────────────────────────────────────────────────

test('Phase7.3 rollback: remove allowlist / OFF restores LEGACY; Policy ERROR/UNKNOWN fallback', async () => {
  assert.equal(withEnv(ENV_ON, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(ENV_OFF, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ENV_MON_ONLY, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);

  const superUser = { id: 'admin', role: 'admin' };
  const errOk = await runGate('list', {
    user: superUser,
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, ENV_ON);
  assert.equal(errOk.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(errOk.nextCount, 1);

  const errDeny = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    actorDoc: { adminRole: 'STAFF', role: 'staff' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, ENV_ON);
  assert.equal(errDeny.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(errDeny.statusCode, 403);

  const malformed = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    actorDoc: { adminRole: 'STAFF', role: 'staff' },
    policyShadow: { comparison: 'MATCH', policyDecision: 'MAYBE' },
  }, ENV_ON);
  assert.equal(malformed.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(malformed.statusCode, 403);
});

// ── Static / side effects ────────────────────────────────────────────────────

test('Phase7.3 static: only backups uses gate; handlers keep queue/create/delete; defaults OFF; no new perms', () => {
  const backups = fs.readFileSync(path.join(ROOT, 'routes/backupRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/backupsCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowBackup.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/backupPolicy.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');

  for (const a of ['stats', 'list', 'create', 'download', 'delete']) {
    assert.ok(backups.includes(`guard('${a}')`), a);
  }
  assert.ok(backups.includes('backupsCutoverGate'));
  assert.ok(backups.includes('policyShadowBackup'));
  assert.ok(backups.includes('backupService.createBackupJob'));
  assert.ok(backups.includes('backupService.deleteBackup'));
  assert.ok(backups.includes("enqueue('notify', 'backup'"));
  assert.ok(backups.includes('isSuperAdmin')); // documented Legacy path

  assert.ok(gate.includes("getAuthorizationAuthority('backups')"));
  assert.ok(gate.includes('isSuperAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(!gate.includes('createBackupJob'));
  assert.ok(!gate.includes('deleteBackup'));
  assert.ok(!/enqueue\s*\(/.test(gate));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
  assert.ok(shadow.includes('return next()'));
  assert.ok(!/res\.status\(403\)/.test(shadow));
  assert.ok(!policy.includes('.save('));

  assert.ok(mon.includes('monitoringCutoverGate'));
  assert.ok(!mon.includes('backupsCutoverGate'));

  const routesDir = path.join(ROOT, 'routes');
  for (const name of fs.readdirSync(routesDir)) {
    if (!name.endsWith('.js') || name === 'backupRoutes.js') continue;
    const src = fs.readFileSync(path.join(routesDir, name), 'utf8');
    assert.ok(!src.includes('backupsCutoverGate'), name);
  }

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  // Phase 7.5 production: ENABLED=true + ROUTES includes backups (+ monitoring)
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*backups/.test(env));
  assert.ok(!/POLICY_CUTOVER_ROUTES\s*=\s*.*\*/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(!perms.includes('MANAGE_BACKUP'));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/report/routes/backupRoutes.js')));
});
