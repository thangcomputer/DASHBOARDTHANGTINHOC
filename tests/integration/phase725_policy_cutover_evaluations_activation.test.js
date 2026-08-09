/**
 * Phase 7.25 — Controlled cutover + production activation for /api/evaluations
 *
 * LIVE: auth → policyShadowEvaluation → evaluationsCutoverGate → handler.
 * Role/ownership remain handler-owned on Legacy; create side effects handler-owned.
 * modules/exam/routes/evaluationRoutes.js is unmounted — not migrated.
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
  evaluateLegacyEvaluation,
  evaluatePolicyEvaluation,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/evaluationsPolicy');
const {
  evaluationsCutoverGate,
} = require('../../middleware/evaluationsCutoverGate');

const ROOT = path.join(__dirname, '../..');
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations',
};
const NO_EVALUATIONS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'evaluations' };

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

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyEvaluation(subject, action, ctx);
  const policy = evaluatePolicyEvaluation(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyEvaluation(subject, action, ctx);
  const policy = evaluatePolicyEvaluation(subject, action, ctx, untrusted);
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
    const mw = evaluationsCutoverGate(action);
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
      originalUrl: `/api/evaluations/${action}`,
      method: 'GET',
      requestId: 'p725',
      correlationId: 'p725',
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

test('Phase7.25 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
});

test('Phase7.25 config ON + evaluations allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('evaluations')), AUTHORITY.POLICY);
});

test('Phase7.25 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_EVALUATIONS, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
});

test('Phase7.25 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.25 activation .env includes evaluations + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees', 'evaluations', 'exam-results', 'feed',
      'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings', 'staff',
      'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'teachers', 'exam-results', 'employees', 'staff', 'evaluations', 'analytics', 'bi', 'proctor', 'assignments', 'quizzes', 'schedules', 'messages', 'settings', 'files',
    'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder',
    'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.25 parity actor matrix', () => {
  const staff = sub({ role: 'staff' });
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const student = sub({ id: STUDENT_A, role: 'student' });
  const unauth = buildSubject({ user: {}, actorDoc: null });

  assert.equal(parity('admin_list', staff).policy.decision, 'ALLOW');
  assert.equal(parity('admin_list', teacher).policy.decision, 'DENY');
  assert.equal(parity('teacher_ratings', student).policy.decision, 'ALLOW');
  assert.equal(parity('teacher_ratings', unauth).policy.decision, 'DENY');

  assert.equal(parity('create', student, { bodyStudentId: STUDENT_A }).policy.decision, 'ALLOW');
  assert.equal(parity('create', student, { bodyStudentId: STUDENT_B }).policy.decision, 'DENY');
  assert.equal(parity('create', teacher, { bodyStudentId: STUDENT_B }).policy.decision, 'ALLOW');

  assert.equal(parity('mark_read', teacher, {
    evaluation: { targetTeacherId: TEACHER_A },
  }).policy.decision, 'ALLOW');
  assert.equal(parity('mark_read', teacher, {
    evaluation: { targetTeacherId: TEACHER_B },
  }).policy.decision, 'DENY');
  assert.equal(parity('mark_read', student, {
    evaluation: { targetTeacherId: TEACHER_A },
  }).policy.decision, 'DENY');
  assert.equal(parity('mark_read', staff, { evaluation: null }).policy.decision, 'ALLOW');
});

test('Phase7.25 spoof resistance: role/teacherId/studentId cannot elevate', () => {
  const student = sub({ id: STUDENT_A, role: 'student' });
  assert.equal(parity('admin_list', student, {}, {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: ['view_evaluations'],
    bodyTeacherId: TEACHER_A,
    bodyUserId: 'admin',
  }).policy.decision, 'DENY');
  assert.equal(parity('create', student, { bodyStudentId: STUDENT_B }, {
    bodyRole: 'teacher',
    bodyStudentId: STUDENT_A,
  }).policy.decision, 'DENY');
});

test('Phase7.25 Policy ALLOW teacher_ratings → next()', async () => {
  const r = await runGate('teacher_ratings', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: shadowFrom('teacher_ratings', sub({ id: STUDENT_A, role: 'student' })),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.25 Policy DENY admin_list teacher → 403', async () => {
  const r = await runGate('admin_list', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadowFrom('admin_list', sub({ id: TEACHER_A, role: 'teacher', adminRole: null })),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Không có quyền truy cập');
});

test('Phase7.25 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('teacher_ratings', {
    user: null,
    policyShadow: shadowFrom('teacher_ratings', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.25 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('teacher_ratings', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('teacher_ratings', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.25 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('teacher_ratings', sub({ id: STUDENT_A, role: 'student' }));
  for (const env of [ALL_OFF, NO_EVALUATIONS, WILDCARD, MALFORMED]) {
    const r = await runGate('teacher_ratings', {
      user: { id: STUDENT_A, role: 'student' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.25 rollback: remove evaluations → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_EVALUATIONS, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_EVALUATIONS, () => getAuthorizationAuthority('proctor')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_EVALUATIONS, () => getAuthorizationAuthority('assignments')), AUTHORITY.POLICY);

  const rolled = await runGate('teacher_ratings', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: shadowFrom('teacher_ratings', sub({ id: STUDENT_A, role: 'student' })),
  }, NO_EVALUATIONS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('evaluations')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('evaluations')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('proctor')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('evaluations'));
});

test('Phase7.25 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees',  'analytics', 'staff', 'bi',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.25 middleware order + only evaluationRoutes uses evaluationsCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/evaluationRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/evaluationsCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/evaluations'"));
  assert.ok(server.includes("require('./routes/evaluationRoutes')"));
  assert.ok(!server.includes("require('./modules/exam/routes/evaluationRoutes"));
  assert.ok(routes.includes('evaluationsGuard'));
  assert.ok(routes.includes("evaluationsGuard('admin_list')"));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('evaluations')"));
  assert.ok(gate.includes('legacyEvaluationsGate'));
  assert.ok(!gate.includes('NotificationService'));
  assert.ok(!gate.includes('emitDataRefresh'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'evaluationRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('evaluationsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`evaluationsGuard('${a}')`), a);
  }
  assert.ok(routes.includes('NotificationService'));
  assert.ok(routes.includes('emitDataRefresh'));
});

test('Phase7.25 side-effect audit: gate/policy have no mutations', () => {
  for (const rel of [
    'middleware/evaluationsCutoverGate.js',
    'services/policyShadow/evaluationsPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of ['.save(', '.create(', 'NotificationService', 'emitDataRefresh', "io.emit(", 'queue.add']) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowEvaluation.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', 'emitDataRefresh', "io.emit("]) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.25 functional smoke: read authz; create/mark_read NOT EXECUTED', () => {
  assert.equal(parity('teacher_ratings', sub({ id: STUDENT_A, role: 'student' })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — evaluation create/mark_read production mutation',
    'NOT EXECUTED — evaluation create/mark_read production mutation',
  );
});

test('Phase7.25 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
