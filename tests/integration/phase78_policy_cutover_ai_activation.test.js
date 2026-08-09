/**
 * Phase 7.8 — Controlled cutover + production activation for /api/ai
 * (alongside backups, monitoring, tenants, system-logs Policy-primary).
 *
 * Legacy gate: auth + isAdmin (role admin|staff). sensitiveFlowLimiter is rate control, not authz.
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
  evaluateLegacyAi,
  evaluatePolicyAi,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/aiPolicy');
const { aiCutoverGate } = require('../../middleware/aiCutoverGate');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs,ai',
};
const NO_AI = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES: 'backups,monitoring,tenants,system-logs',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'ai' };

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
  const legacy = evaluateLegacyAi(subject, action);
  const policy = evaluatePolicyAi(subject, action, {}, untrusted);
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
  const legacy = evaluateLegacyAi(subject, action);
  const policy = evaluatePolicyAi(subject, action, {}, untrusted);
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
    const mw = aiCutoverGate(action);
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
      originalUrl: `/api/ai/${action}`,
      method: 'GET',
      requestId: 'p78',
      correlationId: 'p78',
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

// ── Authority ────────────────────────────────────────────────────────────────

test('Phase7.8 authority: cutover OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
});

test('Phase7.8 authority: ai not allowlisted → Legacy', () => {
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
});

test('Phase7.8 authority: ai allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('ai')), AUTHORITY.POLICY);
});

test('Phase7.8 authority: malformed ENABLED → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
});

test('Phase7.8 authority: wildcard ROUTES → Legacy (never global)', () => {
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('backups')), AUTHORITY.LEGACY);
});

test('Phase7.8 activation config: .env ENABLED=true ROUTES includes ai + prior families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('ai'));
  assert.ok(routes.includes('backups'));
  assert.ok(routes.includes('monitoring'));
  assert.ok(routes.includes('tenants'));
  assert.ok(routes.includes('system-logs'));
  assert.ok(routes.every((r) => ['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers'].includes(r)));
  for (const fam of ['ai', 'backups', 'monitoring', 'tenants', 'system-logs']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'invoices', 'webhooks']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Role parity ──────────────────────────────────────────────────────────────

test('Phase7.8 role parity SUPER_ADMIN ALLOW all AI actions', () => {
  const s = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'ALLOW');
  }
});

test('Phase7.8 role parity HIGH_ADMIN ALLOW (role=admin isAdmin)', () => {
  const s = sub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'ALLOW');
  }
});

test('Phase7.8 role parity STAFF ALLOW', () => {
  const s = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'ALLOW');
  }
});

test('Phase7.8 role parity SUPPORT ALLOW (role=staff isAdmin)', () => {
  const s = sub({ role: 'staff', adminRole: 'SUPPORT' });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'ALLOW');
  }
});

test('Phase7.8 role parity TEACHER DENY', () => {
  const s = sub({ id: 't1', role: 'teacher', adminRole: null });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'DENY');
  }
});

test('Phase7.8 role parity STUDENT DENY', () => {
  const s = sub({ id: 's1', role: 'student' });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'DENY');
  }
});

test('Phase7.8 role parity unauthenticated DENY', () => {
  const s = buildSubject({ user: {}, actorDoc: null });
  for (const action of ACTIONS) {
    assert.equal(parity(action, s).policy.decision, 'DENY');
  }
});

// ── Actions under Policy gate ────────────────────────────────────────────────

test('Phase7.8 actions: status/quiz/notification_draft/summarize/complete → POLICY ALLOW for staff', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  for (const action of ['status', 'quiz', 'notification_draft', 'summarize', 'complete']) {
    const r = await runGate(action, {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadowFrom(action, staff),
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.POLICY, action);
    assert.equal(r.req.authzFamily, 'ai');
    assert.equal(r.nextCount, 1, action);
  }
});

test('Phase7.8 actions: teacher DENY all five under Policy authority', async () => {
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

// ── Fallback ─────────────────────────────────────────────────────────────────

test('Phase7.8 fallback: Policy ERROR → Legacy isAdmin (staff ALLOW)', async () => {
  const r = await runGate('status', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: { comparison: 'ERROR', policyDecision: undefined },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.8 fallback: Policy UNKNOWN → Legacy isAdmin (teacher DENY, never fail-open)', async () => {
  const r = await runGate('quiz', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'ALLOW' },
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

// ── Spoof ────────────────────────────────────────────────────────────────────

test('Phase7.8 spoof: role/adminRole/permissions/userId/branch/tenant cannot escalate teacher', async () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['manage_ai', '*'],
    bodyUserId: 'admin',
    bodyBranchId: 'b-x',
    bodyTenantId: 't-x',
  };
  for (const action of ACTIONS) {
    assert.equal(parity(action, teacher, spoof).policy.decision, 'DENY');
  }
  assert.equal(
    getAuthorizationAuthority('ai', {
      body: { POLICY_CUTOVER_ENABLED: 'false', role: 'admin' },
      query: { POLICY_CUTOVER_ROUTES: '', adminRole: 'SUPER_ADMIN' },
      headers: { role: 'admin', 'x-tenant-id': 'spoof' },
    }, PROD),
    AUTHORITY.POLICY,
  );
  const r = await runGate('complete', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('complete', teacher, spoof),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

// ── Isolation ────────────────────────────────────────────────────────────────

test('Phase7.8 isolation: backups/monitoring/tenants/system-logs stay POLICY; workflows/auth LEGACY', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('tenants')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('system-logs')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('workflows')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('auth')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('finance')), AUTHORITY.LEGACY);
});

test('Phase7.8 isolation: remove ai does not demote prior Policy families', () => {
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('backups')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('monitoring')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('tenants')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_AI, () => getAuthorizationAuthority('system-logs')), AUTHORITY.POLICY);
});

// ── Rollback / smoke / static ────────────────────────────────────────────────

test('Phase7.8 rollback TESTED AND RESTORED: OFF / remove ai → LEGACY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('status', staff);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('ai')), AUTHORITY.LEGACY);
  const rolled = await runGate('status', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_AI);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);
  assert.equal(rolled.nextCount, 1);

  const restored = await runGate('status', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('ai'));
  assert.ok(restoredRoutes.includes('backups'));
  assert.ok(restoredRoutes.includes('system-logs'));
});

test('Phase7.8 functional smoke: status authz PASS; POST AI ops NOT EXECUTED', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('status', staff).policy.decision, 'ALLOW');
  for (const action of ['quiz', 'notification_draft', 'summarize', 'complete']) {
    assert.equal(parity(action, staff).policy.decision, 'ALLOW');
  }
  assert.equal(
    'NOT EXECUTED — AI provider / cost-bearing production operation',
    'NOT EXECUTED — AI provider / cost-bearing production operation',
  );
});

test('Phase7.8 static: wiring + limiter order + isolation + CQRS OFF + no side effects', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/aiRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/aiCutoverGate.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowAi.js'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/aiPolicy.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(/POLICY_CUTOVER_ROUTES\s*=\s*.*ai/.test(env));
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
  assert.ok(routes.includes('aiCutoverGate'));
  assert.ok(routes.includes('policyShadowAi'));
  assert.ok(routes.includes('sensitiveFlowLimiter'));
  // Order: cutover gate before limiter
  assert.ok(routes.indexOf('aiCutoverGate') < routes.indexOf('sensitiveFlowLimiter'));
  assert.ok(routes.includes('aiService.probeHealth'));
  assert.ok(routes.includes('aiService.generateQuiz'));
  assert.ok(routes.includes('aiService.draftNotification'));
  assert.ok(routes.includes('aiService.summarizeText'));
  assert.ok(routes.includes('aiService.complete'));

  assert.ok(gate.includes("getAuthorizationAuthority('ai')"));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(gate.includes('POLICY_CUTOVER_FALLBACK'));
  assert.ok(!gate.includes('generateQuiz'));
  assert.ok(!gate.includes('probeHealth'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('.save('));
  assert.ok(shadow.includes('return next()'));
  assert.ok(!shadow.includes('generateQuiz'));
  assert.ok(policy.includes('isAdmin') || policy.includes('role_admin_or_staff'));
  assert.ok(!policy.includes('MANAGE_AI'));

  assert.ok(server.includes("app.use('/api/ai'"));
  assert.ok(!server.includes("require('./modules/ai"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'aiRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('aiCutoverGate'), name);
  }
});
