/**
 * Phase 7.17 — Controlled cutover + production activation for /api/feed
 *
 * LIVE: authMiddleware → policyShadowFeed → feedCutoverGate → handler.
 * Auth-only for list/create/upload/like/react/comment.
 * delete_post / delete_comment: adminLike OR ownership (handler still owns Legacy path).
 * Socket feed_room emits remain in handlers only.
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
  evaluateLegacyFeed,
  evaluatePolicyFeed,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/feedPolicy');
const {
  feedCutoverGate,
} = require('../../middleware/feedCutoverGate');

const ROOT = path.join(__dirname, '../..');
const AUTHOR = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed',
};
const NO_FEED = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'feed' };

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
  const role = opts.role ?? 'student';
  return buildSubject({
    user: { id: opts.id ?? AUTHOR, role, adminRole: opts.adminRole },
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
  const legacy = evaluateLegacyFeed(subject, action, ctx);
  const policy = evaluatePolicyFeed(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyFeed(subject, action, ctx);
  const policy = evaluatePolicyFeed(subject, action, ctx, untrusted);
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
    const mw = feedCutoverGate(action);
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
      originalUrl: `/api/feed/${action}`,
      method: 'GET',
      requestId: 'p717',
      correlationId: 'p717',
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

test('Phase7.17 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);
});

test('Phase7.17 config ON + feed allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('feed')), AUTHORITY.POLICY);
});

test('Phase7.17 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_FEED, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);
});

test('Phase7.17 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.17 activation .env includes feed + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses',
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

test('Phase7.17 auth-only actions: actor matrix', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ id: 'ha', role: 'admin', adminRole: 'HIGH_ADMIN' }), 'ALLOW'],
    [sub({ id: 'st', role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ id: 'su', role: 'staff', adminRole: 'SUPPORT' }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher' }), 'ALLOW'],
    [sub({ id: 's1', role: 'student' }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of ['list', 'create', 'upload', 'like', 'react', 'comment']) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}`);
    }
  }
});

test('Phase7.17 delete_post: owner/admin ALLOW; stranger DENY; missing → ALLOW(404)', () => {
  const owner = sub({ id: AUTHOR, role: 'student' });
  const other = sub({ id: OTHER, role: 'student' });
  const staff = sub({ id: 'st1', role: 'staff', adminRole: 'STAFF' });
  const teacher = sub({ id: 't1', role: 'teacher' });
  const post = { authorId: AUTHOR };

  assert.equal(parity('delete_post', owner, { post }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_post', other, { post }).policy.decision, 'DENY');
  assert.equal(parity('delete_post', staff, { post }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_post', teacher, { post }).policy.decision, 'DENY');
  assert.equal(parity('delete_post', owner, { post: null }).policy.decision, 'ALLOW');
});

test('Phase7.17 delete_comment: commenter / post author / admin; missing → ALLOW(404)', () => {
  const postAuthor = sub({ id: AUTHOR, role: 'student' });
  const commenter = sub({ id: OTHER, role: 'student' });
  const stranger = sub({ id: 'x1', role: 'student' });
  const staff = sub({ id: 'st1', role: 'staff', adminRole: 'STAFF' });
  const post = { authorId: AUTHOR };
  const comment = { authorId: OTHER };

  assert.equal(parity('delete_comment', commenter, { post, comment }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_comment', postAuthor, { post, comment }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_comment', stranger, { post, comment }).policy.decision, 'DENY');
  assert.equal(parity('delete_comment', staff, { post, comment }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_comment', commenter, { post: null, comment: null }).policy.decision, 'ALLOW');
  assert.equal(parity('delete_comment', commenter, { post, comment: null }).policy.decision, 'ALLOW');
});

test('Phase7.17 spoof resistance: body role/authorId/branch/tenant do not elevate', () => {
  const other = sub({ id: OTHER, role: 'student' });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['*'],
    bodyAuthorId: AUTHOR,
    bodyUserId: AUTHOR,
    bodyBranchId: 'b1',
    bodyTenantId: 't1',
  };
  assert.equal(
    parity('delete_post', other, { post: { authorId: AUTHOR } }, spoof).policy.decision,
    'DENY',
  );
  assert.equal(parity('list', other, {}, spoof).policy.decision, 'ALLOW');
});

// ── Gate decisions ───────────────────────────────────────────────────────────

test('Phase7.17 Policy ALLOW → next()', async () => {
  const student = sub({ id: AUTHOR, role: 'student' });
  const shadow = shadowFrom('list', student);
  const r = await runGate('list', {
    user: { id: AUTHOR, role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
  assert.equal(r.statusCode, null);
});

test('Phase7.17 Policy DENY delete_post → 403 Legacy message', async () => {
  const other = sub({ id: OTHER, role: 'student' });
  const shadow = shadowFrom('delete_post', other, { post: { authorId: AUTHOR } });
  const r = await runGate('delete_post', {
    user: { id: OTHER, role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Ban khong co quyen xoa bai nay');
});

test('Phase7.17 Policy DENY delete_comment → 403 Legacy message', async () => {
  const stranger = sub({ id: 'x1', role: 'student' });
  const shadow = shadowFrom('delete_comment', stranger, {
    post: { authorId: AUTHOR },
    comment: { authorId: OTHER },
  });
  const r = await runGate('delete_comment', {
    user: { id: 'x1', role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Ban khong co quyen xoa binh luan nay');
});

test('Phase7.17 Policy DENY unauthenticated → 401', async () => {
  const shadow = {
    comparison: 'MATCH',
    policyDecision: 'DENY',
    policyReason: 'policy_unauthenticated',
    policyStatusHint: 401,
  };
  const r = await runGate('list', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.statusCode, 401);
  assert.equal(r.nextCount, 0);
});

test('Phase7.17 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('list', {
      user: { id: AUTHOR, role: 'student' },
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

test('Phase7.17 cutover OFF / exclusion / wildcard / malformed → Legacy next()', async () => {
  const student = sub({ id: AUTHOR, role: 'student' });
  const shadow = shadowFrom('list', student);
  for (const env of [ALL_OFF, NO_FEED, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: AUTHOR, role: 'student' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.17 rollback: remove feed → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const student = sub({ id: AUTHOR, role: 'student' });
  const shadow = shadowFrom('list', student);

  assert.equal(withEnv(NO_FEED, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_FEED, () => getAuthorizationAuthority('blog')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_FEED, () => getAuthorizationAuthority('notifications')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: AUTHOR, role: 'student' },
    policyShadow: shadow,
  }, NO_FEED);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('feed')), AUTHORITY.LEGACY);

  const restored = await runGate('list', {
    user: { id: AUTHOR, role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('feed'));
});

test('Phase7.17 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'files', 'schedules', 'messages', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.17 middleware order + only feedRoutes uses feedCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/feedRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/feedCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/feed'"));
  assert.ok(routes.includes('feedGuard'));
  assert.ok(routes.includes("feedGuard('list')"));
  assert.ok(routes.includes("feedGuard('delete_post')"));
  assert.ok(routes.includes("feedGuard('delete_comment')"));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('feed')"));
  assert.ok(gate.includes('legacyFeedGate'));
  assert.ok(gate.includes("io.to('feed_room')") === false);
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'feedRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('feedCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`feedGuard('${a}')`), a);
  }
  assert.ok(routes.includes("io.to('feed_room').emit"));
  assert.ok(routes.includes('canDeletePost'));
});

test('Phase7.17 side-effect audit: gate + feed policy have no mutations', () => {
  const files = [
    'middleware/feedCutoverGate.js',
    'services/policyShadow/feedPolicy.js',
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
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowFeed.js'), 'utf8');
  for (const b of ['.save(', '.create(', 'enqueue', '.emit(', 'NotificationService']) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.17 functional smoke: list authz; mutations NOT EXECUTED', () => {
  const student = sub({ id: AUTHOR, role: 'student' });
  assert.equal(parity('list', student).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/delete/like/react/comment/upload production mutation',
    'NOT EXECUTED — create/delete/like/react/comment/upload production mutation',
  );
});

test('Phase7.17 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
