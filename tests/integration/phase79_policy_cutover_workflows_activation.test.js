/**
 * Phase 7.9 — Controlled cutover + production activation for /api/workflows
 * (alongside backups, monitoring, tenants, system-logs, ai Policy-primary).
 *
 * Legacy gate: auth + isAdmin (role admin|staff). Advance/realtime stay in Legacy service.
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
  evaluateLegacyWorkflow,
  evaluatePolicyWorkflow,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/workflowPolicy');
const { workflowsCutoverGate } = require('../../middleware/workflowsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai,workflows',
};
const NO_WF = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'workflows' };

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
  const legacy = evaluateLegacyWorkflow(subject, action, ctx);
  const policy = evaluatePolicyWorkflow(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyWorkflow(subject, action, ctx);
  const policy = evaluatePolicyWorkflow(subject, action, ctx, untrusted);
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
    const mw = workflowsCutoverGate(action);
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
      originalUrl: `/api/workflows/${action}`,
      method: 'GET',
      requestId: 'p79',
      correlationId: 'p79',
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

// ── Config / authority ───────────────────────────────────────────────────────

test('Phase7.9 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
});

test('Phase7.9 config ON + workflows allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('workflows')), AUTHORITY.POLICY);
});

test('Phase7.9 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_WF, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
});

test('Phase7.9 malformed configuration → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
});

test('Phase7.9 wildcard rejection → Legacy', () => {
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
});

test('Phase7.9 activation config: .env includes workflows + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('workflows'));
  assert.ok(routes.includes('ai'));
  assert.ok(routes.includes('backups'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  for (const fam of ['workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Policy ALLOW / DENY / parity / actor matrix ───────────────────────────────

test('Phase7.9 Policy ALLOW: staff next() for all LIVE actions', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ACTIONS) {
    const r = await runGate(action, {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadowFrom(action, staff),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.authzFamily, 'workflows');
    assert.equal(r.nextCount, 1, action);
  }
});

test('Phase7.9 Policy DENY: teacher 403 for all LIVE actions', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  for (const action of ACTIONS) {
    const r = await runGate(action, {
      user: { id: 't1', role: 'teacher' },
      policyShadow: shadowFrom(action, teacher),
    }, PROD);
    assert.equal(r.statusCode, 403, action);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
  }
});

test('Phase7.9 Legacy parity MATCH actor matrix (isAdmin admin|staff)', () => {
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

test('Phase7.9 missing instance get/advance: staff ALLOW (handler 404), not Policy DENY', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('get', staff, {}, { instance: null }).policy.decision, 'ALLOW');
  assert.equal(parity('advance', staff, {}, { instance: null }).policy.decision, 'ALLOW');
});

// ── Fallback ─────────────────────────────────────────────────────────────────

test('Phase7.9 Policy ERROR → Legacy isAdmin (staff ALLOW)', async () => {
  const r = await runGate('advance', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.9 Policy UNKNOWN → Legacy isAdmin (teacher DENY, never fail-open)', async () => {
  const r = await runGate('advance', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

// ── Spoof ────────────────────────────────────────────────────────────────────

test('Phase7.9 spoof resistance: role/adminRole/permissions/ids/branch/tenant ignored', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['manage_workflows', '*'],
    bodyUserId: 'admin',
    bodyOwnerId: 'admin',
    bodyCreatedBy: 'admin',
    bodyBranchId: 'b-x',
    bodyTenantId: 't-x',
  };
  for (const action of ['list', 'create', 'advance']) {
    assert.equal(parity(action, teacher, spoof).policy.decision, 'DENY');
  }
  assert.equal(
    getAuthorizationAuthority('workflows', {
      body: { POLICY_CUTOVER_ENABLED: 'false', role: 'admin' },
      query: { POLICY_CUTOVER_ROUTES: '' },
      headers: { role: 'admin' },
    }, PROD),
    AUTHORITY.POLICY,
  );
  const r = await runGate('advance', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('advance', teacher, spoof),
  }, PROD);
  assert.equal(r.statusCode, 403);
});

// ── Advance / realtime / side-effect isolation ───────────────────────────────

test('Phase7.9 advance protection: gate/shadow/policy never call advance or emit', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/workflowsCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowWorkflow.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/workflowPolicy.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/workflowRoutes.js'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'services/workflowService.js'), 'utf8');

  for (const src of [gate, shadow, policy]) {
    assert.ok(!src.includes('workflowService.advance'));
    assert.ok(!src.includes('emitTeacherEvent'));
    assert.ok(!src.includes('emitDataRefresh'));
    assert.ok(!src.includes('syncFromDomain'));
    assert.ok(!/\.save\s*\(/.test(src));
    assert.ok(!src.includes('enqueue('));
    assert.ok(!src.includes('io.emit'));
  }
  // Shadow may lean-read WorkflowInstance for ctx only — no mutation APIs
  assert.ok(!shadow.includes('.create('));
  assert.ok(!shadow.includes('findOneAndUpdate'));
  assert.ok(!shadow.includes('findByIdAndDelete'));

  // Legacy handler/service retain advance + realtime
  assert.ok(routes.includes('workflowService.advance'));
  assert.ok(service.includes('emitTeacherEvent'));
  assert.ok(service.includes('emitDataRefresh'));
});

test('Phase7.9 realtime preservation: emits only in workflowService; no duplicate in gate/shadow', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/workflowsCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowWorkflow.js'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'services/workflowService.js'), 'utf8');
  assert.ok(service.includes('emitTeacherEvent'));
  assert.ok(service.includes('emitDataRefresh'));
  assert.ok(!gate.includes('emitTeacherEvent'));
  assert.ok(!shadow.includes('emitTeacherEvent'));
  assert.ok(!gate.includes('emitDataRefresh'));
  assert.ok(!shadow.includes('emitDataRefresh'));
});

test('Phase7.9 middleware order: auth → shadow → cutover; handlers keep mutations', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/workflowRoutes.js'), 'utf8');
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(routes.includes('policyShadowWorkflow'));
  assert.ok(routes.includes('workflowsCutoverGate'));
  assert.ok(routes.indexOf('policyShadowWorkflow') < routes.indexOf('workflowsCutoverGate'));
  assert.ok(routes.includes('workflowService.advance'));
  assert.ok(routes.includes('workflowService.syncFromDomain'));
  assert.ok(routes.includes('workflowService.start'));
  assert.ok(routes.includes('workflowService.listDefinitions'));
});

// ── Rollback / isolation / smoke / static ────────────────────────────────────

test('Phase7.9 rollback: remove workflows → LEGACY; prior families stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('list', staff);

  assert.equal(withEnv(NO_WF, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_WF, () => getAuthorizationAuthority('ai')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_WF, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_WF, () => getAuthorizationAuthority('system-logs')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_WF);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);

  const restored = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('workflows'));
  assert.ok(restoredRoutes.includes('ai'));
  assert.ok(restoredRoutes.includes('backups'));
});

test('Phase7.9 cross-family isolation: only allowlisted families Policy-primary', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'courses', 'training', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'builder', 'blog', 'feed', 'schedules',
    'messages', 'notifications', 'settings', 'staff', 'branches', 'employees',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows']) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.9 functional smoke: definitions/list authz PASS; create/sync/advance NOT EXECUTED', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('definitions', staff).policy.decision, 'ALLOW');
  assert.equal(parity('list', staff).policy.decision, 'ALLOW');
  assert.equal(parity('get', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/sync/advance production mutation',
    'NOT EXECUTED — create/sync/advance production mutation',
  );
});

test('Phase7.9 static final authority + isolation + CQRS OFF + no wildcard', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/workflowRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/workflowsCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*workflows/.test(env));
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
  assert.ok(gate.includes("getAuthorizationAuthority('workflows')"));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(server.includes("app.use('/api/workflows'"));
  assert.ok(!server.includes("require('./modules/cms"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'workflowRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('workflowsCutoverGate'), name);
  }
});
