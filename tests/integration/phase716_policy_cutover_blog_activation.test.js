/**
 * Phase 7.16 — Controlled cutover + production activation for /api/blog
 *
 * LIVE: router.use(auth); list auth-only + audience data filter;
 * get audience/draft HTTP 403; manage_* → MANAGE_BLOG.
 * Notifications/socket emit remain in handlers only.
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
  evaluateLegacyBlog,
  evaluatePolicyBlog,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/blogPolicy');
const {
  blogCutoverGate,
  MANAGE_ACTIONS,
} = require('../../middleware/blogCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog',
};
const NO_BLOG = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'blog' };

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

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyBlog(subject, action, ctx);
  const policy = evaluatePolicyBlog(subject, action, ctx, untrusted);
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

function shadowFrom(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyBlog(subject, action, ctx);
  const policy = evaluatePolicyBlog(subject, action, ctx, untrusted);
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
    const mw = blogCutoverGate(action);
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
      originalUrl: `/api/blog/${action}`,
      method: 'GET',
      requestId: 'p716',
      correlationId: 'p716',
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

test('Phase7.16 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
});

test('Phase7.16 config ON + blog allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('blog')), AUTHORITY.POLICY);
});

test('Phase7.16 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_BLOG, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
});

test('Phase7.16 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.16 activation .env includes blog + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses',
    'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.16 list: authenticated ALLOW; unauthenticated DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher' }), 'ALLOW'],
    [sub({ id: 's1', role: 'student' }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const [subject, expected] of cases) {
    assert.equal(parity('list', subject).policy.decision, expected);
  }
});

test('Phase7.16 get: audience DENY; missing → ALLOW(404); manage draft needs MANAGE_BLOG', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const student = sub({ id: 's1', role: 'student' });
  const staff = sub({ role: 'staff', permissions: [] });
  const manager = sub({ permissions: [PERMISSIONS.MANAGE_BLOG] });

  assert.equal(
    parity('get', teacher, { post: { status: 'published', targetAudience: 'student' } }).policy.decision,
    'DENY',
  );
  assert.equal(
    parity('get', student, { post: { status: 'published', targetAudience: 'teacher' } }).policy.decision,
    'DENY',
  );
  assert.equal(
    parity('get', teacher, { post: { status: 'published', targetAudience: 'all' } }).policy.decision,
    'ALLOW',
  );
  assert.equal(parity('get', teacher, { post: null }).policy.decision, 'ALLOW');
  assert.equal(
    parity('get', staff, {
      manageQuery: true,
      post: { status: 'draft', targetAudience: 'all' },
    }).policy.decision,
    'DENY',
  );
  assert.equal(
    parity('get', manager, {
      manageQuery: true,
      post: { status: 'draft', targetAudience: 'all' },
    }).policy.decision,
    'ALLOW',
  );
});

test('Phase7.16 manage: MANAGE_BLOG / SUPER / hardcoded ALLOW; others DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', permissions: [PERMISSIONS.MANAGE_BLOG] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.MANAGE_BLOG] }), 'ALLOW'],
    [sub({ role: 'staff', permissions: [] }), 'DENY'],
    [sub({ id: 't1', role: 'teacher', permissions: [PERMISSIONS.MANAGE_BLOG] }), 'DENY'],
    [sub({ id: 's1', role: 'student' }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of MANAGE_ACTIONS) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject, { post: { status: 'draft' } }).policy.decision, expected, action);
    }
  }
});

test('Phase7.16 spoof resistance: body role/permissions/authorId do not elevate', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_BLOG],
    bodyAuthorId: 'admin',
    bodyBranchId: 'b1',
    bodyTenantId: 't1',
  };
  assert.equal(parity('manage_create', teacher, {}, spoof).policy.decision, 'DENY');
  assert.equal(parity('list', teacher, {}, spoof).policy.decision, 'ALLOW');
});

// ── Gate ─────────────────────────────────────────────────────────────────────

test('Phase7.16 Policy ALLOW list → next()', async () => {
  const student = sub({ id: 's1', role: 'student' });
  const r = await runGate('list', {
    user: { id: 's1', role: 'student' },
    policyShadow: shadowFrom('list', student),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.16 Policy DENY audience → 403 Legacy message', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const ctx = { post: { status: 'published', targetAudience: 'student' } };
  const r = await runGate('get', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('get', teacher, ctx),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Bài viết này dành cho Học viên');
});

test('Phase7.16 Policy ALLOW manage with MANAGE_BLOG → next()', async () => {
  const staff = sub({ permissions: [PERMISSIONS.MANAGE_BLOG] });
  const r = await runGate('manage_create', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('manage_create', staff),
  }, PROD);
  assert.equal(r.nextCount, 1);
});

test('Phase7.16 Policy DENY manage without permission → 403', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const r = await runGate('manage_list', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('manage_list', teacher),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.nextCount, 0);
});

test('Phase7.16 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
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

test('Phase7.16 cutover OFF / exclusion → Legacy next()', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('list', staff);
  for (const env of [ALL_OFF, NO_BLOG, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.16 rollback: remove blog → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('list', staff);

  assert.equal(withEnv(NO_BLOG, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_BLOG, () => getAuthorizationAuthority('notifications')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_BLOG, () => getAuthorizationAuthority('branches')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_BLOG);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('blog')), AUTHORITY.LEGACY);

  const restored = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('blog'));
});

test('Phase7.16 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'feed', 'schedules', 'messages', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.16 middleware order + only blogRoutes uses blogCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/blogRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/blogCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/blog'"));
  assert.ok(routes.includes('router.use(authMiddleware)'));
  assert.ok(routes.includes("blogCutoverGate('list')"));
  assert.ok(routes.includes("blogCutoverGate('get')"));
  assert.ok(routes.includes('manageGuard'));
  assert.ok(gate.includes("getAuthorizationAuthority('blog')"));
  assert.ok(gate.includes('legacyBlogGate'));
  assert.ok(gate.includes('MANAGE_BLOG'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'blogRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('blogCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    if (a === 'list' || a === 'get') {
      assert.ok(routes.includes(`blogCutoverGate('${a}')`), a);
    } else {
      assert.ok(routes.includes(`manageGuard('${a}')`), a);
    }
  }
});

test('Phase7.16 side-effect audit: gate + blog policy have no mutations', () => {
  const files = [
    'middleware/blogCutoverGate.js',
    'middleware/policyShadowBlog.js',
    'services/policyShadow/blogPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'enqueue', '.emit(', 'sendNotification', 'NotificationService', 'BullMQ',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
  // Read-only lean lookups allowed in shadow
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowBlog.js'), 'utf8');
  assert.ok(shadow.includes('.lean()'));
});

test('Phase7.16 functional smoke: list/get authz; mutations NOT EXECUTED', () => {
  const student = sub({ id: 's1', role: 'student' });
  assert.equal(parity('list', student).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/publish/hide/delete/upload production mutation',
    'NOT EXECUTED — create/update/publish/hide/delete/upload production mutation',
  );
  assert.ok(MANAGE_ACTIONS.has('manage_publish'));
});

test('Phase7.16 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog(?:,feed(?:,files(?:,settings(?:,messages(?:,schedules(?:,quizzes(?:,assignments(?:,proctor(?:,evaluations(?:,bi(?:,analytics(?:,staff(?:,employees(?:,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
