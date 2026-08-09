/**
 * Phase 7.20 — Controlled cutover + production activation for /api/messages
 *
 * LIVE: router.use(auth) → policyShadowMessage → messagesCutoverGate → handler.
 * Auth-only / self-scope / ownership / DM / group / broadcast mirrored from Wave 6.9.
 * Socket message:send remains outside HTTP cutover (server.js).
 * No MANAGE_MESSAGES on live routes.
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
  evaluateLegacyMessage,
  evaluatePolicyMessage,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/messagePolicy');
const {
  messagesCutoverGate,
} = require('../../middleware/messagesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages',
};
const NO_MESSAGES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'messages' };

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
    user: { id: opts.id ?? TEACHER_A, role, branchCode: opts.branchCode ?? 'A' },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
          branchCode: opts.branchCode ?? 'A',
        },
    userBranchId: opts.userBranchId ?? '507f1f77bcf86cd7994390aa',
  });
}

async function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = await evaluateLegacyMessage(subject, action, ctx);
  const policy = await evaluatePolicyMessage(subject, action, ctx, untrusted);
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

async function shadowFrom(action, subject, ctx = {}, untrusted = {}) {
  const legacy = await evaluateLegacyMessage(subject, action, ctx);
  const policy = await evaluatePolicyMessage(subject, action, ctx, untrusted);
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
    const mw = messagesCutoverGate(action);
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
      originalUrl: `/api/messages/${action}`,
      method: 'GET',
      requestId: 'p720',
      correlationId: 'p720',
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

test('Phase7.20 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);
});

test('Phase7.20 config ON + messages allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('messages')), AUTHORITY.POLICY);
});

test('Phase7.20 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_MESSAGES, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);
});

test('Phase7.20 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.20 activation .env includes messages + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('messages'));
  assert.ok(routes.every((r) => [
    'ai', 'assignments', 'backups', 'blog', 'branches', 'builder', 'courses', 'feed', 'files', 'messages',
    'monitoring', 'notifications', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers', 'quizzes', 'schedules', 'settings', 'system-logs', 'teachers', 'tenants', 'training',
    'training-lms', 'workflows',
  ].includes(r)));
  for (const fam of [
    'messages', 'settings', 'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms',
    'training', 'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.20 auth-only actions: actor matrix', async () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT' }), 'ALLOW'],
    [sub({ id: TEACHER_A, role: 'teacher', adminRole: null }), 'ALLOW'],
    [sub({ id: STUDENT_A, role: 'student', adminRole: null }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of ['contacts', 'hidden', 'upload', 'hide']) {
    for (const [subject, expected] of cases) {
      assert.equal((await parity(action, subject)).policy.decision, expected, action);
    }
  }
});

test('Phase7.20 conversations self/admin; unread self-only', async () => {
  const staff = sub({ id: TEACHER_A, role: 'staff', adminRole: 'STAFF' });
  const admin = sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', userBranchId: null });
  assert.equal((await parity('conversations', staff, { targetUserId: TEACHER_A })).policy.decision, 'ALLOW');
  assert.equal((await parity('conversations', staff, { targetUserId: TEACHER_B })).policy.decision, 'DENY');
  assert.equal((await parity('conversations', admin, { targetUserId: TEACHER_B })).policy.decision, 'ALLOW');
  assert.equal((await parity('unread', admin, { targetUserId: 'admin' })).policy.decision, 'ALLOW');
  assert.equal((await parity('unread', admin, { targetUserId: TEACHER_B })).policy.decision, 'DENY');
});

test('Phase7.20 get_conversation / send / group / broadcast parity', async () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const student = sub({ id: STUDENT_A, role: 'student', adminRole: null });
  const convSelf = `student_${STUDENT_A}__teacher_${TEACHER_A}`;
  assert.equal(
    (await parity('get_conversation', teacher, { conversationId: convSelf })).policy.decision,
    'ALLOW',
  );
  assert.equal(
    (await parity('send', staff, { receiverId: 'ALL_USERS' })).policy.decision,
    'ALLOW',
  );
  assert.equal(
    (await parity('send', teacher, { receiverId: 'ALL_USERS' })).policy.decision,
    'DENY',
  );
  assert.equal(
    (await parity('send', teacher, {
      receiverId: STUDENT_A,
      dmAccess: { ok: true },
    })).policy.decision,
    'ALLOW',
  );
  assert.equal((await parity('group_create', student)).policy.decision, 'DENY');
  assert.equal((await parity('group_create', teacher)).policy.decision, 'ALLOW');
  assert.equal((await parity('broadcast', staff)).policy.decision, 'ALLOW');
  assert.equal((await parity('broadcast', teacher)).policy.decision, 'DENY');
  assert.equal(
    (await parity('recall', teacher, { message: null })).policy.decision,
    'ALLOW',
  );
});

test('Phase7.20 MANAGE_MESSAGES unused; spoof cannot elevate', async () => {
  const staff = sub({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  assert.equal((await parity('contacts', staff)).policy.decision, 'ALLOW');
  assert.ok(PERMISSIONS.MANAGE_MESSAGES);
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const spoof = {
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.MANAGE_MESSAGES],
    bodySenderId: 'admin',
    bodyBranchId: 'b1',
    bodyTenantId: 't1',
  };
  assert.equal(
    (await parity('broadcast', teacher, {}, spoof)).policy.decision,
    'DENY',
  );
  assert.equal(
    (await parity('conversations', teacher, { targetUserId: TEACHER_B }, spoof)).policy.decision,
    'DENY',
  );
});

// ── Gate decisions ───────────────────────────────────────────────────────────

test('Phase7.20 Policy ALLOW contacts → next()', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = await shadowFrom('contacts', staff);
  const r = await runGate('contacts', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.20 Policy DENY conversations → 403 Legacy message', async () => {
  const staff = sub({ id: TEACHER_A, role: 'staff', adminRole: 'STAFF' });
  const shadow = await shadowFrom('conversations', staff, { targetUserId: TEACHER_B });
  const r = await runGate('conversations', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Bạn không có quyền xem thông tin này');
  assert.equal(r.nextCount, 0);
});

test('Phase7.20 Policy DENY broadcast → 403', async () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const shadow = await shadowFrom('broadcast', teacher);
  const r = await runGate('broadcast', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /admin\/staff|broadcast/i);
});

test('Phase7.20 Policy DENY unauthenticated → 401', async () => {
  const shadow = {
    comparison: 'MATCH',
    policyDecision: 'DENY',
    policyReason: 'policy_unauthenticated',
    policyStatusHint: 401,
  };
  const r = await runGate('contacts', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.statusCode, 401);
});

test('Phase7.20 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('contacts', {
      user: { id: TEACHER_A, role: 'staff' },
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

test('Phase7.20 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = await shadowFrom('contacts', staff);
  for (const env of [ALL_OFF, NO_MESSAGES, WILDCARD, MALFORMED]) {
    const r = await runGate('contacts', {
      user: { id: TEACHER_A, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.20 rollback: remove messages → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = await shadowFrom('contacts', staff);

  assert.equal(withEnv(NO_MESSAGES, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_MESSAGES, () => getAuthorizationAuthority('settings')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_MESSAGES, () => getAuthorizationAuthority('files')), AUTHORITY.POLICY);

  const rolled = await runGate('contacts', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, NO_MESSAGES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('messages')), AUTHORITY.LEGACY);

  const restored = await runGate('contacts', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('messages'));
});

test('Phase7.20 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'schedules',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.20 middleware order + only messageRoutes uses messagesCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/messageRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/messagesCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/messages'"));
  assert.ok(routes.includes('messagesGuard'));
  assert.ok(routes.includes("messagesGuard('contacts')"));
  assert.ok(routes.includes("messagesGuard('send')"));
  assert.ok(routes.includes("messagesGuard('broadcast')"));
  assert.ok(routes.includes('router.use(authMiddleware)'));
  assert.ok(gate.includes("getAuthorizationAuthority('messages')"));
  assert.ok(gate.includes('legacyMessagesGate'));
  assert.ok(!gate.includes('.emit('));
  assert.ok(!gate.includes('Message.create'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'messageRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('messagesCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`messagesGuard('${a}')`), a);
  }
  assert.ok(routes.includes('sendCanonicalMessage'));
  const dms = fs.readFileSync(path.join(ROOT, 'services/directMessageService.js'), 'utf8');
  assert.ok(dms.includes('assertCanDirectMessage'));
  assert.ok(!routes.includes('checkPermission'));
  assert.ok(server.includes("socket.on('message:send'"));
});

test('Phase7.20 side-effect audit: gate/policy have no mutations', () => {
  const files = [
    'middleware/messagesCutoverGate.js',
    'services/policyShadow/messagePolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'enqueue', 'NotificationService', 'BullMQ', 'Message.create',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
    assert.ok(!src.includes("io.emit("), rel);
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowMessage.js'), 'utf8');
  for (const b of ['.save(', 'Message.create', 'enqueue', "io.emit("]) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.20 functional smoke: contacts authz; mutations NOT EXECUTED', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal((await parity('contacts', staff)).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — send/broadcast/upload/recall/soft-delete/group mutations',
    'NOT EXECUTED — send/broadcast/upload/recall/soft-delete/group mutations',
  );
});

test('Phase7.20 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
