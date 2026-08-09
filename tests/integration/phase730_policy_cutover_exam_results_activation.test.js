/**
 * Phase 7.30 — Controlled cutover + production activation for /api/exam-results
 *
 * LIVE: auth → branchFilter → policyShadowExamResult → examResultsCutoverGate → handler.
 * Legacy list/create/update authz remains handler-owned; delete permission in gate.
 * create/update/delete mutations + notify/emit NOT EXECUTED.
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
  evaluateLegacyExam,
  evaluatePolicyExam,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/examResultPolicy');
const { examResultsCutoverGate } = require('../../middleware/examResultsCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390x1';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const PERMS = [
  PERMISSIONS.MANAGE_STUDENTS,
  PERMISSIONS.MANAGE_STUDENT_TRAINING,
  PERMISSIONS.MANAGE_TRAINING,
];
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees,exam-results',
};
const NO_EXAM = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'exam-results' };

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
    user: { id: opts.id ?? ACTOR, role },
    actorDoc: role === 'teacher' || role === 'student'
      ? { role, adminRole: null, permissions: [] }
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? PERMS,
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyExam(subject, action, ctx);
  const policy = evaluatePolicyExam(subject, action, ctx, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH', `${action}:${legacy.reason}`);
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
  const legacy = evaluateLegacyExam(subject, action, ctx);
  const policy = evaluatePolicyExam(subject, action, ctx, untrusted);
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow, userBranchId }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = examResultsCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user,
      userBranchId,
      body: {},
      query: {},
      headers: {},
      policyShadow,
      originalUrl: `/api/exam-results/${action}`,
      method: 'GET',
      requestId: 'p730',
      correlationId: 'p730',
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
    Promise.resolve(mw(req, res, () => { nextCount += 1; finish(); })).catch(() => finish());
  }));
}

test('Phase7.30 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
});

test('Phase7.30 config ON + exam-results allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('exam-results')), AUTHORITY.POLICY);
});

test('Phase7.30 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_EXAM, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
});

test('Phase7.30 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.30 activation .env includes exam-results + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(
    routes.sort(),
    [
      'ai', 'analytics', 'assignments', 'backups', 'bi', 'blog', 'branches', 'builder', 'courses', 'employees',
      'evaluations', 'exam-results', 'feed', 'files', 'messages', 'monitoring', 'notifications', 'proctor', 'quizzes',
      'schedules', 'settings', 'staff', 'system-logs', 'teachers', 'tenants', 'training', 'training-lms', 'workflows',
    ].sort(),
  );
  for (const fam of [
    'teachers', 'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments', 'quizzes',
    'schedules', 'messages', 'settings', 'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms',
    'training', 'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students', 'invoices', 'transactions', 'webhooks']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.30 parity actor matrix', () => {
  const staffOk = sub({ permissions: PERMS });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ id: TEACHER_A, role: 'teacher' });
  const student = sub({ id: STUDENT_A, role: 'student' });
  const unauth = buildSubject({ user: {}, actorDoc: null });
  const root = buildSubject({ user: { id: 'admin', role: 'admin' }, actorDoc: null, userBranchId: null });
  const superA = sub({ adminRole: 'SUPER_ADMIN', permissions: [], userBranchId: null });
  const owned = { _id: STUDENT_A, teacherId: TEACHER_A, enrollments: [] };
  const other = { _id: STUDENT_A, teacherId: 'other', enrollments: [] };
  const sDoc = { type: 'student', studentId: STUDENT_A };
  const tDoc = { type: 'teacher', teacherId: TEACHER_A };

  assert.equal(parity('list', staffOk).policy.decision, 'ALLOW');
  assert.equal(parity('list', staffNone).policy.decision, 'DENY');
  assert.equal(parity('list', teacher).policy.decision, 'ALLOW');
  assert.equal(parity('list', student).policy.decision, 'ALLOW');
  assert.equal(parity('list', unauth).policy.decision, 'DENY');
  assert.equal(parity('list', root).policy.decision, 'ALLOW');

  assert.equal(parity('create', staffOk, { doc: sDoc, student: owned, subjectBranchId: BRANCH_A }).policy.decision, 'ALLOW');
  assert.equal(parity('create', teacher, { doc: sDoc, student: owned, subjectBranchId: BRANCH_A }).policy.decision, 'ALLOW');
  assert.equal(parity('create', teacher, { doc: sDoc, student: other, subjectBranchId: BRANCH_A }).policy.decision, 'DENY');
  assert.equal(parity('create', teacher, { doc: tDoc, student: null, subjectBranchId: BRANCH_A }).policy.decision, 'ALLOW');
  assert.equal(parity('create', student, { doc: sDoc, student: owned, subjectBranchId: BRANCH_A }).policy.decision, 'DENY');
  assert.equal(parity('create', staffOk, { doc: sDoc, student: owned, subjectBranchId: BRANCH_B }).policy.decision, 'DENY');
  assert.equal(parity('create', superA, { doc: sDoc, student: owned, subjectBranchId: BRANCH_B }).policy.decision, 'ALLOW');

  assert.equal(parity('update', staffOk, { doc: null }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', staffOk, { doc: null }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', staffOk, { doc: sDoc, subjectBranchId: BRANCH_A }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', staffNone, { doc: sDoc, subjectBranchId: BRANCH_A }).policy.decision, 'DENY');
});

test('Phase7.30 spoof resistance', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher' });
  const other = { _id: STUDENT_A, teacherId: 'other', enrollments: [] };
  assert.equal(parity('create', teacher, {
    doc: { type: 'student', studentId: STUDENT_A },
    student: other,
    subjectBranchId: BRANCH_A,
  }, {
    clientRole: 'admin',
    clientPermissions: PERMS,
    spoofTeacherId: TEACHER_A,
    bodyBranchId: BRANCH_A,
  }).policy.decision, 'DENY');
});

test('Phase7.30 missing resource: Policy ALLOW → handler 404', () => {
  const staffOk = sub({ permissions: PERMS });
  assert.equal(parity('update', staffOk, { doc: null }).legacy.reason, 'missing_exam_handler_404');
  assert.equal(parity('delete', staffOk, { doc: null }).legacy.reason, 'missing_exam_handler_404');
});

test('Phase7.30 Policy ALLOW list → next()', async () => {
  const subject = sub({ id: STUDENT_A, role: 'student' });
  const r = await runGate('list', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 1);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.30 Policy DENY list staff without perm → 403', async () => {
  const subject = sub({ permissions: [] });
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Thiếu quyền xem kết quả thi');
});

test('Phase7.30 Policy DENY create student → exact message', async () => {
  const subject = sub({ id: STUDENT_A, role: 'student' });
  const ctx = {
    doc: { type: 'student', studentId: STUDENT_A },
    student: { _id: STUDENT_A, teacherId: TEACHER_A },
    subjectBranchId: BRANCH_A,
  };
  const r = await runGate('create', {
    user: { id: STUDENT_A, role: 'student' },
    policyShadow: shadowFrom('create', subject, ctx),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Học viên không được tạo/sửa kết quả thi');
});

test('Phase7.30 Policy DENY cross-branch → exact message', async () => {
  const subject = sub({ permissions: PERMS });
  const ctx = {
    doc: { type: 'student', studentId: STUDENT_A },
    student: { _id: STUDENT_A, teacherId: TEACHER_A },
    subjectBranchId: BRANCH_B,
  };
  const r = await runGate('create', {
    user: { id: ACTOR, role: 'staff' },
    userBranchId: BRANCH_A,
    policyShadow: shadowFrom('create', subject, ctx),
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Không có quyền thao tác kết quả thi chi nhánh khác');
});

test('Phase7.30 Policy DENY unauthenticated → 401', async () => {
  const subject = buildSubject({ user: {}, actorDoc: null });
  const r = await runGate('list', {
    user: null,
    policyShadow: shadowFrom('list', subject),
  }, PROD);
  assert.equal(r.statusCode, 401);
});

test('Phase7.30 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const err = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(err.nextCount, 1);
  assert.equal(err.req.authzAuthority, AUTHORITY.LEGACY);

  const unk = await runGate('list', {
    user: { id: 'admin', role: 'admin' },
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unk.nextCount, 1);
  assert.equal(unk.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.30 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const shadow = shadowFrom('list', sub({ id: STUDENT_A, role: 'student' }));
  for (const env of [ALL_OFF, NO_EXAM, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: STUDENT_A, role: 'student' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.nextCount, 1, JSON.stringify(env));
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, JSON.stringify(env));
  }
});

test('Phase7.30 rollback A/B/C', async () => {
  assert.equal(withEnv(NO_EXAM, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_EXAM, () => getAuthorizationAuthority('employees')), AUTHORITY.POLICY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('exam-results')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('employees')), AUTHORITY.POLICY);
  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('exam-results'));
});

test('Phase7.30 cross-family isolation', () => {
  for (const fam of ['auth', 'finance', 'students', 'teachers', 'invoices', 'transactions', 'webhooks']) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses',
    'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings',
    'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics',
    'staff', 'employees', 'exam-results',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.30 middleware order + only examResultRoutes uses examResultsCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/examResultRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/examResultsCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/exam-results'"));
  assert.ok(routes.includes('examResultsCutoverGate'));
  assert.ok(routes.includes('policyShadowExamResult'));
  assert.ok(routes.includes('examGuard'));
  assert.ok(!routes.includes('checkAnyPermission'));
  assert.ok(gate.includes("getAuthorizationAuthority('exam-results')"));
  assert.ok(gate.includes('legacyExamResultsGate'));
  assert.ok(gate.includes('checkAnyPermission'));
  assert.ok(!gate.includes('NotificationService'));
  assert.ok(!gate.includes('emitDataRefresh'));
  assert.ok(!gate.includes('ExamResult.create') && !gate.includes('new ExamResult'));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'examResultRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('examResultsCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`examGuard('${a}')`), a);
  }
  assert.ok(routes.includes('authorizeExamMutation'));
  assert.ok(routes.includes('NotificationService'));
});

test('Phase7.30 side-effect audit', () => {
  for (const rel of [
    'middleware/examResultsCutoverGate.js',
    'services/policyShadow/examResultPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of [
      '.save(', 'ExamResult.create', 'NotificationService', 'emitDataRefresh',
      "io.emit(", 'queue.add', 'writeAudit',
    ]) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowExamResult.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', 'emitDataRefresh', "io.emit(", 'writeAudit']) {
    assert.ok(!shadow.includes(b), b);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.30 functional smoke: list authz; mutations NOT EXECUTED', () => {
  assert.equal(parity('list', sub({ id: STUDENT_A, role: 'student' })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — exam-results create/update/delete production mutations',
    'NOT EXECUTED — exam-results create/update/delete production mutations',
  );
});

test('Phase7.30 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees,exam-results(?:,teachers)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
