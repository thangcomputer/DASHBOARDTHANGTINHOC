/**
 * Wave 6.15 — Policy SHADOW for LIVE /api/evaluations + /api/proctor.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildEvalSubject,
  evaluateLegacyEvaluation,
  evaluatePolicyEvaluation,
  compareDecisions: compareEval,
} = require('../../services/policyShadow/evaluationsPolicy');
const {
  buildSubject: buildProctorSubject,
  evaluateLegacyProctor,
  evaluatePolicyProctor,
  compareDecisions: compareProctor,
} = require('../../services/policyShadow/proctorPolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STAFF_ID = '507f1f77bcf86cd799439011';
const ROOT = path.join(__dirname, '../..');

function evalSub(opts = {}) {
  return buildEvalSubject({
    user: { id: opts.id ?? STAFF_ID, role: opts.role ?? 'staff' },
    actorDoc: opts.role === 'student'
      ? null
      : {
          adminRole: opts.adminRole ?? 'STAFF',
          permissions: opts.permissions ?? [],
          role: opts.role ?? 'staff',
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function procSub(opts = {}) {
  return buildProctorSubject({
    user: { id: opts.id ?? STAFF_ID, role: opts.role ?? 'staff' },
    actorDoc: opts.role === 'student'
      ? null
      : {
          adminRole: opts.adminRole ?? 'STAFF',
          permissions: opts.permissions ?? [],
          role: opts.role ?? 'staff',
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertEval(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyEvaluation(subject, action, ctx);
  const policy = evaluatePolicyEvaluation(subject, action, ctx, untrusted);
  const result = compareEval(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertProc(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyProctor(subject, action);
  const policy = evaluatePolicyProctor(subject, action, {}, untrusted);
  const result = compareProctor(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

// ── Evaluations ──────────────────────────────────────────────────────────────

test('Wave6.15 EVAL: admin_list admin/staff ALLOW; teacher/student DENY; VIEW_EVALUATIONS unused', () => {
  const staff = evalSub({ role: 'staff', adminRole: 'STAFF', permissions: [] });
  const admin = evalSub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] });
  const teacher = evalSub({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.VIEW_EVALUATIONS],
  });
  const student = evalSub({ id: STUDENT_A, role: 'student', adminRole: null, permissions: [] });
  assert.equal(assertEval('staff', staff, 'admin_list').legacy.decision, 'ALLOW');
  assert.equal(assertEval('admin', admin, 'admin_list').legacy.decision, 'ALLOW');
  assert.equal(assertEval('teach', teacher, 'admin_list').legacy.decision, 'DENY');
  assert.equal(assertEval('stud', student, 'admin_list').legacy.decision, 'DENY');
});

test('Wave6.15 EVAL: teacher_ratings auth-only — any role ALLOW (weak Legacy)', () => {
  const student = evalSub({ id: STUDENT_A, role: 'student' });
  const teacher = evalSub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  assert.equal(assertEval('s', student, 'teacher_ratings').legacy.decision, 'ALLOW');
  assert.equal(assertEval('t', teacher, 'teacher_ratings').legacy.decision, 'ALLOW');
});

test('Wave6.15 EVAL: create student self ALLOW; other student DENY; staff unscoped ALLOW', () => {
  const student = evalSub({ id: STUDENT_A, role: 'student' });
  const staff = evalSub({ role: 'staff', permissions: [] });
  assert.equal(
    assertEval('self', student, 'create', { bodyStudentId: STUDENT_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertEval('other', student, 'create', { bodyStudentId: STUDENT_B }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEval('staff-any', staff, 'create', { bodyStudentId: STUDENT_B }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.15 EVAL: mark_read teacher ownership; admin/staff ALLOW; missing ALLOW(404); student DENY', () => {
  const teacher = evalSub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const staff = evalSub({ role: 'staff' });
  const student = evalSub({ id: STUDENT_A, role: 'student' });
  assert.equal(
    assertEval('own', teacher, 'mark_read', {
      evaluation: { targetTeacherId: TEACHER_A },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertEval('cross', teacher, 'mark_read', {
      evaluation: { targetTeacherId: TEACHER_B },
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEval('staff', staff, 'mark_read', {
      evaluation: { targetTeacherId: TEACHER_B },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertEval('miss', teacher, 'mark_read', { evaluation: null }).legacy.decision, 'ALLOW');
  assert.equal(assertEval('stud', student, 'mark_read', { evaluation: { targetTeacherId: TEACHER_A } }).legacy.decision, 'DENY');
});

test('Wave6.15 EVAL: spoof role/perm/branch cannot widen admin_list or create', () => {
  const teacher = evalSub({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const student = evalSub({ id: STUDENT_A, role: 'student' });
  assert.equal(
    assertEval('spoof-admin', teacher, 'admin_list', {}, {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.VIEW_EVALUATIONS],
      bodyBranchId: BRANCH_A,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertEval('spoof-create', student, 'create', { bodyStudentId: STUDENT_B }, {
      bodyUserId: STUDENT_B,
      bodyRole: 'staff',
    }).legacy.decision,
    'DENY',
  );
});

// ── Proctor ──────────────────────────────────────────────────────────────────

test('Wave6.15 PROCTOR: ingest/me auth-only ALLOW all roles', () => {
  const student = procSub({ id: STUDENT_A, role: 'student' });
  const teacher = procSub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const staff = procSub({ role: 'staff' });
  assert.equal(assertProc('s-in', student, 'events_ingest').legacy.decision, 'ALLOW');
  assert.equal(assertProc('t-me', teacher, 'events_me').legacy.decision, 'ALLOW');
  assert.equal(assertProc('st-in', staff, 'events_ingest').legacy.decision, 'ALLOW');
});

test('Wave6.15 PROCTOR: events_user isAdmin; teacher DENY; staff ALLOW', () => {
  const staff = procSub({ role: 'staff', adminRole: 'STAFF' });
  const high = procSub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  const teacher = procSub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  const student = procSub({ id: STUDENT_A, role: 'student' });
  assert.equal(assertProc('st', staff, 'events_user').legacy.decision, 'ALLOW');
  assert.equal(assertProc('hi', high, 'events_user').legacy.decision, 'ALLOW');
  assert.equal(assertProc('te', teacher, 'events_user').legacy.decision, 'DENY');
  assert.equal(assertProc('su', student, 'events_user').legacy.decision, 'DENY');
});

test('Wave6.15 PROCTOR: spoof cannot widen events_user', () => {
  const teacher = procSub({ id: TEACHER_A, role: 'teacher', adminRole: null });
  assert.equal(
    assertProc('spoof', teacher, 'events_user', {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      bodyUserId: STUDENT_A,
      paramsUserId: STUDENT_A,
      bodyTenantId: 't1',
    }).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.15 fail-closed: evaluation Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/evaluationsPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowEvaluation');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/evaluationsPolicy');
  policyMod.evaluatePolicyEvaluation = () => {
    throw new Error('forced evaluation policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowEvaluation } = require('../../middleware/policyShadowEvaluation');
    const mw = policyShadowEvaluation('admin_list');
    let nextCount = 0;
    const req = {
      user: { id: STAFF_ID, role: 'staff' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/evaluations/admin',
      requestId: 'req-wave615',
      correlationId: 'corr-wave615',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/evaluationsPolicy');
    require('../../middleware/policyShadowEvaluation');
  }
});

test('Wave6.15 fail-closed: proctor Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/proctorPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowProctor');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/proctorPolicy');
  policyMod.evaluatePolicyProctor = () => {
    throw new Error('forced proctor policy failure');
  };
  try {
    const { policyShadowProctor } = require('../../middleware/policyShadowProctor');
    const mw = policyShadowProctor('events_me');
    let nextCount = 0;
    const req = {
      user: { id: STUDENT_A, role: 'student' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/proctor/events/me',
      requestId: 'req-wave615-p',
      correlationId: 'corr-wave615-p',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    require('../../services/policyShadow/proctorPolicy');
    require('../../middleware/policyShadowProctor');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.15 static: Legacy handler gates remain; Policy shadow-only; CQRS OFF', () => {
  const evals = fs.readFileSync(path.join(ROOT, 'routes/evaluationRoutes.js'), 'utf8');
  const proctor = fs.readFileSync(path.join(ROOT, 'routes/proctorRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const adapter = fs.readFileSync(path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'), 'utf8');

  assert.ok(
    evals.includes("policyShadowEvaluation('admin_list')")
    || evals.includes("evaluationsGuard('admin_list')"),
  );
  assert.ok(
    evals.includes("policyShadowEvaluation('teacher_ratings')")
    || evals.includes("evaluationsGuard('teacher_ratings')"),
  );
  assert.ok(
    evals.includes("policyShadowEvaluation('create')")
    || evals.includes("evaluationsGuard('create')"),
  );
  assert.ok(
    evals.includes("policyShadowEvaluation('mark_read')")
    || evals.includes("evaluationsGuard('mark_read')"),
  );
  assert.ok(evals.includes('evaluationsCutoverGate') || evals.includes('evaluationsGuard'));
  assert.ok(evals.includes("req.user.role !== 'admin' && req.user.role !== 'staff'"));
  assert.ok(evals.includes('String(req.user.id) !== String(studentId)'));
  assert.ok(evals.includes('String(ev.targetTeacherId) !== String(req.user.id)'));
  // VIEW_EVALUATIONS not wired on live routes
  assert.ok(!evals.includes('VIEW_EVALUATIONS'));
  assert.ok(!evals.includes('checkPermission'));
  const evalGate = fs.readFileSync(path.join(ROOT, 'middleware/evaluationsCutoverGate.js'), 'utf8');
  assert.ok(evalGate.includes("getAuthorizationAuthority('evaluations')"));
  assert.ok(evalGate.includes('legacyEvaluationsGate'));

  assert.ok(
    proctor.includes("policyShadowProctor('events_ingest')")
    || proctor.includes("proctorGuard('events_ingest')"),
  );
  assert.ok(
    proctor.includes("policyShadowProctor('events_me')")
    || proctor.includes("proctorGuard('events_me')"),
  );
  assert.ok(
    proctor.includes("policyShadowProctor('events_user')")
    || proctor.includes("proctorGuard('events_user')"),
  );
  const proctorGate = fs.readFileSync(path.join(ROOT, 'middleware/proctorCutoverGate.js'), 'utf8');
  assert.ok(
    proctor.includes('isAdmin')
    || proctorGate.includes('isAdmin'),
  );
  assert.ok(proctor.includes('proctorCutoverGate') || proctor.includes('proctorGuard'));
  assert.ok(proctor.includes('proctorAudit.ingestEvents'));
  assert.ok(proctorGate.includes("getAuthorizationAuthority('proctor')"));
  assert.ok(proctorGate.includes('legacyProctorGate'));

  assert.ok(server.includes("app.use('/api/evaluations'"));
  assert.ok(server.includes("app.use('/api/proctor'"));
  assert.ok(!server.includes("require('./modules/exam"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  // Do not invent manage_evaluations / manage_proctor in adapter
  assert.ok(!/MANAGE_EVALUATION|MANAGE_PROCTOR|manage_proctor/.test(adapter));

  // Realtime preserved (not redesigned)
  assert.ok(evals.includes("io.to('admin_room').emit"));
  assert.ok(evals.includes('emitDataRefresh'));
});

test('Wave6.15 static: shadow always next(); modules unmounted', () => {
  for (const rel of [
    'middleware/policyShadowEvaluation.js',
    'middleware/policyShadowProctor.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/exam/routes/evaluationRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/exam/routes/proctorRoutes.js')));
});
