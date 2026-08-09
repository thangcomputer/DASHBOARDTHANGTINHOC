/**
 * Phase 7.13 — Controlled cutover + production activation for /api/training-lms
 *
 * LIVE mount: server.js → trainingRoutes (NOT teachingGuideRoutes /api/training).
 * Actions: auth-only reads/writes; lms_lessons teacher specialty; lms_admin_progress MANAGE_TRAINING.
 * teacher/overview specialty = DATA FILTER (HTTP ALLOW).
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
  evaluateLegacyTraining,
  evaluatePolicyTraining,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/trainingLmsPolicy');
const {
  trainingLmsCutoverGate,
  ADMIN_PROGRESS_ACTION,
} = require('../../middleware/trainingLmsCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms',
};
const NO_LMS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'training-lms' };

const AUTH_ONLY = [
  'lms_courses',
  'lms_complete_lesson',
  'lms_progress_me',
  'lms_save_watch',
  'lms_teacher_overview',
];

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
          subjectIds: opts.subjectIds,
        },
    userBranchId: opts.userBranchId ?? null,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyTraining(subject, action, ctx);
  const policy = evaluatePolicyTraining(subject, action, ctx, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH', `${action}`);
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
  const legacy = evaluateLegacyTraining(subject, action, ctx);
  const policy = evaluatePolicyTraining(subject, action, ctx, untrusted);
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
    const mw = trainingLmsCutoverGate(action);
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
      originalUrl: `/api/training-lms/${action}`,
      method: 'GET',
      requestId: 'p713',
      correlationId: 'p713',
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

test('Phase7.13 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
});

test('Phase7.13 config ON + training-lms allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('training-lms')), AUTHORITY.POLICY);
});

test('Phase7.13 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_LMS, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
});

test('Phase7.13 malformed / wildcard / unknown family → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.13 activation .env includes training-lms + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'training-lms', 'training', 'courses', 'builder', 'workflows', 'ai',
    'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity matrices ──────────────────────────────────────────────────────────

test('Phase7.13 auth-only actions: all authenticated roles ALLOW; unauthenticated DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF' }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT' }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher' }), 'ALLOW'],
    [sub({ id: 's1', role: 'student' }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const action of AUTH_ONLY) {
    for (const [subject, expected] of cases) {
      assert.equal(parity(action, subject).policy.decision, expected, `${action}/${subject.role || 'anon'}`);
    }
  }
});

test('Phase7.13 lms_lessons: teacher specialty DENY; missing course ALLOW→handler 404; non-teacher ALLOW', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const student = sub({ id: 's1', role: 'student' });

  assert.equal(
    parity('lms_lessons', teacher, {
      course: { title: 'Excel', examSubjects: ['excel'] },
      allowedSubjectIds: ['excel'],
    }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('lms_lessons', teacher, {
      course: { title: 'Canva', examSubjects: ['canva'] },
      allowedSubjectIds: ['excel'],
    }).policy.decision,
    'DENY',
  );
  assert.equal(
    parity('lms_lessons', teacher, { course: null, allowedSubjectIds: [] }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('lms_lessons', staff, {
      course: { title: 'Excel', examSubjects: ['excel'] },
      allowedSubjectIds: [],
    }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('lms_lessons', student, {
      course: { title: 'Excel', examSubjects: ['excel'] },
      allowedSubjectIds: [],
    }).policy.decision,
    'ALLOW',
  );
});

test('Phase7.13 teacher overview specialty is DATA FILTER — HTTP ALLOW', () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  assert.equal(parity('lms_teacher_overview', teacher).policy.decision, 'ALLOW');
});

test('Phase7.13 admin progress: SUPER/hardcoded/MANAGE_TRAINING ALLOW; others DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_TRAINING] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.MANAGE_TRAINING] }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'DENY'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [PERMISSIONS.MANAGE_TRAINING] }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher', permissions: [PERMISSIONS.MANAGE_TRAINING] }), 'DENY'],
    [sub({ id: 's1', role: 'student' }), 'DENY'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const [subject, expected] of cases) {
    assert.equal(parity(ADMIN_PROGRESS_ACTION, subject).policy.decision, expected);
  }
});

test('Phase7.13 spoof resistance: body IDs/roles do not elevate', () => {
  const student = sub({ id: 's1', role: 'student' });
  const spoof = {
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
    bodyUserId: 'admin',
    bodyTeacherId: 'admin',
    bodyStudentId: 'admin',
    bodyBranchId: 'b1',
  };
  assert.equal(parity('lms_complete_lesson', student, {}, spoof).policy.decision, 'ALLOW');
  assert.equal(parity(ADMIN_PROGRESS_ACTION, student, {}, spoof).policy.decision, 'DENY');
  const anon = buildSubject({ user: {}, actorDoc: null });
  assert.equal(parity('lms_courses', anon, {}, spoof).policy.decision, 'DENY');
});

test('Phase7.13 branch/tenant: not HTTP authz on LMS family', () => {
  const staff = sub({
    role: 'staff',
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: 'branch-a',
  });
  assert.equal(
    parity(ADMIN_PROGRESS_ACTION, staff, {}, { bodyBranchId: 'other', bodyTenantId: 't-x' }).policy.decision,
    'ALLOW',
  );
});

// ── Gate ALLOW / DENY / fallback ─────────────────────────────────────────────

test('Phase7.13 Policy ALLOW auth-only → next()', async () => {
  const staff = sub({ role: 'staff' });
  const r = await runGate('lms_courses', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('lms_courses', staff),
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.13 Policy DENY specialty → 403 with Legacy message', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const ctx = {
    course: { title: 'Canva', examSubjects: ['canva'] },
    allowedSubjectIds: ['excel'],
  };
  const r = await runGate('lms_lessons', {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom('lms_lessons', teacher, ctx),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Khóa học này không thuộc chuyên môn của bạn');
  assert.equal(r.nextCount, 0);
});

test('Phase7.13 Policy DENY admin progress without permission → 403', async () => {
  const teacher = sub({ id: 't1', role: 'teacher' });
  const r = await runGate(ADMIN_PROGRESS_ACTION, {
    user: { id: 't1', role: 'teacher' },
    policyShadow: shadowFrom(ADMIN_PROGRESS_ACTION, teacher),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.13 Policy ALLOW admin progress with MANAGE_TRAINING → next()', async () => {
  const staff = sub({ role: 'staff', permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const r = await runGate(ADMIN_PROGRESS_ACTION, {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom(ADMIN_PROGRESS_ACTION, staff),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.13 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('lms_courses', {
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

test('Phase7.13 cutover OFF / exclusion → Legacy next()', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('lms_courses', staff);
  for (const env of [ALL_OFF, NO_LMS, WILDCARD, MALFORMED]) {
    const r = await runGate('lms_courses', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.13 rollback: remove training-lms → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff' });
  const shadow = shadowFrom('lms_courses', staff);

  assert.equal(withEnv(NO_LMS, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_LMS, () => getAuthorizationAuthority('training')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_LMS, () => getAuthorizationAuthority('courses')), AUTHORITY.POLICY);

  const rolled = await runGate('lms_courses', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, NO_LMS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('training-lms')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('training')), AUTHORITY.LEGACY);

  const restored = await runGate('lms_courses', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  const restoredRoutes = String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(restoredRoutes.includes('training-lms'));
  assert.ok(restoredRoutes.includes('training'));
  assert.ok(restoredRoutes.includes('courses'));
});

test('Phase7.13 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'quizzes', 'assignments', 'evaluations',  'proctor',
    'files', 'blog', 'feed', 'schedules', 'messages', 'notifications',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.13 middleware order + only trainingRoutes uses trainingLmsCutoverGate', () => {
  const training = fs.readFileSync(path.join(ROOT, 'routes/trainingRoutes.js'), 'utf8');
  const guides = fs.readFileSync(path.join(ROOT, 'routes/teachingGuideRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/trainingLmsCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/training-lms', trainingRoutes)"));
  assert.ok(training.includes('lmsGuard'));
  assert.ok(training.includes('policyShadowTrainingLms'));
  assert.ok(training.includes('trainingLmsCutoverGate'));
  assert.ok(gate.includes("getAuthorizationAuthority('training-lms')"));
  assert.ok(gate.includes('legacyTrainingLmsGate'));
  assert.ok(gate.includes('checkPermission'));
  assert.ok(!guides.includes('trainingLmsCutoverGate'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'trainingRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('trainingLmsCutoverGate'), name);
  }

  for (const a of ACTIONS) {
    if (a === 'guide_list') continue;
    assert.ok(training.includes(`lmsGuard('${a}')`), a);
  }
});

test('Phase7.13 side-effect audit: gate + LMS policy have no mutations', () => {
  const files = [
    'middleware/trainingLmsCutoverGate.js',
    'middleware/policyShadowTrainingLms.js',
    'services/policyShadow/trainingLmsPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    '.remove(', 'enqueue', '.emit(', 'sendNotification', 'BullMQ',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
});

test('Phase7.13 functional smoke: authz only; mutations NOT EXECUTED', () => {
  const staff = sub({ role: 'staff' });
  assert.equal(parity('lms_courses', staff).policy.decision, 'ALLOW');
  assert.equal(parity('lms_progress_me', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — complete-lesson/save-watch/admin-progress production mutation',
    'NOT EXECUTED — complete-lesson/save-watch/admin-progress production mutation',
  );
});

test('Phase7.13 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms(,branches(,notifications(,blog(,feed(,files(,settings(,messages(,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
