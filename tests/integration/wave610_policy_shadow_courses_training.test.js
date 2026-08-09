/**
 * Wave 6.10 — Policy SHADOW for LIVE courses + training-lms + teaching guides.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildCourseSubject,
  evaluateLegacyCourse,
  evaluatePolicyCourse,
  compareDecisions: compareCourse,
} = require('../../services/policyShadow/coursePolicy');
const {
  buildSubject: buildTrainSubject,
  evaluateLegacyTraining,
  evaluatePolicyTraining,
  compareDecisions: compareTrain,
} = require('../../services/policyShadow/trainingLmsPolicy');
const {
  SYSTEM_SETTINGS_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const ROOT = path.join(__dirname, '../..');

function courseSubject(opts = {}) {
  return buildCourseSubject({
    user: {
      id: opts.id ?? '507f1f77bcf86cd799439011',
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
    tokenAudience: opts.tokenAudience ?? 'internal',
  });
}

function trainSubject(opts = {}) {
  return buildTrainSubject({
    user: {
      id: opts.id ?? '507f1f77bcf86cd799439011',
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
      subjectIds: opts.subjectIds,
      specialty: opts.specialty,
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertCourseMatch(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyCourse(subject, action);
  const policy = evaluatePolicyCourse(subject, action, untrusted);
  const result = compareCourse(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertTrainMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyTraining(subject, action, ctx);
  const policy = evaluatePolicyTraining(subject, action, ctx, untrusted);
  const result = compareTrain(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

// ── Courses catalog ──────────────────────────────────────────────────────────

test('Wave6.10 COURSE: public list/get/stats ALLOW without auth', () => {
  const anon = buildCourseSubject({ user: {}, actorDoc: null, tokenAudience: null });
  assert.equal(assertCourseMatch('pub-list', anon, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertCourseMatch('pub-get', anon, 'get').legacy.decision, 'ALLOW');
  assert.equal(assertCourseMatch('pub-stats', anon, 'stats').legacy.decision, 'ALLOW');
});

test('Wave6.10 COURSE: write needs internal token + SYSTEM_SETTINGS', () => {
  const noTok = courseSubject({
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
    tokenAudience: 'public',
  });
  const noPerm = courseSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS], tokenAudience: 'internal' });
  const ok = courseSubject({ permissions: [PERMISSIONS.SYSTEM_SETTINGS], tokenAudience: 'internal' });
  assert.equal(assertCourseMatch('tok-', noTok, 'create').legacy.decision, 'DENY');
  assert.equal(assertCourseMatch('perm-', noPerm, 'update').legacy.decision, 'DENY');
  assert.equal(assertCourseMatch('ok+', ok, 'delete').legacy.decision, 'ALLOW');
  assert.equal(assertCourseMatch('price+', ok, 'price').legacy.decision, 'ALLOW');
});

test('Wave6.10 COURSE: SUPER/hardcoded admin ALLOW write; teacher DENY', () => {
  const superSub = courseSubject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
    tokenAudience: 'internal',
  });
  const teacher = courseSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
    tokenAudience: 'internal',
  });
  assert.equal(assertCourseMatch('super', superSub, 'create').legacy.decision, 'ALLOW');
  assert.equal(assertCourseMatch('teach', teacher, 'create').legacy.decision, 'DENY');
});

test('Wave6.10 COURSE: spoof role/permissions/branch cannot widen write', () => {
  const no = courseSubject({ permissions: [], tokenAudience: 'internal' });
  assert.equal(
    assertCourseMatch('spoof', no, 'create', {
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
      bodyBranchId: BRANCH_A,
      bodyTenantId: 't1',
    }).legacy.decision,
    'DENY',
  );
});

// ── Training LMS ─────────────────────────────────────────────────────────────

test('Wave6.10 LMS: auth-only courses/progress/complete/watch/guides', () => {
  const student = trainSubject({
    id: 's1',
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  for (const a of ['lms_courses', 'lms_progress_me', 'lms_complete_lesson', 'lms_save_watch', 'guide_list']) {
    assert.equal(assertTrainMatch(`auth-${a}`, student, a).legacy.decision, 'ALLOW');
  }
});

test('Wave6.10 LMS: teacher lessons subject match vs mismatch', () => {
  const teacher = trainSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    subjectIds: ['excel'],
  });
  const courseOk = { title: 'Excel nâng cao', examSubjects: ['excel'] };
  const courseBad = { title: 'Canva', examSubjects: ['canva'] };
  assert.equal(
    assertTrainMatch('les+', teacher, 'lms_lessons', {
      course: courseOk,
      allowedSubjectIds: ['excel'],
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertTrainMatch('les-', teacher, 'lms_lessons', {
      course: courseBad,
      allowedSubjectIds: ['excel'],
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertTrainMatch('les-miss', teacher, 'lms_lessons', { course: null }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.10 LMS: teacher overview is auth ALLOW (data filter only)', () => {
  const teacher = trainSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertTrainMatch('ov', teacher, 'lms_teacher_overview').legacy.decision,
    'ALLOW',
  );
});

test('Wave6.10 LMS: admin progress MANAGE_TRAINING; VIEW insufficient', () => {
  const view = trainSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  const ok = trainSubject({ permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const teacher = trainSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_TRAINING],
  });
  assert.equal(assertTrainMatch('ap-', view, 'lms_admin_progress').legacy.decision, 'DENY');
  assert.equal(assertTrainMatch('ap+', ok, 'lms_admin_progress').legacy.decision, 'ALLOW');
  assert.equal(assertTrainMatch('ap-t', teacher, 'lms_admin_progress').legacy.decision, 'DENY');
});

test('Wave6.10 LMS: spoof userId/role ignored on complete-lesson', () => {
  const student = trainSubject({
    id: 's1',
    role: 'student',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertTrainMatch('spoof', student, 'lms_complete_lesson', {}, {
      bodyUserId: 'admin',
      bodyStudentId: 'other',
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
    }).legacy.decision,
    'ALLOW',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.10 fail-closed: course Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/coursePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowCourse');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/coursePolicy');
  policyMod.evaluatePolicyCourse = () => {
    throw new Error('forced course policy failure');
  };
  try {
    const { policyShadowCourse } = require('../../middleware/policyShadowCourse');
    const mw = policyShadowCourse('list');
    let nextCount = 0;
    const req = {
      user: null,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/courses',
      requestId: 'req-wave610',
      correlationId: 'corr-wave610',
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
    require('../../services/policyShadow/coursePolicy');
    require('../../middleware/policyShadowCourse');
  }
});

test('Wave6.10 fail-closed: training Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/trainingLmsPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowTrainingLms');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/trainingLmsPolicy');
  policyMod.evaluatePolicyTraining = () => {
    throw new Error('forced training policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowTrainingLms } = require('../../middleware/policyShadowTrainingLms');
    const mw = policyShadowTrainingLms('lms_courses');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/training-lms/courses',
      requestId: 'req-wave610-t',
      correlationId: 'corr-wave610-t',
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
    require('../../services/policyShadow/trainingLmsPolicy');
    require('../../middleware/policyShadowTrainingLms');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.10 static: routes keep legacy + shadow; mass-assignment documented; CQRS OFF', () => {
  const courses = fs.readFileSync(path.join(ROOT, 'routes/courseRoutes.js'), 'utf8');
  const training = fs.readFileSync(path.join(ROOT, 'routes/trainingRoutes.js'), 'utf8');
  const guides = fs.readFileSync(path.join(ROOT, 'routes/teachingGuideRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');

  for (const a of ['list', 'get', 'stats']) {
    assert.ok(courses.includes(`courseReadGuard('${a}')`) || courses.includes(`policyShadowCourse('${a}')`), a);
  }
  for (const a of ['create', 'update', 'price', 'delete', 'restore', 'seed']) {
    assert.ok(courses.includes(`courseWriteGuard('${a}')`), a);
  }
  assert.ok(courses.includes('policyShadowCourse(action)'));
  assert.ok(courses.includes('coursesCutoverGate'));
  // Legacy write gates retained inside coursesCutoverGate
  const courseGate = fs.readFileSync(path.join(ROOT, 'middleware/coursesCutoverGate.js'), 'utf8');
  assert.ok(courseGate.includes('requireInternalToken'));
  assert.ok(courseGate.includes("checkPermission('system_settings')"));
  // Live mass-assignment preserved (documented finding) — do not "fix" in shadow wave
  assert.ok(courses.includes('const body = { ...req.body }'));

  for (const a of [
    'lms_courses', 'lms_lessons', 'lms_complete_lesson', 'lms_progress_me',
    'lms_teacher_overview', 'lms_save_watch', 'lms_admin_progress',
  ]) {
    assert.ok(
      training.includes(`lmsGuard('${a}')`) || training.includes(`policyShadowTrainingLms('${a}')`),
      a,
    );
  }
  assert.ok(training.includes('trainingLmsCutoverGate'));
  assert.ok(training.includes('itemMatchesSubjectIds'));
  // Legacy MANAGE_TRAINING retained inside trainingLmsCutoverGate
  const lmsGate = fs.readFileSync(path.join(ROOT, 'middleware/trainingLmsCutoverGate.js'), 'utf8');
  assert.ok(lmsGate.includes('checkPermission'));
  assert.ok(lmsGate.includes('MANAGE_TRAINING'));
  assert.ok(guides.includes("policyShadowTrainingLms('guide_list')"));

  assert.ok(server.includes("app.use('/api/courses'"));
  assert.ok(server.includes("app.use('/api/training'"));
  assert.ok(server.includes("app.use('/api/training-lms'"));
  assert.ok(!server.includes("require('./modules/course"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.equal(toPolicyPermission(PERMISSIONS.SYSTEM_SETTINGS), SYSTEM_SETTINGS_LIVE);
  assert.ok(!/\bio\.emit\(/.test(courses));
  assert.ok(!/\bio\.emit\(/.test(training));
});

test('Wave6.10 static: shadow middleware always next()', () => {
  for (const rel of [
    'middleware/policyShadowCourse.js',
    'middleware/policyShadowTrainingLms.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
  }
});
