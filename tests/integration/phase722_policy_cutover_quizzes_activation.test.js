/**
 * Phase 7.22 — Controlled cutover + production activation for /api/quizzes
 *
 * LIVE:
 *   auth → policyShadowQuiz → quizzesCutoverGate → handler (auth-only actions)
 *   auth → branchFilter → policyShadowQuizAdminRead → quizzesCutoverGate(admin_read)
 *     → Legacy checkPermission(MANAGE_TRAINING) when not Policy-primary
 *
 * Delete ownership / submit / list scoping remain handler-owned.
 * modules/exam/routes/quizRoutes.js is unmounted — not migrated.
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
  evaluateLegacyQuiz,
  evaluatePolicyQuiz,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/quizPolicy');
const {
  buildSubject: buildAdminSubject,
  evaluateLegacyQuizAdminRead,
  evaluatePolicyQuizAdminRead,
  compareDecisions: compareAdminDecisions,
} = require('../../services/policyShadow/quizAdminReadPolicy');
const {
  quizzesCutoverGate,
  AUTH_ONLY_ACTIONS,
} = require('../../middleware/quizzesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes',
};
const NO_QUIZZES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'quizzes' };

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
    user: { id: opts.id ?? TEACHER_A, role },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? BRANCH_A,
  });
}

function adminSub(opts = {}) {
  return buildAdminSubject({
    user: { id: opts.id ?? TEACHER_A, role: opts.role ?? 'staff' },
    actorDoc: {
      role: opts.role ?? 'staff',
      adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
      permissions: opts.permissions ?? [],
    },
    userBranchId: opts.userBranchId !== undefined ? opts.userBranchId : BRANCH_A,
  });
}

function parity(action, subject, untrusted = {}) {
  const legacy = evaluateLegacyQuiz(subject, action);
  const policy = evaluatePolicyQuiz(subject, action, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH', action);
  return { legacy, policy };
}

function parityAdmin(subject, untrusted = {}) {
  const legacy = evaluateLegacyQuizAdminRead(subject);
  const policy = evaluatePolicyQuizAdminRead(subject, untrusted);
  assert.equal(compareAdminDecisions(legacy, policy), 'MATCH', 'admin_read');
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
  if (action === 'admin_read') {
    const legacy = evaluateLegacyQuizAdminRead(subject);
    const policy = evaluatePolicyQuizAdminRead(subject, untrusted);
    return {
      comparison: compareAdminDecisions(legacy, policy),
      policyDecision: policy.decision,
      policyReason: policy.reason,
      policyStatusHint: policy.statusHint,
      legacyDecision: legacy.decision,
    };
  }
  const legacy = evaluateLegacyQuiz(subject, action);
  const policy = evaluatePolicyQuiz(subject, action, untrusted);
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
    const mw = quizzesCutoverGate(action);
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
      originalUrl: `/api/quizzes/${action}`,
      method: 'GET',
      requestId: 'p722',
      correlationId: 'p722',
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
    // Legacy admin_read invokes async checkPermission — stub Teacher via next-only path when POLICY
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch((err) => {
      statusCode = 500;
      bodyOut = { message: err.message };
      finish();
    });
  }));
}

// ── Config ───────────────────────────────────────────────────────────────────

test('Phase7.22 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
});

test('Phase7.22 config ON + quizzes allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('quizzes')), AUTHORITY.POLICY);
});

test('Phase7.22 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_QUIZZES, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
});

test('Phase7.22 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.22 activation .env includes quizzes + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('quizzes'));
  assert.ok(routes.every((r) => [
    'ai', 'assignments', 'backups', 'blog', 'branches', 'builder', 'courses', 'feed', 'files',
    'messages', 'monitoring', 'notifications', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers', 'quizzes', 'schedules', 'settings',
    'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
  ].includes(r)));
  for (const fam of [
    'quizzes', 'schedules', 'messages', 'settings', 'files', 'feed', 'blog', 'notifications',
    'branches', 'training-lms', 'training', 'courses', 'builder', 'workflows', 'ai', 'backups',
    'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.22 auth-only actions: authenticated ALLOW; unauthenticated DENY', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const student = sub({ id: STUDENT_A, role: 'student', adminRole: null });
  const staff = sub({ role: 'staff', adminRole: 'STAFF', permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null });

  for (const action of ACTIONS) {
    assert.equal(parity(action, teacher).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, student).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, staff).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, unauth).policy.decision, 'DENY', action);
  }
});

test('Phase7.22 admin_read: MANAGE_TRAINING matrix + branch scope descriptor', () => {
  assert.equal(
    parityAdmin(adminSub({
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      userBranchId: null,
    })).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parityAdmin(adminSub({
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_TRAINING],
    })).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parityAdmin(adminSub({
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    })).policy.decision,
    'DENY',
  );
  assert.equal(
    parityAdmin(adminSub({
      id: STUDENT_A,
      role: 'teacher',
      adminRole: null,
      permissions: [PERMISSIONS.MANAGE_TRAINING],
    })).policy.decision,
    'DENY',
  );
  const scoped = parityAdmin(adminSub({
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  }));
  assert.equal(scoped.policy.scope.mode, 'teacher_branch');
});

test('Phase7.22 spoof resistance: role/permissions/teacherId/branch cannot elevate', () => {
  const weak = sub({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  for (const action of ACTIONS) {
    const r = parity(action, weak, {
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
      bodyTeacherId: 'spoof',
      bodyBranchId: BRANCH_A,
      targetStudentIds: [STUDENT_A],
    });
    assert.equal(r.policy.decision, 'ALLOW');
  }
  const denied = parityAdmin(adminSub({
    role: 'teacher',
    adminRole: null,
    permissions: [],
  }), {
    clientRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
    clientTeacherId: 'x',
    bodyBranchId: BRANCH_A,
    queryTenantId: 't1',
  });
  assert.equal(denied.policy.decision, 'DENY');
});

// ── Gate ─────────────────────────────────────────────────────────────────────

test('Phase7.22 Policy ALLOW create → next()', async () => {
  const subject = sub({ role: 'teacher', adminRole: null });
  const shadow = shadowFrom('create', subject);
  const r = await runGate('create', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.22 Policy DENY admin_read → 403 Legacy message', async () => {
  const subject = adminSub({
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const shadow = shadowFrom('admin_read', subject);
  const r = await runGate('admin_read', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.ok(String(r.bodyOut?.message || '').includes('Admin/Staff'));
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.22 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const shadow = shadowFrom('create', subject);
  const r = await runGate('create', {
    user: null,
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.22 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('create', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('create', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.22 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('create', sub({ role: 'teacher', adminRole: null }));
  for (const env of [ALL_OFF, NO_QUIZZES, WILDCARD, MALFORMED]) {
    const r = await runGate('create', {
      user: { id: TEACHER_A, role: 'teacher' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.22 rollback: remove quizzes → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_QUIZZES, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_QUIZZES, () => getAuthorizationAuthority('schedules')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_QUIZZES, () => getAuthorizationAuthority('messages')), AUTHORITY.POLICY);

  const shadow = shadowFrom('create', sub({ role: 'teacher', adminRole: null }));
  const rolled = await runGate('create', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, NO_QUIZZES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('quizzes')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('quizzes')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('schedules')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('quizzes'));
});

test('Phase7.22 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'assignments', 'evaluations', 
    'proctor',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.22 middleware order + only quizRoutes uses quizzesCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/quizRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/quizzesCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/quizzes'"));
  assert.ok(server.includes("require('./routes/quizRoutes')"));
  assert.ok(!server.includes("require('./modules/exam/routes/quizRoutes"));
  assert.ok(routes.includes('quizzesGuard'));
  assert.ok(routes.includes('quizzesAdminGuard'));
  assert.ok(routes.includes("quizzesGuard('create')"));
  assert.ok(routes.includes("quizzesCutoverGate('admin_read')") || routes.includes('quizzesAdminGuard()'));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('quizzes')"));
  assert.ok(gate.includes('legacyQuizzesGate'));
  assert.ok(gate.includes('MANAGE_TRAINING'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'quizRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('quizzesCutoverGate'), name);
  }
  for (const a of AUTH_ONLY_ACTIONS) {
    assert.ok(routes.includes(`quizzesGuard('${a}')`), a);
  }
  assert.ok(routes.includes('findOneAndDelete'));
  assert.ok(routes.includes('quiz.save'));
});

test('Phase7.22 side-effect audit: gate/policy have no mutations', () => {
  const files = [
    'middleware/quizzesCutoverGate.js',
    'services/policyShadow/quizPolicy.js',
    'services/policyShadow/quizAdminReadPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'NotificationService', 'BullMQ', 'emitScheduleEvent',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
    assert.ok(!src.includes('queue.add'), rel);
    assert.ok(!src.includes("io.emit("), rel);
  }
  for (const rel of [
    'middleware/policyShadowQuiz.js',
    'middleware/policyShadowQuizAdminRead.js',
  ]) {
    const shadow = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', 'NotificationService', "io.emit("]) {
      assert.ok(!shadow.includes(b), `${rel} must not contain ${b}`);
    }
    assert.ok(shadow.includes('.lean()'));
    assert.ok(shadow.includes('policyStatusHint'));
  }
});

test('Phase7.22 functional smoke: list/admin authz; mutations NOT EXECUTED', () => {
  assert.equal(parity('teacher_list', sub({ role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(
    parityAdmin(adminSub({ permissions: [PERMISSIONS.MANAGE_TRAINING] })).policy.decision,
    'ALLOW',
  );
  assert.equal(
    'NOT EXECUTED — create/delete/submit production mutation',
    'NOT EXECUTED — create/delete/submit production mutation',
  );
});

test('Phase7.22 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
