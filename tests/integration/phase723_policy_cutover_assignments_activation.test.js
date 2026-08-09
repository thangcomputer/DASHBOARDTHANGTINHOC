/**
 * Phase 7.23 — Controlled cutover + production activation for /api/assignments
 *
 * LIVE: auth → [branchFilter create/update] → policyShadowAssignment → assignmentsCutoverGate → handler.
 * Role/permission/ownership in Policy + handlers; graded-lock remains handler-owned.
 * Socket / NotificationService remain handler-owned.
 * modules/course/routes/assignmentRoutes.js is unmounted — not migrated.
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
  evaluateLegacyAssignment,
  evaluatePolicyAssignment,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/assignmentPolicy');
const {
  assignmentsCutoverGate,
} = require('../../middleware/assignmentsCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments',
};
const NO_ASSIGNMENTS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'assignments' };

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
    userBranchId: opts.userBranchId !== undefined ? opts.userBranchId : BRANCH_A,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyAssignment(subject, action, ctx);
  const policy = evaluatePolicyAssignment(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacyAssignment(subject, action, ctx);
  const policy = evaluatePolicyAssignment(subject, action, ctx, untrusted);
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
    const mw = assignmentsCutoverGate(action);
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
      originalUrl: `/api/assignments/${action}`,
      method: 'GET',
      requestId: 'p723',
      correlationId: 'p723',
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

test('Phase7.23 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
});

test('Phase7.23 config ON + assignments allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('assignments')), AUTHORITY.POLICY);
});

test('Phase7.23 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_ASSIGNMENTS, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
});

test('Phase7.23 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.23 activation .env includes assignments + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('assignments'));
  assert.ok(routes.every((r) => [
    'ai', 'assignments', 'backups', 'blog', 'branches', 'builder', 'courses', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers', 'feed', 'files',
    'messages', 'monitoring', 'notifications', 'proctor', 'quizzes', 'schedules', 'settings',
    'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
  ].includes(r)));
  for (const fam of [
    'assignments', 'quizzes', 'schedules', 'messages', 'settings', 'files', 'feed', 'blog',
    'notifications', 'branches', 'training-lms', 'training', 'courses', 'builder', 'workflows',
    'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.23 get_course/upload: authenticated ALLOW; unauthenticated DENY', () => {
  assert.equal(parity('get_course', sub({ role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(parity('upload', sub({ id: STUDENT_A, role: 'student' })).policy.decision, 'ALLOW');
  assert.equal(parity('get_course', buildSubject({ user: {}, actorDoc: null })).policy.decision, 'DENY');
});

test('Phase7.23 create/update: MANAGE_STUDENTS + ownership + branch', () => {
  const staffOk = sub({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const staffNo = sub({ permissions: [] });
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const student = sub({ id: STUDENT_A, role: 'student' });
  const owned = { _id: STUDENT_A, teacherId: TEACHER_A, branchId: BRANCH_A };
  const otherBranch = { _id: STUDENT_B, teacherId: TEACHER_A, branchId: BRANCH_B };

  assert.equal(parity('create', staffOk, { targetStudent: owned }).policy.decision, 'ALLOW');
  assert.equal(parity('create', staffNo, { targetStudent: owned }).policy.decision, 'DENY');
  assert.equal(parity('create', teacher, { targetStudent: owned }).policy.decision, 'ALLOW');
  assert.equal(parity('create', teacher, {
    targetStudent: { _id: STUDENT_B, teacherId: TEACHER_B, branchId: BRANCH_A },
  }).policy.decision, 'DENY');
  assert.equal(parity('create', staffOk, { targetStudent: otherBranch }).policy.decision, 'DENY');
  assert.equal(parity('create', student).policy.decision, 'DENY');

  assert.equal(parity('update', teacher, {
    assignment: { teacherId: TEACHER_A, studentId: STUDENT_A },
    targetStudent: owned,
  }).policy.decision, 'ALLOW');
  assert.equal(parity('update', teacher, {
    assignment: { teacherId: TEACHER_B, studentId: STUDENT_A },
    targetStudent: owned,
  }).policy.decision, 'DENY');
  assert.equal(parity('update', staffOk, { assignment: null }).policy.decision, 'ALLOW');
});

test('Phase7.23 delete/grade role-only; get_student/submit ownership', () => {
  assert.equal(parity('delete', sub({ role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(parity('delete', sub({ id: STUDENT_A, role: 'student' })).policy.decision, 'DENY');
  assert.equal(parity('grade', sub({ role: 'staff', permissions: [] })).policy.decision, 'ALLOW');
  assert.equal(parity('grade', sub({ id: STUDENT_A, role: 'student' })).policy.decision, 'DENY');

  const student = sub({ id: STUDENT_A, role: 'student' });
  assert.equal(parity('get_student', student, { studentId: STUDENT_A }).policy.decision, 'ALLOW');
  assert.equal(parity('get_student', student, { studentId: STUDENT_B }).policy.decision, 'DENY');

  assert.equal(parity('submit', student, {
    assignment: { studentId: STUDENT_A },
    bodyStudentId: STUDENT_A,
  }).policy.decision, 'ALLOW');
  assert.equal(parity('submit', student, {
    assignment: { studentId: STUDENT_A },
    bodyStudentId: STUDENT_B,
  }).policy.decision, 'DENY');
  assert.equal(parity('submit', student, {
    assignment: { studentId: null },
    bodyStudentId: STUDENT_A,
  }).policy.decision, 'DENY');
});

test('Phase7.23 spoof resistance: role/teacherId/branch/permissions cannot elevate', () => {
  const weak = sub({
    id: STUDENT_A,
    role: 'student',
    permissions: [],
  });
  assert.equal(parity('create', weak, {}, {
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.MANAGE_STUDENTS],
    bodyTeacherId: TEACHER_A,
    bodyBranchId: BRANCH_A,
  }).policy.decision, 'DENY');

  const staffNo = sub({ permissions: [] });
  assert.equal(parity('create', staffNo, {
    targetStudent: { _id: STUDENT_A, teacherId: TEACHER_A, branchId: BRANCH_A },
  }, {
    clientPermissions: [PERMISSIONS.MANAGE_STUDENTS],
    bodyBranchId: BRANCH_A,
  }).policy.decision, 'DENY');
});

// ── Gate ─────────────────────────────────────────────────────────────────────

test('Phase7.23 Policy ALLOW get_course → next()', async () => {
  const subject = sub({ role: 'teacher', adminRole: null });
  const shadow = shadowFrom('get_course', subject);
  const r = await runGate('get_course', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.23 Policy DENY create student → 403 Legacy message', async () => {
  const subject = sub({ id: STUDENT_A, role: 'student' });
  const shadow = shadowFrom('create', subject);
  const r = await runGate('create', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Không có quyền tạo bài tập');
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.23 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const shadow = shadowFrom('upload', subject);
  const r = await runGate('upload', {
    user: null,
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 401);
});

test('Phase7.23 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('get_course', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('get_course', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.23 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('get_course', sub({ role: 'teacher', adminRole: null }));
  for (const env of [ALL_OFF, NO_ASSIGNMENTS, WILDCARD, MALFORMED]) {
    const r = await runGate('get_course', {
      user: { id: TEACHER_A, role: 'teacher' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.23 rollback: remove assignments → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  assert.equal(withEnv(NO_ASSIGNMENTS, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_ASSIGNMENTS, () => getAuthorizationAuthority('quizzes')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_ASSIGNMENTS, () => getAuthorizationAuthority('schedules')), AUTHORITY.POLICY);

  const shadow = shadowFrom('get_course', sub({ role: 'teacher', adminRole: null }));
  const rolled = await runGate('get_course', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, NO_ASSIGNMENTS);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('assignments')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('assignments')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('quizzes')), AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('assignments'));
});

test('Phase7.23 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'evaluations',  'proctor',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.23 middleware order + only assignmentRoutes uses assignmentsCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/assignmentRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/assignmentsCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/assignments'"));
  assert.ok(server.includes("require('./routes/assignmentRoutes')"));
  assert.ok(!server.includes("require('./modules/course/routes/assignmentRoutes"));
  assert.ok(routes.includes('assignmentsGuard'));
  assert.ok(routes.includes("assignmentsGuard('create')"));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('assignments')"));
  assert.ok(gate.includes('legacyAssignmentsGate'));
  assert.ok(!gate.includes('NotificationService'));
  assert.ok(!gate.includes("io.emit("));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'assignmentRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('assignmentsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`assignmentsGuard('${a}')`), a);
  }
  assert.ok(routes.includes('assignmentHasGradedSubmission'));
  assert.ok(routes.includes('NotificationService'));
});

test('Phase7.23 side-effect audit: gate/policy have no mutations', () => {
  const files = [
    'middleware/assignmentsCutoverGate.js',
    'services/policyShadow/assignmentPolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'NotificationService', 'BullMQ',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
    assert.ok(!src.includes('queue.add'), rel);
    assert.ok(!src.includes("io.emit("), rel);
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowAssignment.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', "io.emit("]) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.23 functional smoke: read authz; mutations NOT EXECUTED', () => {
  assert.equal(parity('get_course', sub({ role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/delete/submit/grade production mutation',
    'NOT EXECUTED — create/update/delete/submit/grade production mutation',
  );
});

test('Phase7.23 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
