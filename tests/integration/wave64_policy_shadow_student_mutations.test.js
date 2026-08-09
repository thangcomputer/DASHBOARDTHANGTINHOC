/**
 * Wave 6.4 — Policy SHADOW for student mutations.
 * Reproduces live legacy authz; does not fix gaps.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyStudentMutation,
  evaluatePolicyStudentMutation,
  compareDecisions,
  lockExamTeacherOwns,
  ACTIONS,
} = require('../../services/policyShadow/studentMutationPolicy');
const {
  STUDENT_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const STUDENT_B = '507f1f77bcf86cd7994390s2';
const ROOT = path.join(__dirname, '../..');

function subjectOf({
  id = '507f1f77bcf86cd799439011',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
} = {}) {
  return buildSubject({
    user: { id, role },
    actorDoc: { adminRole, permissions, role },
    userBranchId,
  });
}

function assertMatch(label, subject, action, resource, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyStudentMutation(subject, action, resource, ctx);
  const policy = evaluatePolicyStudentMutation(subject, action, resource, ctx, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy, result };
}

const studentA = {
  branchId: BRANCH_A,
  teacherId: TEACHER_A,
  enrollments: [{ teacherId: TEACHER_A }],
};
const studentB = {
  branchId: BRANCH_B,
  teacherId: TEACHER_B,
  enrollments: [{ teacherId: TEACHER_B }],
};

// ── SUPER / HIGH / STAFF / SUPPORT permission matrix ─────────────────────────

const STAFF_ACTIONS = [
  'create',
  'create_import',
  'unlock_exam',
  'enrollment_create',
  'enrollment_settings',
  'enrollment_delete',
  'assign_teacher',
  'delete',
  'reset_today_attendance',
  'reset_history',
];

const FINANCE_ACTIONS = [
  'finance_price',
  'finance_pay',
  'finance_refund',
  'enrollment_pay',
  'finance_pay_teacher',
];

test('Wave6.4 SUPER → manage_students mutations ALLOW', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  for (const action of STAFF_ACTIONS) {
    const { legacy } = assertMatch(`super-${action}`, subject, action, studentA, {
      resourceId: STUDENT_A,
    });
    assert.equal(legacy.decision, 'ALLOW');
  }
});

test('Wave6.4 HIGH_ADMIN + MANAGE_STUDENTS same branch → ALLOW', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_STUDENTS],
  });
  const { legacy } = assertMatch('high+', subject, 'assign_teacher', studentA, {
    resourceId: STUDENT_A,
  });
  assert.equal(legacy.decision, 'ALLOW');
});

test('Wave6.4 HIGH_ADMIN without MANAGE_STUDENTS → DENY', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
  });
  const { legacy } = assertMatch('high-', subject, 'delete', studentA, {
    resourceId: STUDENT_A,
  });
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.4 STAFF ± MANAGE_STUDENTS', () => {
  const ok = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const no = subjectOf({ permissions: [] });
  assert.equal(assertMatch('staff+', ok, 'create', null).legacy.decision, 'ALLOW');
  assert.equal(assertMatch('staff-', no, 'create', null).legacy.decision, 'DENY');
});

test('Wave6.4 SUPPORT ± MANAGE_STUDENTS', () => {
  const ok = subjectOf({
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_STUDENTS],
  });
  const no = subjectOf({
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_MESSAGES],
  });
  assert.equal(
    assertMatch('sup+', ok, 'enrollment_settings', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('sup-', no, 'enrollment_settings', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.4 FINANCE permission matrix', () => {
  const ok = subjectOf({ permissions: [PERMISSIONS.MANAGE_FINANCE] });
  const no = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  for (const action of FINANCE_ACTIONS) {
    assert.equal(
      assertMatch(`fin+${action}`, ok, action, studentA, { resourceId: STUDENT_A }).legacy.decision,
      'ALLOW',
    );
    assert.equal(
      assertMatch(`fin-${action}`, no, action, studentA, { resourceId: STUDENT_A }).legacy.decision,
      'DENY',
    );
  }
});

// ── Branch ───────────────────────────────────────────────────────────────────

test('Wave6.4 Branch A → Branch A ALLOW; Branch A → Branch B DENY', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  assert.equal(
    assertMatch('ba', subject, 'delete', studentA, { resourceId: STUDENT_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('bb', subject, 'delete', studentB, { resourceId: STUDENT_B }).legacy.decision,
    'DENY',
  );
});

test('Wave6.4 SUPER unbound → Branch B student ALLOW', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertMatch('super-b', subject, 'delete', studentB, { resourceId: STUDENT_B }).legacy.decision,
    'ALLOW',
  );
});

// ── PUT update hybrid ────────────────────────────────────────────────────────

test('Wave6.4 UPDATE: STAFF + MANAGE_STUDENTS same branch ALLOW', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  assert.equal(
    assertMatch('upd-staff', subject, 'update', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
});

test('Wave6.4 UPDATE: STAFF without permission DENY', () => {
  const subject = subjectOf({ permissions: [] });
  assert.equal(
    assertMatch('upd-staff-', subject, 'update', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'DENY',
  );
});

test('Wave6.4 UPDATE: TEACHER ALLOW any student (legacy — no ownership)', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('upd-teacher-other', subject, 'update', studentB, {
    resourceId: STUDENT_B,
  });
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(legacy.reason, 'legacy_allow');
  assert.equal(legacy.permission.reason, 'teacher_put_no_ownership_check');
});

test('Wave6.4 UPDATE: STUDENT self ALLOW; other DENY', () => {
  const self = subjectOf({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertMatch('self', self, 'update', studentA, { resourceId: STUDENT_A }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('other', self, 'update', studentB, { resourceId: STUDENT_B }).legacy.decision,
    'DENY',
  );
});

// ── Teacher lock-exam ownership ──────────────────────────────────────────────

test('Wave6.4 LOCK: TEACHER owns student ALLOW; wrong student DENY', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertMatch('lock-own', subject, 'lock_exam', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('lock-other', subject, 'lock_exam', studentB, { resourceId: STUDENT_B }).legacy
      .decision,
    'DENY',
  );
  assert.equal(lockExamTeacherOwns(studentA, TEACHER_A), true);
  assert.equal(lockExamTeacherOwns(studentB, TEACHER_A), false);
});

test('Wave6.4 LOCK: TEACHER via enrollments.teacherId ALLOW', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const viaEnr = {
    branchId: BRANCH_A,
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_A }],
  };
  assert.equal(
    assertMatch('lock-enr', subject, 'lock_exam', viaEnr, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
});

// ── exam-progress ────────────────────────────────────────────────────────────

test('Wave6.4 EXAM_PROGRESS: student self ALLOW; teacher DENY; staff ALLOW without MANAGE_STUDENTS', () => {
  const student = subjectOf({
    id: STUDENT_A,
    role: 'student',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const teacher = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const staff = subjectOf({ permissions: [] }); // no manage_students
  assert.equal(
    assertMatch('ep-self', student, 'exam_progress', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
  assert.equal(
    assertMatch('ep-teacher', teacher, 'exam_progress', studentA, { resourceId: STUDENT_A })
      .legacy.decision,
    'DENY',
  );
  assert.equal(
    assertMatch('ep-staff', staff, 'exam_progress', studentA, { resourceId: STUDENT_A }).legacy
      .decision,
    'ALLOW',
  );
});

// ── Spoof / missing ──────────────────────────────────────────────────────────

test('Wave6.4 spoof: client branch/tenant/teacher/owner ignored — cross-branch still DENY', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const { legacy } = assertMatch(
    'spoof',
    subject,
    'delete',
    studentB,
    { resourceId: STUDENT_B },
    {
      bodyBranchId: BRANCH_A,
      queryTenantId: 't-b',
      spoofTeacherId: TEACHER_A,
      spoofOwnerId: TEACHER_A,
      spoofStudentId: STUDENT_A,
      clientRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
    },
  );
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.4 missing resource + userBranchId → DENY 404 semantics', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const { legacy } = assertMatch('missing', subject, 'delete', null, {
    resourceId: STUDENT_A,
  });
  assert.equal(legacy.decision, 'DENY');
  assert.equal(legacy.reason, 'student_not_found');
});

test('Wave6.4 malformed / empty actor → DENY', () => {
  const subject = buildSubject({
    user: { id: '', role: 'staff' },
    actorDoc: { adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_STUDENTS], role: 'staff' },
    userBranchId: BRANCH_A,
  });
  assert.equal(assertMatch('empty', subject, 'create', null).legacy.decision, 'DENY');
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.4 fail-closed: Policy throw → ERROR; next(); no mutation of trusted fields', async () => {
  const policyPath = require.resolve('../../services/policyShadow/studentMutationPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowStudentMutation');
  const teacherPath = require.resolve('../../models/Teacher');
  const studentPath = require.resolve('../../models/Student');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  delete require.cache[studentPath];

  const policyMod = require('../../services/policyShadow/studentMutationPolicy');
  policyMod.evaluatePolicyStudentMutation = () => {
    throw new Error('forced student mutation policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const Student = require('../../models/Student');
  const origT = Teacher.findById;
  const origS = Student.findById;
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
  Student.findById = () => ({
    select() {
      return {
        lean: async () => studentA,
      };
    },
  });

  try {
    const { policyShadowStudentMutation } = require('../../middleware/policyShadowStudentMutation');
    const mw = policyShadowStudentMutation('delete');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      branchFilter: { branchId: BRANCH_A },
      params: { id: STUDENT_A },
      body: { branchId: BRANCH_B },
      query: {},
      method: 'DELETE',
      originalUrl: `/api/students/${STUDENT_A}`,
      requestId: 'req-wave64',
      correlationId: 'corr-wave64',
    };
    const res = {
      statusCode: null,
      body: null,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(p) {
        this.body = p;
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
    assert.equal(String(req.userBranchId), BRANCH_A);
  } finally {
    Teacher.findById = origT;
    Student.findById = origS;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    delete require.cache[studentPath];
    require('../../services/policyShadow/studentMutationPolicy');
    require('../../middleware/policyShadowStudentMutation');
  }
});

// ── Static / CQRS / adapters ─────────────────────────────────────────────────

test('Wave6.4 static: all live mutation routes keep legacy + shadow', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8');
  const expected = [
    ['create_import', "router.post('/import'"],
    ['create', "router.post('/',"],
    ['update', "router.put('/:id',"],
    ['exam_progress', "router.put('/:id/exam-progress'"],
    ['finance_price', "router.patch('/:id/price'"],
    ['finance_pay', "router.put('/:id/pay',"],
    ['finance_refund', "router.put('/:id/refund'"],
    ['unlock_exam', "router.put('/:id/unlock-exam'"],
    ['lock_exam', "router.put('/:id/lock-exam'"],
    ['enrollment_create', "router.post('/:id/enrollments'"],
    ['enrollment_settings', 'enrollments/:enrollmentId/settings'],
    ['enrollment_pay', 'enrollments/:enrollmentId/pay'],
    ['enrollment_delete', "router.delete('/:id/enrollments"],
    ['assign_teacher', 'assign-teacher'],
    ['delete', "router.delete('/:id',"],
    ['reset_today_attendance', 'reset-today-attendance'],
    ['reset_history', 'reset-history'],
    ['finance_pay_teacher', 'pay-teacher'],
  ];
  for (const [action, marker] of expected) {
    assert.ok(src.includes(marker), `missing route marker ${marker}`);
    assert.ok(
      src.includes(`policyShadowStudentMutation('${action}')`),
      `missing shadow ${action}`,
    );
  }
  assert.ok(src.includes('checkPermission(PERMISSIONS.MANAGE_STUDENTS)'));
  assert.ok(src.includes('checkPermission(PERMISSIONS.MANAGE_FINANCE)'));
  assert.ok(src.includes('assertStudentBranchAccess'));
  assert.equal(Object.keys(ACTIONS).length, 18);
});

test('Wave6.4 CQRS student create remains OFF / strangler gated', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes("ENABLE_CQRS_STUDENT_CREATE === 'true'"));
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
});

test('Wave6.4 adapter: MANAGE_STUDENTS / MANAGE_FINANCE identity mapping', () => {
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_STUDENTS), 'manage_students');
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_FINANCE), 'manage_finance');
  assert.equal(STUDENT_WRITE_LIVE, PERMISSIONS.MANAGE_STUDENTS);
  assert.equal(FINANCE_WRITE_LIVE, PERMISSIONS.MANAGE_FINANCE);
});

test('Wave6.4 logging contract + no trusted-field mutation', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'middleware/policyShadowStudentMutation.js'),
    'utf8',
  );
  for (const f of [
    'route',
    'method',
    'action',
    'userRole',
    'adminRole',
    'permission',
    'userBranchId',
    'legacyDecision',
    'policyDecision',
    'requestId',
    'correlationId',
  ]) {
    assert.ok(src.includes(f), f);
  }
  assert.ok(src.includes('POLICY_MISMATCH'));
  assert.ok(src.includes('POLICY_SHADOW_ERROR'));
  assert.ok(src.includes('return next()'));
  assert.ok(!src.includes('req.userBranchId ='));
  assert.ok(!src.includes('req.branchFilter ='));
});

test('Wave6.4 freeze: prior shadows still present', () => {
  assert.ok(
    fs
      .readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8')
      .includes("teacherWriteGuard('score')"),
  );
  assert.ok(
    fs
      .readFileSync(path.join(ROOT, 'routes/quizRoutes.js'), 'utf8')
      .includes('policyShadowQuizAdminRead()'),
  );
  assert.ok(
    fs
      .readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8')
      .includes("policyShadowStudentRead('list')"),
  );
});

test('Wave6.4 mass-assignment note: create still uses new Student(req.body) (legacy preserved)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes('new Student(req.body)'));
});
