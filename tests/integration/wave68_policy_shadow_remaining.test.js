/**
 * Wave 6.8 — Policy SHADOW for schedule / settings / notification / quiz write.
 * Authorization equivalence only; legacy remains HTTP authority.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildSchedSubject,
  evaluateLegacySchedule,
  evaluatePolicySchedule,
  compareDecisions: compareSched,
  teacherCanAccessStudent,
} = require('../../services/policyShadow/schedulePolicy');
const {
  buildSubject: buildSetSubject,
  evaluateLegacySettings,
  evaluatePolicySettings,
  compareDecisions: compareSet,
} = require('../../services/policyShadow/settingsPolicy');
const {
  buildSubject: buildNotifSubject,
  evaluateLegacyNotification,
  evaluatePolicyNotification,
  compareDecisions: compareNotif,
} = require('../../services/policyShadow/notificationPolicy');
const {
  buildSubject: buildQuizSubject,
  evaluateLegacyQuiz,
  evaluatePolicyQuiz,
  compareDecisions: compareQuiz,
} = require('../../services/policyShadow/quizPolicy');
const {
  SYSTEM_SETTINGS_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const ROOT = path.join(__dirname, '../..');

function subjectOf(builder, {
  id = '507f1f77bcf86cd799439011',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
} = {}) {
  return builder({
    user: { id, role },
    actorDoc: { adminRole, permissions, role },
    userBranchId,
  });
}

function assertMatch(label, compare, legacyFn, policyFn, subject, action, ctx = {}, untrusted = {}) {
  // Always pass ctx as 3rd arg; policies that ignore it are fine.
  // Policies with (subject, action, untrusted) only: pass untrusted as 3rd when no ctx keys.
  const legacy = legacyFn(subject, action, ctx);
  const policyArity = policyFn.length; // may be 2 with defaults — still pass both
  const policy = policyFn(subject, action, ctx, untrusted);
  void policyArity;
  const result = compare(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

const ownedStudent = {
  _id: STUDENT_A,
  teacherId: TEACHER_A,
  enrollments: [{ teacherId: TEACHER_A, status: 'active' }],
  branchId: BRANCH_A,
};
const otherStudent = {
  _id: STUDENT_B,
  teacherId: TEACHER_B,
  enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
  branchId: BRANCH_B,
};

// ── Schedule ─────────────────────────────────────────────────────────────────

test('Wave6.8 SCHEDULE: staff list ALLOW; unknown role DENY', () => {
  const ok = subjectOf(buildSchedSubject, { permissions: [] });
  const bad = subjectOf(buildSchedSubject, { role: 'guest', adminRole: null, permissions: [] });
  assert.equal(
    assertMatch('s-list', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, ok, 'list')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('s-bad', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, bad, 'list')
      .legacy.decision,
    'DENY',
  );
});

test('Wave6.8 SCHEDULE: teacher create own student ALLOW; unrelated DENY', () => {
  const teacher = subjectOf(buildSchedSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertMatch('sc+', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'create', {
      targetStudent: ownedStudent,
      assignedStudentIds: [],
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('sc-', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'create', {
      targetStudent: otherStudent,
      assignedStudentIds: [],
    }).legacy.decision,
    'DENY',
  );
  assert.equal(teacherCanAccessStudent(ownedStudent, TEACHER_A, []), true);
});

test('Wave6.8 SCHEDULE: staff create has no branch gate (legacy weak) — Branch B ALLOW', () => {
  const staff = subjectOf(buildSchedSubject, { permissions: [PERMISSIONS.MANAGE_SCHEDULE] });
  assert.equal(
    assertMatch('sc-xb', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, staff, 'create', {
      targetStudent: otherStudent,
    }, { bodyBranchId: BRANCH_A }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 SCHEDULE: update/cancel ownership; delete role-only; student self', () => {
  const teacher = subjectOf(buildSchedSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  const student = subjectOf(buildSchedSubject, {
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const staff = subjectOf(buildSchedSubject, { permissions: [] });
  assert.equal(
    assertMatch('su+', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'update', {
      schedule: { teacherId: TEACHER_A, studentId: STUDENT_A },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('su-', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'update', {
      schedule: { teacherId: TEACHER_B, studentId: STUDENT_A },
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('sdel-t', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'delete')
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('sdel+', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, staff, 'delete')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('snote+', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, student, 'update', {
      schedule: { teacherId: TEACHER_A, studentId: STUDENT_A },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('snote-', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, student, 'update', {
      schedule: { teacherId: TEACHER_A, studentId: STUDENT_B },
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.8 SCHEDULE: get_teacher/get_student/history spoof ignored', () => {
  const teacher = subjectOf(buildSchedSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertMatch('gt-', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'get_teacher', {
      teacherId: TEACHER_B,
    }, { bodyTeacherId: TEACHER_A, clientRole: 'admin' }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('gs-', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, teacher, 'get_student', {
      studentId: STUDENT_B,
      targetStudent: otherStudent,
      assignedStudentIds: [],
    }, { bodyStudentId: STUDENT_A }).legacy.decision,
    'DENY',
  );
});

test('Wave6.8 SCHEDULE: missing resource update ALLOW (404)', () => {
  const staff = subjectOf(buildSchedSubject);
  assert.equal(
    assertMatch('miss', compareSched, evaluateLegacySchedule, evaluatePolicySchedule, staff, 'update', {
      schedule: null,
    }).legacy.decision,
    'ALLOW',
  );
});

// ── Settings ─────────────────────────────────────────────────────────────────

test('Wave6.8 SETTINGS: SYSTEM_SETTINGS required; VIEW_TEACHERS insufficient', () => {
  const no = subjectOf(buildSetSubject, { permissions: [PERMISSIONS.VIEW_TEACHERS] });
  const ok = subjectOf(buildSetSubject, { permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  assert.equal(
    assertMatch('set-', compareSet, evaluateLegacySettings, evaluatePolicySettings, no, 'system_write')
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('set+', compareSet, evaluateLegacySettings, evaluatePolicySettings, ok, 'system_write')
      .legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 SETTINGS: training vs student_training permissions', () => {
  const train = subjectOf(buildSetSubject, { permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const stu = subjectOf(buildSetSubject, { permissions: [PERMISSIONS.MANAGE_STUDENT_TRAINING] });
  assert.equal(
    assertMatch('tr+', compareSet, evaluateLegacySettings, evaluatePolicySettings, train, 'training_write')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('tr-', compareSet, evaluateLegacySettings, evaluatePolicySettings, train, 'student_training_write')
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('stu+', compareSet, evaluateLegacySettings, evaluatePolicySettings, stu, 'student_training_write')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('upl+', compareSet, evaluateLegacySettings, evaluatePolicySettings, train, 'training_upload')
      .legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 SETTINGS: SUPER ALLOW system; teacher DENY; reset mirrors SYSTEM_SETTINGS only', () => {
  const superSub = subjectOf(buildSetSubject, {
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const teacher = subjectOf(buildSetSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
  });
  const high = subjectOf(buildSetSubject, {
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
  });
  assert.equal(
    assertMatch('sup', compareSet, evaluateLegacySettings, evaluatePolicySettings, superSub, 'reset')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('t-set', compareSet, evaluateLegacySettings, evaluatePolicySettings, teacher, 'system_write')
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('high-reset', compareSet, evaluateLegacySettings, evaluatePolicySettings, high, 'reset')
      .legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 SETTINGS: spoof role/permissions cannot widen', () => {
  const no = subjectOf(buildSetSubject, { permissions: [] });
  assert.equal(
    assertMatch('spoof', compareSet, evaluateLegacySettings, evaluatePolicySettings, no, 'system_write', {}, {
      clientRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
      bodyBranchId: BRANCH_B,
    }).legacy.decision,
    'DENY',
  );
});

// ── Notification ─────────────────────────────────────────────────────────────

test('Wave6.8 NOTIF: auth self routes ALLOW; broadcast admin/staff only', () => {
  const student = subjectOf(buildNotifSubject, {
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const staff = subjectOf(buildNotifSubject, { permissions: [] });
  assert.equal(
    assertMatch('n-list', compareNotif, evaluateLegacyNotification, evaluatePolicyNotification, student, 'list')
      .legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('n-bc-', compareNotif, evaluateLegacyNotification, evaluatePolicyNotification, student, 'broadcast')
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('n-bc+', compareNotif, evaluateLegacyNotification, evaluatePolicyNotification, staff, 'broadcast')
      .legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 NOTIF: spoof receivers/role ignored', () => {
  const teacher = subjectOf(buildNotifSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertMatch('n-spoof', compareNotif, evaluateLegacyNotification, evaluatePolicyNotification, teacher, 'broadcast', {}, {
      clientRole: 'admin',
      receivers: 'ALL_ADMIN',
    }).legacy.decision,
    'DENY',
  );
});

// ── Quiz write ───────────────────────────────────────────────────────────────

test('Wave6.8 QUIZ: auth-only create/delete/list (legacy weak gate preserved)', () => {
  const student = subjectOf(buildQuizSubject, {
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
  });
  const teacher = subjectOf(buildQuizSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertMatch('q-c', compareQuiz, evaluateLegacyQuiz, evaluatePolicyQuiz, student, 'create').legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('q-d', compareQuiz, evaluateLegacyQuiz, evaluatePolicyQuiz, teacher, 'delete').legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('q-s', compareQuiz, evaluateLegacyQuiz, evaluatePolicyQuiz, student, 'submit').legacy.decision,
    'ALLOW',
  );
});

test('Wave6.8 QUIZ: spoof teacherId ignored for authz', () => {
  const teacher = subjectOf(buildQuizSubject, {
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
  });
  assert.equal(
    assertMatch('q-spoof', compareQuiz, evaluateLegacyQuiz, evaluatePolicyQuiz, teacher, 'create', {}, {
      bodyTeacherId: TEACHER_B,
      clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
    }).legacy.decision,
    'ALLOW',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.8 fail-closed: schedule Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/schedulePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowSchedule');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/schedulePolicy');
  policyMod.evaluatePolicySchedule = () => {
    throw new Error('forced schedule policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowSchedule } = require('../../middleware/policyShadowSchedule');
    const mw = policyShadowSchedule('list');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/schedules',
      requestId: 'req-wave68',
      correlationId: 'corr-wave68',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/schedulePolicy');
    require('../../middleware/policyShadowSchedule');
  }
});

test('Wave6.8 fail-closed: settings Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/settingsPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowSettings');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/settingsPolicy');
  policyMod.evaluatePolicySettings = () => {
    throw new Error('forced settings policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.SYSTEM_SETTINGS],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const { policyShadowSettings } = require('../../middleware/policyShadowSettings');
    const mw = policyShadowSettings('system_read');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/settings',
      requestId: 'req-wave68-set',
      correlationId: 'corr-wave68-set',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/settingsPolicy');
    require('../../middleware/policyShadowSettings');
  }
});

// ── Static guards ────────────────────────────────────────────────────────────

test('Wave6.8 static: routes keep legacy + shadow; no global Policy; CQRS OFF', () => {
  const schedule = fs.readFileSync(path.join(ROOT, 'routes/scheduleRoutes.js'), 'utf8');
  const settings = fs.readFileSync(path.join(ROOT, 'routes/settingsRoutes.js'), 'utf8');
  const notif = fs.readFileSync(path.join(ROOT, 'routes/notificationRoutes.js'), 'utf8');
  const quiz = fs.readFileSync(path.join(ROOT, 'routes/quizRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');

  for (const a of ['list', 'stats', 'get_teacher', 'get_student', 'create', 'update', 'delete', 'cancel', 'history']) {
    assert.ok(
      schedule.includes(`schedulesGuard('${a}')`) || schedule.includes(`policyShadowSchedule('${a}')`),
      a,
    );
  }
  assert.ok(schedule.includes('schedulesCutoverGate') || schedule.includes('schedulesGuard'));
  assert.ok(schedule.includes('emitScheduleEvent'));
  assert.ok(schedule.includes('emitDataRefresh'));
  assert.ok(!/\bio\.emit\(/.test(schedule.replace(/io\.to\([^)]+\)\.emit/g, 'ROOM_EMIT')));
  const schedulesGate = fs.readFileSync(path.join(ROOT, 'middleware/schedulesCutoverGate.js'), 'utf8');
  assert.ok(schedulesGate.includes("getAuthorizationAuthority('schedules')"));
  assert.ok(schedulesGate.includes('legacySchedulesGate'));
  assert.ok(!schedulesGate.includes('emitScheduleEvent'));
  assert.ok(!schedulesGate.includes('NotificationService'));

  assert.ok(settings.includes("settingsGuard('system_read')") || settings.includes("policyShadowSettings('system_read')"));
  assert.ok(settings.includes("settingsGuard('reset')") || settings.includes("policyShadowSettings('reset')"));
  assert.ok(settings.includes('settingsCutoverGate') || settings.includes('settingsGuard'));
  assert.ok(
    settings.includes('checkPermission(PERMISSIONS.SYSTEM_SETTINGS)')
    || fs.readFileSync(path.join(ROOT, 'middleware/settingsCutoverGate.js'), 'utf8').includes('SYSTEM_SETTINGS'),
  );
  assert.ok(settings.includes('emitSystemWide'));
  assert.ok(settings.includes("emitSystemWide(io, 'SYSTEM_RESET'"));
  assert.ok(settings.includes("adminRole !== 'SUPER_ADMIN'"));
  const settingsGate = fs.readFileSync(path.join(ROOT, 'middleware/settingsCutoverGate.js'), 'utf8');
  assert.ok(settingsGate.includes("getAuthorizationAuthority('settings')"));
  assert.ok(settingsGate.includes('legacySettingsGate'));
  assert.ok(!settingsGate.includes('deleteMany'));
  assert.ok(!settingsGate.includes('emitSystemWide'));

  assert.ok(notif.includes("notifGuard('broadcast')") || notif.includes("policyShadowNotification('broadcast')"));
  assert.ok(notif.includes('notificationsCutoverGate'));
  const notifGate = fs.readFileSync(path.join(ROOT, 'middleware/notificationsCutoverGate.js'), 'utf8');
  assert.ok(notifGate.includes('isAdmin'));
  assert.ok(notifGate.includes("getAuthorizationAuthority('notifications')"));

  assert.ok(quiz.includes("policyShadowQuiz('create')") || quiz.includes("quizzesGuard('create')"));
  assert.ok(quiz.includes('policyShadowQuizAdminRead()') || quiz.includes('quizzesAdminGuard()'));
  assert.ok(quiz.includes('quizzesCutoverGate') || quiz.includes('quizzesGuard'));
  const quizGate = fs.readFileSync(path.join(ROOT, 'middleware/quizzesCutoverGate.js'), 'utf8');
  assert.ok(
    quiz.includes('checkPermission(PERMISSIONS.MANAGE_TRAINING)')
    || quizGate.includes('MANAGE_TRAINING'),
  );
  assert.ok(quizGate.includes("getAuthorizationAuthority('quizzes')"));
  assert.ok(quizGate.includes('legacyQuizzesGate'));

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
  assert.equal(toPolicyPermission(PERMISSIONS.SYSTEM_SETTINGS), SYSTEM_SETTINGS_LIVE);
  assert.equal(SYSTEM_SETTINGS_LIVE, 'system_settings');
});

test('Wave6.8 static: shadow middleware always next(); never HTTP deny', () => {
  for (const rel of [
    'middleware/policyShadowSchedule.js',
    'middleware/policyShadowSettings.js',
    'middleware/policyShadowNotification.js',
    'middleware/policyShadowQuiz.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
    assert.ok(!/res\.status\(401\)/.test(src));
  }
});

test('Wave6.8 inventory: modules notification/quiz not mounted from server', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.includes("require('./routes/notificationRoutes')"));
  assert.ok(server.includes("require('./routes/quizRoutes')"));
  assert.ok(!server.includes("require('./modules/notification"));
  assert.ok(!server.includes("require('./modules/exam/routes/quizRoutes"));
  assert.ok(!server.includes("require('./modules/attendance/routes/scheduleRoutes"));
});
