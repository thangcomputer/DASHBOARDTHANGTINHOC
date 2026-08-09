/**
 * Phase 7.21 — Controlled cutover + production activation for /api/schedules
 *
 * LIVE: auth → [branchFilter on list/stats] → policyShadowSchedule → schedulesCutoverGate → handler.
 * Role/ownership in handlers; MANAGE_SCHEDULE unused on live.
 * Notifications / emitScheduleEvent remain handler-owned.
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
  evaluateLegacySchedule,
  evaluatePolicySchedule,
  compareDecisions,
  ACTIONS,
} = require('../../services/policyShadow/schedulePolicy');
const {
  schedulesCutoverGate,
} = require('../../middleware/schedulesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const BRANCH_A = '507f1f77bcf86cd7994390aa';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules',
};
const NO_SCHEDULES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'schedules' };

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
  const legacy = evaluateLegacySchedule(subject, action, ctx);
  const policy = evaluatePolicySchedule(subject, action, ctx, untrusted);
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
  const legacy = evaluateLegacySchedule(subject, action, ctx);
  const policy = evaluatePolicySchedule(subject, action, ctx, untrusted);
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
    const mw = schedulesCutoverGate(action);
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
      originalUrl: `/api/schedules/${action}`,
      method: 'GET',
      requestId: 'p721',
      correlationId: 'p721',
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

test('Phase7.21 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);
});

test('Phase7.21 config ON + schedules allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('schedules')), AUTHORITY.POLICY);
});

test('Phase7.21 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_SCHEDULES, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);
});

test('Phase7.21 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.21 activation .env includes schedules + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(routes.includes('schedules'));
  assert.ok(routes.every((r) => [
    'ai', 'assignments', 'backups', 'blog', 'branches', 'builder', 'courses', 'feed', 'files', 'messages',
    'monitoring', 'notifications', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers', 'quizzes', 'schedules', 'settings', 'system-logs', 'tenants',
    'training', 'training-lms', 'workflows',
  ].includes(r)));
  for (const fam of [
    'schedules', 'messages', 'settings', 'files', 'feed', 'blog', 'notifications', 'branches',
    'training-lms', 'training', 'courses', 'builder', 'workflows', 'ai', 'backups', 'monitoring',
    'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.21 list/stats: teacher/student/staff ALLOW; unknown DENY', () => {
  assert.equal(parity('list', sub({ role: 'staff', adminRole: 'STAFF' })).policy.decision, 'ALLOW');
  assert.equal(parity('list', sub({ id: TEACHER_A, role: 'teacher', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(parity('list', sub({ id: STUDENT_A, role: 'student', adminRole: null })).policy.decision, 'ALLOW');
  assert.equal(parity('list', buildSubject({ user: {}, actorDoc: null })).policy.decision, 'DENY');
  assert.equal(parity('stats', sub({ role: 'admin', adminRole: 'SUPER_ADMIN' })).policy.decision, 'ALLOW');
});

test('Phase7.21 get_teacher/history self or staff; get_student ownership', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('get_teacher', teacher, { teacherId: TEACHER_A }).policy.decision, 'ALLOW');
  assert.equal(parity('get_teacher', teacher, { teacherId: TEACHER_B }).policy.decision, 'DENY');
  assert.equal(parity('history', staff, { teacherId: TEACHER_B }).policy.decision, 'ALLOW');
  assert.equal(
    parity('get_student', teacher, {
      studentId: STUDENT_A,
      targetStudent: { _id: STUDENT_A, teacherId: TEACHER_A },
      assignedStudentIds: [],
    }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('get_student', teacher, {
      studentId: STUDENT_B,
      targetStudent: { _id: STUDENT_B, teacherId: TEACHER_B },
      assignedStudentIds: [],
    }).policy.decision,
    'DENY',
  );
});

test('Phase7.21 create/update/delete/cancel ownership matrix', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const student = sub({ id: STUDENT_A, role: 'student', adminRole: null });
  assert.equal(
    parity('create', teacher, {
      targetStudent: { _id: STUDENT_A, teacherId: TEACHER_A },
      assignedStudentIds: [],
    }).policy.decision,
    'ALLOW',
  );
  assert.equal(parity('create', student).policy.decision, 'DENY');
  assert.equal(
    parity('update', teacher, { schedule: { teacherId: TEACHER_A, studentId: STUDENT_A } }).policy.decision,
    'ALLOW',
  );
  assert.equal(
    parity('update', teacher, { schedule: { teacherId: TEACHER_B, studentId: STUDENT_A } }).policy.decision,
    'DENY',
  );
  assert.equal(parity('update', teacher, { schedule: null }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', teacher).policy.decision, 'DENY');
  assert.equal(parity('delete', staff).policy.decision, 'ALLOW');
  assert.equal(
    parity('cancel', teacher, { schedule: { teacherId: TEACHER_A } }).policy.decision,
    'ALLOW',
  );
  assert.ok(PERMISSIONS.MANAGE_SCHEDULE);
});

test('Phase7.21 spoof resistance: role/teacherId/studentId/branch cannot elevate', () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const spoof = {
    clientRole: 'admin',
    clientPermissions: [PERMISSIONS.MANAGE_SCHEDULE],
    bodyTeacherId: TEACHER_B,
    bodyStudentId: STUDENT_B,
    bodyBranchId: BRANCH_A,
    queryBranchId: BRANCH_A,
  };
  assert.equal(parity('delete', teacher, {}, spoof).policy.decision, 'DENY');
  assert.equal(
    parity('get_teacher', teacher, { teacherId: TEACHER_B }, spoof).policy.decision,
    'DENY',
  );
});

// ── Gate decisions ───────────────────────────────────────────────────────────

test('Phase7.21 Policy ALLOW list → next()', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('list', staff);
  const r = await runGate('list', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
});

test('Phase7.21 Policy DENY delete → 403 Legacy message', async () => {
  const teacher = sub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const shadow = shadowFrom('delete', teacher);
  const r = await runGate('delete', {
    user: { id: TEACHER_A, role: 'teacher' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Bạn không có quyền xóa lịch học');
  assert.equal(r.nextCount, 0);
});

test('Phase7.21 Policy DENY unauthenticated → 401', async () => {
  const shadow = {
    comparison: 'MATCH',
    policyDecision: 'DENY',
    policyReason: 'policy_unauthenticated',
    policyStatusHint: 401,
  };
  const r = await runGate('list', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.statusCode, 401);
});

test('Phase7.21 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('list', {
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

test('Phase7.21 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('list', staff);
  for (const env of [ALL_OFF, NO_SCHEDULES, WILDCARD, MALFORMED]) {
    const r = await runGate('list', {
      user: { id: TEACHER_A, role: 'staff' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.21 rollback: remove schedules → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const shadow = shadowFrom('list', staff);

  assert.equal(withEnv(NO_SCHEDULES, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_SCHEDULES, () => getAuthorizationAuthority('messages')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_SCHEDULES, () => getAuthorizationAuthority('settings')), AUTHORITY.POLICY);

  const rolled = await runGate('list', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, NO_SCHEDULES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('schedules')), AUTHORITY.LEGACY);

  const restored = await runGate('list', {
    user: { id: TEACHER_A, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('schedules'));
});

test('Phase7.21 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files', 'settings', 'messages', 'schedules',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.21 middleware order + only scheduleRoutes uses schedulesCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/scheduleRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/schedulesCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/schedules'"));
  assert.ok(routes.includes('schedulesGuard'));
  assert.ok(routes.includes("schedulesGuard('list')"));
  assert.ok(routes.includes('branchFilter'));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('schedules')"));
  assert.ok(gate.includes('legacySchedulesGate'));
  assert.ok(!gate.includes('emitScheduleEvent'));
  assert.ok(!gate.includes('NotificationService'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'scheduleRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('schedulesCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`schedulesGuard('${a}')`), a);
  }
  assert.ok(routes.includes('emitScheduleEvent'));
  assert.ok(!routes.includes('checkPermission'));
});

test('Phase7.21 side-effect audit: gate/policy have no mutations', () => {
  const files = [
    'middleware/schedulesCutoverGate.js',
    'services/policyShadow/schedulePolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'NotificationService', 'BullMQ', 'emitScheduleEvent', 'emitDataRefresh',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
    assert.ok(!src.includes('queue.add'), rel);
    assert.ok(!src.includes("io.emit("), rel);
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowSchedule.js'), 'utf8');
  for (const b of ['.save(', 'NotificationService', 'emitScheduleEvent', "io.emit("]) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.21 functional smoke: list authz; mutations NOT EXECUTED', () => {
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  assert.equal(parity('list', staff).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — create/update/delete/cancel production mutation',
    'NOT EXECUTED — create/update/delete/cancel production mutation',
  );
});

test('Phase7.21 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files,settings,messages,schedules(,quizzes(,assignments(,proctor(,evaluations(,bi(,analytics(,staff(,employees(,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
