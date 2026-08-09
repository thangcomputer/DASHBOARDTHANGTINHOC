/**
 * Wave 6.7 — Policy SHADOW for LIVE exam-result + assignment authorization.
 * Authorization equivalence only; does not change HTTP authority.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildExamSubject,
  evaluateLegacyExam,
  evaluatePolicyExam,
  compareDecisions: compareExam,
} = require('../../services/policyShadow/examResultPolicy');
const {
  buildSubject: buildAssignSubject,
  evaluateLegacyAssignment,
  evaluatePolicyAssignment,
  compareDecisions: compareAssign,
} = require('../../services/policyShadow/assignmentPolicy');
const {
  CREATE_FIELDS: EXAM_CREATE,
  UPDATE_FIELDS: EXAM_UPDATE,
  pickExamResultCreate,
  pickExamResultUpdate,
} = require('../../utils/examResultDto');
const {
  CREATE_FIELDS: ASSIGN_CREATE,
  UPDATE_FIELDS: ASSIGN_UPDATE,
  pickAssignmentCreate,
  pickAssignmentUpdate,
} = require('../../utils/assignmentDto');
const {
  STUDENT_WRITE_LIVE,
  STUDENT_TRAINING_LIVE,
  QUIZ_ADMIN_READ_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const ROOT = path.join(__dirname, '../..');

function examSubject({
  id = '507f1f77bcf86cd799439011',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
} = {}) {
  return buildExamSubject({
    user: { id, role },
    actorDoc: { adminRole, permissions, role },
    userBranchId,
  });
}

function assignSubject(opts = {}) {
  return buildAssignSubject({
    user: { id: opts.id || '507f1f77bcf86cd799439011', role: opts.role || 'staff' },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions || [],
      role: opts.role || 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertExamMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyExam(subject, action, ctx);
  const policy = evaluatePolicyExam(subject, action, ctx, untrusted);
  const result = compareExam(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

function assertAssignMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyAssignment(subject, action, ctx);
  const policy = evaluatePolicyAssignment(subject, action, ctx, untrusted);
  const result = compareAssign(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

const ownedStudentA = {
  _id: STUDENT_A,
  branchId: BRANCH_A,
  teacherId: TEACHER_A,
  enrollments: [{ teacherId: TEACHER_A, status: 'active' }],
};
const ownedStudentB = {
  _id: STUDENT_B,
  branchId: BRANCH_B,
  teacherId: TEACHER_B,
  enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
};
const unrelatedStudentA = {
  _id: STUDENT_B,
  branchId: BRANCH_A,
  teacherId: TEACHER_B,
  enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
};

const spoof = {
  bodyBranchId: BRANCH_B,
  queryBranchId: BRANCH_B,
  clientRole: 'admin',
  clientPermissions: [PERMISSIONS.MANAGE_STUDENTS],
  spoofTeacherId: TEACHER_A,
  spoofStudentId: STUDENT_A,
};

// ── EXAM: permission / role ──────────────────────────────────────────────────

test('Wave6.7 EXAM: unauthorized staff (no perms) DENY create/list/delete', () => {
  const subject = examSubject({ permissions: [] });
  const ctx = {
    doc: { type: 'student', studentId: STUDENT_A },
    student: ownedStudentA,
    subjectBranchId: BRANCH_A,
  };
  assert.equal(assertExamMatch('e-staff-', subject, 'create', ctx).legacy.decision, 'DENY');
  assert.equal(assertExamMatch('e-list-', subject, 'list').legacy.decision, 'DENY');
  assert.equal(assertExamMatch('e-del-', subject, 'delete', ctx).legacy.decision, 'DENY');
});

test('Wave6.7 EXAM: VIEW-only staff DENY mutate; MANAGE_STUDENTS ALLOW', () => {
  const view = examSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  const ok = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const ctx = {
    doc: { type: 'student', studentId: STUDENT_A },
    student: ownedStudentA,
    subjectBranchId: BRANCH_A,
  };
  assert.equal(assertExamMatch('e-view', view, 'create', ctx).legacy.decision, 'DENY');
  assert.equal(assertExamMatch('e-ms', ok, 'create', ctx).legacy.decision, 'ALLOW');
});

test('Wave6.7 EXAM: missing required permission for teacher-type exam', () => {
  const onlyStudents = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const training = examSubject({ permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const ctx = {
    doc: { type: 'teacher', teacherId: TEACHER_A },
    student: null,
    subjectBranchId: BRANCH_A,
  };
  assert.equal(assertExamMatch('e-tt-', onlyStudents, 'create', ctx).legacy.decision, 'DENY');
  assert.equal(assertExamMatch('e-tt+', training, 'create', ctx).legacy.decision, 'ALLOW');
});

test('Wave6.7 EXAM: teacher related vs unrelated student', () => {
  const subject = examSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertExamMatch('e-t+', subject, 'create', {
      doc: { type: 'student', studentId: STUDENT_A },
      student: ownedStudentA,
      subjectBranchId: BRANCH_A,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertExamMatch('e-t-', subject, 'create', {
      doc: { type: 'student', studentId: STUDENT_B },
      student: unrelatedStudentA,
      subjectBranchId: BRANCH_A,
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.7 EXAM: student self list ALLOW; student mutate DENY; other N/A for list scoped', () => {
  const self = examSubject({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertExamMatch('e-s-list', self, 'list').legacy.decision, 'ALLOW');
  assert.equal(
    assertExamMatch('e-s-mut', self, 'create', {
      doc: { type: 'student', studentId: STUDENT_A },
      student: ownedStudentA,
      subjectBranchId: BRANCH_A,
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.7 EXAM: cross-branch DENY; SUPER unbound ALLOW', () => {
  const bound = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const superSub = examSubject({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const ctxB = {
    doc: { type: 'student', studentId: STUDENT_B },
    student: ownedStudentB,
    subjectBranchId: BRANCH_B,
  };
  assert.equal(assertExamMatch('e-xb', bound, 'create', ctxB).legacy.decision, 'DENY');
  assert.equal(assertExamMatch('e-super', superSub, 'create', ctxB).legacy.decision, 'ALLOW');
});

test('Wave6.7 EXAM: missing resource update/delete → ALLOW (handler 404)', () => {
  const subject = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  assert.equal(
    assertExamMatch('e-miss-u', subject, 'update', { doc: null }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertExamMatch('e-miss-d', subject, 'delete', { doc: null }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.7 EXAM: spoof branch/tenant/role/permissions/ownership ignored', () => {
  const subject = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const ctxB = {
    doc: { type: 'student', studentId: STUDENT_B },
    student: ownedStudentB,
    subjectBranchId: BRANCH_B,
  };
  const { legacy } = assertExamMatch('e-spoof', subject, 'create', ctxB, {
    ...spoof,
    queryTenantId: 'tenant-x',
  });
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.7 EXAM: client ownership spoof cannot grant teacher access', () => {
  const subject = examSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertExamMatch(
    'e-own-spoof',
    subject,
    'create',
    {
      doc: { type: 'student', studentId: STUDENT_B },
      student: unrelatedStudentA,
      subjectBranchId: BRANCH_A,
    },
    { spoofTeacherId: TEACHER_B, spoofStudentId: STUDENT_A, bodyBranchId: BRANCH_A },
  );
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.7 EXAM: resource branch null + bound actor DENY', () => {
  const subject = examSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  assert.equal(
    assertExamMatch('e-null-br', subject, 'create', {
      doc: { type: 'student', studentId: STUDENT_A },
      student: { ...ownedStudentA, branchId: null },
      subjectBranchId: null,
    }).legacy.decision,
    'DENY',
  );
});

// ── ASSIGNMENT ───────────────────────────────────────────────────────────────

test('Wave6.7 ASSIGN: staff without MANAGE_STUDENTS DENY; with ALLOW', () => {
  const no = assignSubject({ permissions: [] });
  const ok = assignSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const ctx = { targetStudent: ownedStudentA };
  assert.equal(assertAssignMatch('a-staff-', no, 'create', ctx).legacy.decision, 'DENY');
  assert.equal(assertAssignMatch('a-staff+', ok, 'create', ctx).legacy.decision, 'ALLOW');
});

test('Wave6.7 ASSIGN: teacher allowed vs unrelated relationship', () => {
  const subject = assignSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertAssignMatch('a-t+', subject, 'create', { targetStudent: ownedStudentA }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertAssignMatch('a-t-', subject, 'create', { targetStudent: unrelatedStudentA }).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.7 ASSIGN: student denied create/grade; get_student other DENY; self ALLOW', () => {
  const subject = assignSubject({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertAssignMatch('a-s-c', subject, 'create', {}).legacy.decision, 'DENY');
  assert.equal(assertAssignMatch('a-s-g', subject, 'grade').legacy.decision, 'DENY');
  assert.equal(
    assertAssignMatch('a-s-get-', subject, 'get_student', { studentId: STUDENT_B }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertAssignMatch('a-s-get+', subject, 'get_student', { studentId: STUDENT_A }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.7 ASSIGN: cross-branch DENY; SUPER unbound ALLOW', () => {
  const bound = assignSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const superSub = assignSubject({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertAssignMatch('a-xb', bound, 'create', { targetStudent: ownedStudentB }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertAssignMatch('a-super', superSub, 'create', { targetStudent: ownedStudentB }).legacy
      .decision,
    'ALLOW',
  );
});

test('Wave6.7 ASSIGN: spoof branch/tenant/teacherId/assignedById/permissions ignored', () => {
  const subject = assignSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const { legacy } = assertAssignMatch(
    'a-spoof',
    subject,
    'create',
    { targetStudent: ownedStudentB },
    {
      bodyBranchId: BRANCH_A,
      bodyTeacherId: TEACHER_A,
      bodyAssignedById: 'spoof-admin',
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_STUDENTS],
      queryTenantId: 'tenant-x',
    },
  );
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.7 ASSIGN: missing resource update → ALLOW (404); delete role-only for teacher', () => {
  const staff = assignSubject({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const teacher = assignSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertAssignMatch('a-miss', staff, 'update', { assignment: null }).legacy.decision,
    'ALLOW',
  );
  // Legacy delete is role-only — teacher ALLOW without ownership (preserved weak gate)
  assert.equal(assertAssignMatch('a-del-t', teacher, 'delete').legacy.decision, 'ALLOW');
  assert.equal(
    assertAssignMatch('a-del-s', assignSubject({
      id: STUDENT_A,
      role: 'student',
      adminRole: null,
      permissions: [],
      userBranchId: null,
    }), 'delete').legacy.decision,
    'DENY',
  );
});

test('Wave6.7 ASSIGN: update teacher ownership + submit self checks', () => {
  const teacher = assignSubject({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: BRANCH_A,
  });
  assert.equal(
    assertAssignMatch('a-up+', teacher, 'update', {
      assignment: { teacherId: TEACHER_A, studentId: STUDENT_A },
      targetStudent: ownedStudentA,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertAssignMatch('a-up-', teacher, 'update', {
      assignment: { teacherId: TEACHER_B, studentId: STUDENT_A },
      targetStudent: ownedStudentA,
    }).legacy.decision,
    'DENY',
  );
  const student = assignSubject({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertAssignMatch('a-sub+', student, 'submit', {
      assignment: { studentId: STUDENT_A },
      bodyStudentId: STUDENT_A,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertAssignMatch('a-sub-', student, 'submit', {
      assignment: { studentId: STUDENT_A },
      bodyStudentId: STUDENT_B,
    }).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.7 fail-closed: forced Policy exception → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/examResultPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowExamResult');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/examResultPolicy');
  policyMod.evaluatePolicyExam = () => {
    throw new Error('forced exam policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_STUDENTS],
          role: 'staff',
        }),
      };
    },
  });

  try {
    const { policyShadowExamResult } = require('../../middleware/policyShadowExamResult');
    const mw = policyShadowExamResult('list');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/exam-results',
      requestId: 'req-wave67',
      correlationId: 'corr-wave67',
    };
    const res = {
      statusCode: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json() {
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/examResultPolicy');
    require('../../middleware/policyShadowExamResult');
  }
});

test('Wave6.7 fail-closed: forced assignment Policy exception → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/assignmentPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowAssignment');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/assignmentPolicy');
  policyMod.evaluatePolicyAssignment = () => {
    throw new Error('forced assignment policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_STUDENTS],
          role: 'staff',
        }),
      };
    },
  });

  try {
    const { policyShadowAssignment } = require('../../middleware/policyShadowAssignment');
    const mw = policyShadowAssignment('get_course');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      params: { courseId: 'TIN' },
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/assignments/course/TIN',
      requestId: 'req-wave67-a',
      correlationId: 'corr-wave67-a',
    };
    const res = {
      statusCode: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json() {
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/assignmentPolicy');
    require('../../middleware/policyShadowAssignment');
  }
});

// ── DTO / mass-assignment / static ───────────────────────────────────────────

test('Wave6.7 DTO: exam + assignment allowlists remain active', () => {
  assert.ok(EXAM_CREATE.includes('type'));
  assert.ok(EXAM_CREATE.includes('studentId'));
  assert.ok(!EXAM_UPDATE.includes('type'));
  assert.ok(!EXAM_UPDATE.includes('studentId'));
  assert.ok(!EXAM_UPDATE.includes('teacherId'));
  assert.ok(!EXAM_UPDATE.includes('scoreHistory'));
  assert.ok(!EXAM_UPDATE.includes('_id'));
  const create = pickExamResultCreate({
    type: 'student',
    studentId: 'x',
    branchId: 'spoof',
    tenantId: 'spoof',
    scoreHistory: [{ hack: 1 }],
    permissions: ['manage_students'],
  });
  assert.equal(create.branchId, undefined);
  assert.equal(create.tenantId, undefined);
  assert.equal(create.scoreHistory, undefined);
  assert.equal(create.permissions, undefined);

  const upd = pickExamResultUpdate({
    type: 'teacher',
    studentId: 'hack',
    teacherId: 'hack',
    passed: true,
    scoreHistory: [],
    _id: 'hack',
  });
  assert.equal(upd.type, undefined);
  assert.equal(upd.studentId, undefined);
  assert.equal(upd.teacherId, undefined);
  assert.equal(upd.scoreHistory, undefined);
  assert.equal(upd._id, undefined);
  assert.equal(upd.passed, true);

  assert.ok(ASSIGN_CREATE.includes('title'));
  assert.ok(!ASSIGN_CREATE.includes('assignedById'));
  assert.ok(!ASSIGN_UPDATE.includes('assignedByRole'));
  const aCreate = pickAssignmentCreate({
    title: 't',
    assignedById: 'spoof',
    branchId: 'spoof',
    tenantId: 'spoof',
  });
  assert.equal(aCreate.assignedById, undefined);
  assert.equal(aCreate.branchId, undefined);
  const aUpd = pickAssignmentUpdate({
    title: 't2',
    assignedByName: 'spoof',
    assignedById: 'spoof',
  });
  assert.equal(aUpd.assignedByName, undefined);
  assert.equal(aUpd.assignedById, undefined);
});

test('Wave6.7 static: routes keep legacy authz + shadow; no mass-assignment regression', () => {
  const exam = fs.readFileSync(path.join(ROOT, 'routes/examResultRoutes.js'), 'utf8');
  const assign = fs.readFileSync(path.join(ROOT, 'routes/assignmentRoutes.js'), 'utf8');
  for (const a of ['list', 'create', 'update', 'delete']) {
    assert.ok(
      exam.includes(`policyShadowExamResult('${a}')`)
      || exam.includes(`examGuard('${a}')`),
      a,
    );
  }
  assert.ok(exam.includes('authorizeExamMutation'));
  assert.ok(exam.includes('examResultsCutoverGate') || exam.includes('examGuard'));
  assert.ok(exam.includes('pickExamResultCreate'));
  assert.ok(exam.includes('pickExamResultUpdate'));
  assert.ok(!exam.includes('new ExamResult(req.body)'));
  assert.ok(!/findByIdAndUpdate\([^,]+,\s*req\.body/.test(exam));
  assert.ok(!/\{[\s]*\.\.\.req\.body/.test(exam));
  const examGate = fs.readFileSync(path.join(ROOT, 'middleware/examResultsCutoverGate.js'), 'utf8');
  assert.ok(examGate.includes('checkAnyPermission'));
  assert.ok(examGate.includes("getAuthorizationAuthority('exam-results')"));
  assert.ok(exam.includes('policyShadowExamResult'));
  assert.ok(!exam.includes('checkAnyPermission'));

  for (const a of ['create', 'update', 'delete', 'get_course', 'get_student', 'submit', 'grade', 'upload']) {
    assert.ok(
      assign.includes(`policyShadowAssignment('${a}')`)
      || assign.includes(`assignmentsGuard('${a}')`),
      a,
    );
  }
  assert.ok(assign.includes('assignmentsCutoverGate') || assign.includes('assignmentsGuard'));
  assert.ok(assign.includes('pickAssignmentCreate'));
  assert.ok(assign.includes('pickAssignmentUpdate'));
  assert.ok(assign.includes('studentMatchesTeacher'));
  assert.ok(assign.includes('MANAGE_STUDENTS'));
  assert.ok(assign.includes('assignedById = userId'));
  assert.ok(!assign.includes('new Assignment(req.body)'));
  assert.ok(!/findByIdAndUpdate\([^,]+,\s*req\.body/.test(assign));
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/assignmentsCutoverGate.js'), 'utf8');
  assert.ok(gate.includes("getAuthorizationAuthority('assignments')"));
  assert.ok(gate.includes('legacyAssignmentsGate'));
});

test('Wave6.7 static: CQRS OFF; no global Policy; constants authority; sockets preserved', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.includes("app.use('/api/exam-results'"));
  assert.ok(server.includes("app.use('/api/assignments'"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_STUDENTS), STUDENT_WRITE_LIVE);
  assert.equal(STUDENT_TRAINING_LIVE, PERMISSIONS.MANAGE_STUDENT_TRAINING);
  assert.equal(QUIZ_ADMIN_READ_LIVE, PERMISSIONS.MANAGE_TRAINING);

  const exam = fs.readFileSync(path.join(ROOT, 'routes/examResultRoutes.js'), 'utf8');
  const assign = fs.readFileSync(path.join(ROOT, 'routes/assignmentRoutes.js'), 'utf8');
  assert.ok(exam.includes('emitDataRefresh'));
  assert.ok(!/\bio\.emit\(/.test(exam));
  assert.ok(assign.includes('emitDataRefresh'));
  // Assignment still uses course-room io.to(...).emit — preserved, not redesigned
  assert.ok(/io\.to\(/.test(assign));
  assert.ok(!/\bio\.emit\(/.test(assign.replace(/io\.to\([^)]+\)\.emit/g, 'ROOM_EMIT')));
});

test('Wave6.7 shadow middleware always next(); never HTTP deny', () => {
  for (const rel of [
    'middleware/policyShadowExamResult.js',
    'middleware/policyShadowAssignment.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(src.includes('POLICY_MISMATCH') || src.includes('POLICY_SHADOW_ERROR'));
    assert.ok(!/res\.status\(403\)/.test(src));
    assert.ok(!/res\.status\(401\)/.test(src));
  }
});
