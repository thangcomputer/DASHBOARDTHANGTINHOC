/**
 * Phase 7.31 — Controlled cutover + production activation for /api/teachers
 *
 * students was NOT ELIGIBLE (GET /:id + /full-detail lack Policy/Shadow).
 * LIVE: auth → [branchFilter] → policyShadowTeacher* → teachersCutoverGate → handler.
 * Mutations / finance payouts / notify / emit NOT EXECUTED.
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
const routePol = require('../../services/policyShadow/teacherRoutePolicy');
const writePol = require('../../services/policyShadow/teacherMutationPolicy');
const { teachersCutoverGate } = require('../../middleware/teachersCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd7994390x1';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const PERMS = [
  PERMISSIONS.MANAGE_TEACHERS,
  PERMISSIONS.VIEW_TEACHERS,
  PERMISSIONS.MANAGE_TRAINING,
  PERMISSIONS.MANAGE_FINANCE,
];
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees,exam-results,teachers',
};
const NO_TEACHERS = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees,exam-results',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'teachers' };

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
  return routePol.buildSubject({
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

function parityRoute(action, subject, resourceTeacher = null, ctx = {}, untrusted = {}) {
  const legacy = routePol.evaluateLegacyTeacherRoute(subject, action, resourceTeacher, ctx);
  const policy = routePol.evaluatePolicyTeacherRoute(subject, action, resourceTeacher, ctx, untrusted);
  assert.equal(routePol.compareDecisions(legacy, policy), 'MATCH', `${action}:${legacy.reason}`);
  return { legacy, policy };
}

function parityWrite(action, subject, resourceTeacher = null, untrusted = {}) {
  const legacy = writePol.evaluateLegacyTeacherWrite(subject, resourceTeacher);
  const policy = writePol.evaluatePolicyTeacherWrite(subject, resourceTeacher, action, untrusted);
  assert.equal(writePol.compareDecisions(legacy, policy), 'MATCH', `${action}:${legacy.reason}`);
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

function shadowFromRoute(action, subject, resourceTeacher = null, ctx = {}) {
  const legacy = routePol.evaluateLegacyTeacherRoute(subject, action, resourceTeacher, ctx);
  const policy = routePol.evaluatePolicyTeacherRoute(subject, action, resourceTeacher, ctx, {});
  return {
    comparison: routePol.compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow, userBranchId }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = teachersCutoverGate(action);
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
      originalUrl: `/api/teachers/${action}`,
      method: 'GET',
      requestId: 'p731',
      correlationId: 'p731',
      params: { id: TEACHER_A },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        bodyOut = body;
        if (!settled) {
          settled = true;
          resolve({ nextCount, statusCode, body: bodyOut, req });
        }
        return this;
      },
    };
    mw(req, res, () => {
      nextCount += 1;
      if (!settled) {
        settled = true;
        resolve({ nextCount, statusCode, body: bodyOut, req });
      }
    });
  }));
}

test('Phase7.31 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
});

test('Phase7.31 config ON + teachers allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('teachers')), AUTHORITY.POLICY);
});

test('Phase7.31 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_TEACHERS, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
});

test('Phase7.31 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.31 activation .env includes teachers + prior Policy families', () => {
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
    'teachers', 'exam-results', 'employees', 'staff', 'analytics', 'bi', 'evaluations', 'proctor', 'assignments',
    'quizzes', 'schedules', 'messages', 'settings', 'files', 'feed', 'blog', 'notifications', 'branches',
    'training-lms', 'training', 'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students', 'invoices', 'transactions', 'webhooks']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

test('Phase7.31 parity actor matrix', () => {
  const staffOk = sub({ permissions: PERMS });
  const staffNone = sub({ permissions: [] });
  const teacher = sub({ id: TEACHER_A, role: 'teacher' });
  const student = sub({ id: 'st1', role: 'student' });
  const unauth = routePol.buildSubject({ user: {}, actorDoc: null });
  const root = routePol.buildSubject({ user: { id: 'admin', role: 'admin' }, actorDoc: null, userBranchId: null });
  const superA = sub({ adminRole: 'SUPER_ADMIN', permissions: [], userBranchId: null });
  const resA = { branchId: BRANCH_A };
  const resB = { branchId: BRANCH_B };
  const ctxA = { resourceId: TEACHER_A };

  assert.equal(parityRoute('list', staffOk).policy.decision, 'ALLOW');
  assert.equal(parityRoute('list', teacher).policy.decision, 'DENY');
  assert.equal(parityRoute('list', student).policy.decision, 'DENY');
  assert.equal(parityRoute('list', unauth).policy.decision, 'DENY');
  assert.equal(parityRoute('list', root).policy.decision, 'ALLOW');

  assert.equal(parityRoute('get_one', teacher, resA, ctxA).policy.decision, 'ALLOW');
  assert.equal(parityRoute('get_one', teacher, resA, { resourceId: TEACHER_B }).policy.decision, 'DENY');
  assert.equal(parityRoute('get_one', student, resA, ctxA).policy.decision, 'DENY');
  assert.equal(parityRoute('get_one', staffOk, null, ctxA).policy.decision, 'ALLOW');
  assert.equal(parityRoute('get_one', staffOk, resB, ctxA).policy.decision, 'DENY');
  assert.equal(parityRoute('get_one', superA, resB, ctxA).policy.decision, 'ALLOW');

  assert.equal(parityRoute('create', superA).policy.decision, 'ALLOW');
  assert.equal(parityRoute('create', staffOk).policy.decision, 'DENY');
  assert.equal(parityRoute('stats_summary', staffOk).policy.decision, 'ALLOW');
  assert.equal(parityRoute('stats_summary', staffNone).policy.decision, 'DENY');

  assert.equal(parityWrite('score', staffOk, resA).policy.decision, 'ALLOW');
  assert.equal(parityWrite('score', staffNone, resA).policy.decision, 'DENY');
  assert.equal(parityWrite('approve', staffOk, resB).policy.decision, 'DENY');
  assert.equal(parityWrite('reject', teacher, resA).policy.decision, 'DENY');
});

test('Phase7.31 spoof resistance', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher' });
  const spoof = {
    bodyBranchId: BRANCH_A,
    clientRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: PERMS,
  };
  assert.equal(parityRoute('list', teacher, null, {}, spoof).policy.decision, 'DENY');
  assert.equal(parityWrite('score', teacher, { branchId: BRANCH_A }, spoof).policy.decision, 'DENY');
});

test('Phase7.31 missing resource: get_one Policy ALLOW → handler 404; write → 404 deny', () => {
  const staffOk = sub({ permissions: PERMS });
  assert.equal(parityRoute('get_one', staffOk, null, { resourceId: TEACHER_A }).legacy.reason, 'legacy_allow');
  assert.equal(parityWrite('score', staffOk, null).legacy.reason, 'teacher_not_found');
  assert.equal(parityWrite('score', staffOk, null).legacy.statusHint, 404);
});

test('Phase7.31 Policy ALLOW list → next()', async () => {
  const subject = sub({ permissions: PERMS });
  const out = await runGate('list', {
    user: { id: subject.id, role: subject.role },
    userBranchId: BRANCH_A,
    policyShadow: shadowFromRoute('list', subject),
  }, PROD);
  assert.equal(out.nextCount, 1);
  assert.equal(out.req.authzAuthority, AUTHORITY.POLICY);
});

test('Phase7.31 Policy DENY list teacher → 403', async () => {
  const subject = sub({ id: TEACHER_A, role: 'teacher' });
  const out = await runGate('list', {
    user: { id: subject.id, role: subject.role },
    userBranchId: BRANCH_A,
    policyShadow: shadowFromRoute('list', subject),
  }, PROD);
  assert.equal(out.nextCount, 0);
  assert.equal(out.statusCode, 403);
  assert.match(out.body.message, /danh sách giảng viên/);
});

test('Phase7.31 Policy DENY create staff → Super Admin message', async () => {
  const subject = sub({ permissions: PERMS });
  const out = await runGate('create', {
    user: { id: subject.id, role: subject.role },
    userBranchId: BRANCH_A,
    policyShadow: shadowFromRoute('create', subject),
  }, PROD);
  assert.equal(out.nextCount, 0);
  assert.equal(out.statusCode, 403);
  assert.match(out.body.message, /Super Admin/);
});

test('Phase7.31 Policy DENY unauthenticated → 401', async () => {
  const subject = routePol.buildSubject({ user: {}, actorDoc: null });
  const out = await runGate('list', {
    user: {},
    userBranchId: null,
    policyShadow: shadowFromRoute('list', subject),
  }, PROD);
  assert.equal(out.nextCount, 0);
  assert.equal(out.statusCode, 401);
});

test('Phase7.31 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  const subject = sub({ permissions: PERMS });
  const user = { id: subject.id, role: subject.role };
  const errOut = await runGate('list', {
    user,
    userBranchId: BRANCH_A,
    policyShadow: { comparison: 'ERROR', policyDecision: null },
  }, PROD);
  assert.equal(errOut.nextCount, 1);
  assert.equal(errOut.req.authzAuthority, AUTHORITY.LEGACY);

  const unkOut = await runGate('list', {
    user,
    userBranchId: BRANCH_A,
    policyShadow: { comparison: 'UNKNOWN', policyDecision: 'WEIRD' },
  }, PROD);
  assert.equal(unkOut.nextCount, 1);
  assert.equal(unkOut.req.authzAuthority, AUTHORITY.LEGACY);
});

test('Phase7.31 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const subject = sub({ permissions: PERMS });
  const user = { id: subject.id, role: subject.role };
  const shadow = shadowFromRoute('list', subject);
  for (const env of [ALL_OFF, NO_TEACHERS, WILDCARD, MALFORMED]) {
    const out = await runGate('list', { user, userBranchId: BRANCH_A, policyShadow: shadow }, env);
    assert.equal(out.nextCount, 1, JSON.stringify(env));
    assert.equal(out.req.authzAuthority, AUTHORITY.LEGACY);
  }
});

test('Phase7.31 rollback A/B/C', () => {
  assert.equal(withEnv(NO_TEACHERS, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_TEACHERS, () => getAuthorizationAuthority('exam-results')), AUTHORITY.POLICY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('teachers')), AUTHORITY.LEGACY);
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('exam-results')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('teachers')), AUTHORITY.POLICY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('exam-results')), AUTHORITY.POLICY);
});

test('Phase7.31 cross-family isolation', () => {
  for (const fam of [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes',
    'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees',
    'exam-results', 'teachers',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.31 middleware order + only teacherRoutes uses teachersCutoverGate', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/teachersCutoverGate.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/teachers'"));
  assert.ok(routes.includes('teachersCutoverGate'));
  assert.ok(routes.includes('teacherRouteGuard'));
  assert.ok(routes.includes('teacherWriteGuard'));
  assert.ok(gate.includes("getAuthorizationAuthority('teachers')"));
  assert.ok(gate.includes('legacyTeachersGate'));
  assert.ok(gate.includes('assertTeacherBranchAccess'));
  assert.ok(!gate.includes('NotificationService'));
  assert.ok(!gate.includes('emitTeacherEvent'));
  assert.ok(!gate.includes('postSalary'));
  assert.ok(!gate.includes('Teacher.create') && !gate.includes('new Teacher'));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'teacherRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('teachersCutoverGate'), name);
  }
});

test('Phase7.31 side-effect audit', () => {
  for (const rel of [
    'middleware/teachersCutoverGate.js',
    'services/policyShadow/teacherRoutePolicy.js',
    'services/policyShadow/teacherMutationPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of [
      '.save(', 'Teacher.create', 'NotificationService', 'emitTeacherEvent',
      'emitFinanceEvent', 'postSalary', "io.emit(", 'queue.add',
    ]) {
      assert.ok(!src.includes(b), `${rel} ${b}`);
    }
  }
  const shadowR = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowTeacherRoute.js'), 'utf8');
  const shadowW = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowTeacherWrite.js'), 'utf8');
  for (const shadow of [shadowR, shadowW]) {
    for (const b of ['.save(', 'NotificationService', 'emitTeacherEvent', 'postSalary', "io.emit("]) {
      assert.ok(!shadow.includes(b), b);
    }
    assert.ok(shadow.includes('policyStatusHint'));
  }
});

test('Phase7.31 functional smoke: list/get authz; mutations NOT EXECUTED', () => {
  assert.equal(parityRoute('list', sub({ permissions: PERMS })).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — teachers create/update/delete/score/approve/reject/finance-pay production mutations',
    'NOT EXECUTED — teachers create/update/delete/score/approve/reject/finance-pay production mutations',
  );
});

test('Phase7.31 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules,quizzes,assignments,proctor,evaluations,bi,analytics,staff,employees,exam-results,teachers\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
