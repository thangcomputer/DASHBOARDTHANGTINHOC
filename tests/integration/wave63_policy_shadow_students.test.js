/**
 * Wave 6.3 — Policy SHADOW for GET /api/students and GET /api/students/stats.
 * Legacy remains HTTP authority. BRANCH ≠ OWNERSHIP.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const { studentMatchesTeacher } = require('../../services/enrollmentService');
const {
  buildSubject,
  evaluateLegacyStudentRead,
  evaluatePolicyStudentRead,
  compareDecisions,
  scopeIncludesStudent,
  studentMatchesListTeacher,
} = require('../../services/policyShadow/studentReadPolicy');
const {
  STUDENT_READ_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390t1';
const TEACHER_B = '507f1f77bcf86cd7994390t2';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
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

function staffCtx(branchId = BRANCH_A) {
  return {
    trustedBranchFilter: { branchId },
    queryBranchId: undefined,
    queryTeacherId: undefined,
  };
}

function assertMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyStudentRead(subject, action, ctx);
  const policy = evaluatePolicyStudentRead(subject, action, ctx, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: expected MATCH got ${result} (L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason})`,
  );
  return { legacy, policy, result };
}

// ── Permission matrix ────────────────────────────────────────────────────────

const PERM = [
  {
    name: 'SUPER_ADMIN',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      userBranchId: null,
    }),
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN + MANAGE_STUDENTS',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
    }),
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN - MANAGE_STUDENTS',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    }),
    expect: 'DENY',
  },
  {
    name: 'STAFF + MANAGE_STUDENTS',
    subject: subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] }),
    expect: 'ALLOW',
  },
  {
    name: 'STAFF - MANAGE_STUDENTS',
    subject: subjectOf({ permissions: [] }),
    expect: 'DENY',
  },
  {
    name: 'SUPPORT + MANAGE_STUDENTS',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
    }),
    expect: 'ALLOW',
  },
  {
    name: 'SUPPORT - MANAGE_STUDENTS',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_MESSAGES],
    }),
    expect: 'DENY',
  },
  {
    name: 'VIEW-only permissions',
    subject: subjectOf({ permissions: [PERMISSIONS.VIEW_TEACHERS] }),
    expect: 'DENY',
  },
  {
    name: 'TEACHER bypass MANAGE_STUDENTS',
    subject: subjectOf({
      id: TEACHER_A,
      role: 'teacher',
      adminRole: null,
      permissions: [],
      userBranchId: null,
    }),
    expect: 'ALLOW',
  },
  {
    name: 'STUDENT',
    subject: subjectOf({
      role: 'student',
      adminRole: null,
      permissions: [],
    }),
    expect: 'DENY',
  },
];

for (const c of PERM) {
  test(`Wave6.3 permission list: ${c.name} → MATCH ${c.expect}`, () => {
    const ctx = c.subject.role === 'teacher'
      ? { trustedBranchFilter: {} }
      : staffCtx(c.subject.userBranchId || BRANCH_A);
    const { legacy } = assertMatch(c.name, c.subject, 'list', ctx);
    assert.equal(legacy.decision, c.expect);
  });
  test(`Wave6.3 permission stats: ${c.name} → MATCH ${c.expect}`, () => {
    const ctx = c.subject.role === 'teacher'
      ? { trustedBranchFilter: {} }
      : staffCtx(c.subject.userBranchId || BRANCH_A);
    const { legacy } = assertMatch(`stats-${c.name}`, c.subject, 'stats', ctx);
    assert.equal(legacy.decision, c.expect);
  });
}

// ── Branch matrix (staff) ────────────────────────────────────────────────────

test('Wave6.3 branch: SUPER unscoped → A and B students visible on list', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('super', subject, 'list', { trustedBranchFilter: {} });
  assert.equal(legacy.scope.mode, 'staff_branch');
  assert.equal(
    scopeIncludesStudent(legacy.scope, { branchId: BRANCH_A, teacherId: TEACHER_A }),
    true,
  );
  assert.equal(
    scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B, teacherId: TEACHER_B }),
    true,
  );
});

test('Wave6.3 branch: HIGH/STAFF/SUPPORT A → A include, B exclude', () => {
  for (const adminRole of ['HIGH_ADMIN', 'STAFF', 'SUPPORT']) {
    const subject = subjectOf({
      role: adminRole === 'STAFF' || adminRole === 'SUPPORT' ? 'staff' : 'admin',
      adminRole,
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
      userBranchId: BRANCH_A,
    });
    const { legacy } = assertMatch(adminRole, subject, 'list', staffCtx(BRANCH_A));
    assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_A }), true);
    assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B }), false);
  }
});

// ── Teacher ownership (list) ─────────────────────────────────────────────────

test('Wave6.3 ownership: Teacher A → assigned Student A ALLOW visibility', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('own', subject, 'list', { trustedBranchFilter: {} });
  assert.equal(legacy.scope.mode, 'teacher_ownership');
  const assigned = {
    _id: STUDENT_A,
    branchId: BRANCH_A,
    teacherId: TEACHER_A,
    enrollments: [],
  };
  assert.equal(scopeIncludesStudent(legacy.scope, assigned), true);
  assert.equal(studentMatchesListTeacher(assigned, TEACHER_A), true);
});

test('Wave6.3 ownership: Teacher A → Teacher B student DENY visibility', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('cross-teacher', subject, 'list', { trustedBranchFilter: {} });
  const other = {
    branchId: BRANCH_A,
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
  };
  assert.equal(scopeIncludesStudent(legacy.scope, other), false);
});

test('Wave6.3 ownership: same branch wrong teacher → excluded (BRANCH ≠ OWNERSHIP)', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('same-branch-wrong', subject, 'list', { trustedBranchFilter: {} });
  const sameBranchWrongTeacher = {
    branchId: BRANCH_A,
    teacherId: TEACHER_B,
    enrollments: [],
  };
  assert.equal(scopeIncludesStudent(legacy.scope, sameBranchWrongTeacher), false);
  // Staff with MANAGE_STUDENTS WOULD see same-branch student — ownership is separate
  const staff = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const staffEval = evaluateLegacyStudentRead(staff, 'list', staffCtx(BRANCH_A));
  assert.equal(scopeIncludesStudent(staffEval.scope, sameBranchWrongTeacher), true);
});

test('Wave6.3 ownership: enrollment teacherId match includes student', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('enroll', subject, 'list', { trustedBranchFilter: {} });
  const viaEnrollment = {
    branchId: BRANCH_B,
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_A, status: 'active' }],
  };
  assert.equal(scopeIncludesStudent(legacy.scope, viaEnrollment), true);
});

test('Wave6.3 ownership: no enrollment + wrong teacherId → excluded', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('none', subject, 'list', { trustedBranchFilter: {} });
  assert.equal(
    scopeIncludesStudent(legacy.scope, {
      branchId: BRANCH_A,
      teacherId: null,
      enrollments: [],
    }),
    false,
  );
});

test('Wave6.3 ownership: list query includes cancelled enrollment teacherId (legacy list ≠ studentMatchesTeacher)', () => {
  const student = {
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_A, status: 'cancelled' }],
  };
  assert.equal(studentMatchesListTeacher(student, TEACHER_A), true);
  assert.equal(studentMatchesTeacher(student, TEACHER_A), false);
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('cancelled-enroll', subject, 'list', { trustedBranchFilter: {} });
  // Policy mirrors LIST query, not studentMatchesTeacher
  assert.equal(scopeIncludesStudent(legacy.scope, student), true);
});

test('Wave6.3 ownership: multiple enrollments — match if any enrollment has teacher', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('multi', subject, 'list', { trustedBranchFilter: {} });
  const multi = {
    teacherId: TEACHER_B,
    enrollments: [
      { teacherId: TEACHER_B, status: 'active' },
      { teacherId: TEACHER_A, status: 'active' },
    ],
  };
  assert.equal(scopeIncludesStudent(legacy.scope, multi), true);
});

// ── Stats isolation ──────────────────────────────────────────────────────────

test('Wave6.3 stats: Branch A actor excludes Branch B students from aggregate scope', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const { legacy } = assertMatch('stats-scope', subject, 'stats', staffCtx(BRANCH_A));
  assert.equal(legacy.scope.mode, 'stats_branch');
  assert.equal(legacy.scope.teacherOwnershipApplied, false);
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_A }), true);
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B }), false);
});

test('Wave6.3 stats: Teacher ALLOW HTTP but unscoped stats (legacy — no ownership filter)', () => {
  const subject = subjectOf({
    id: TEACHER_A,
    role: 'teacher',
    adminRole: null,
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('stats-teacher', subject, 'stats', { trustedBranchFilter: {} });
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(legacy.scope.mode, 'stats_branch');
  assert.equal(legacy.scope.teacherOwnershipApplied, false);
  // Legacy: teacher branchFilter {} → unscoped stats (document, do not "fix")
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B, teacherId: TEACHER_B }), true);
});

test('Wave6.3 stats: SUPER → both branches visible', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('stats-super', subject, 'stats', { trustedBranchFilter: {} });
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_A }), true);
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B }), true);
});

// ── Spoofing ─────────────────────────────────────────────────────────────────

test('Wave6.3 spoof: client branch/tenant/teacher/student cannot elevate staff Branch A', () => {
  const subject = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const { legacy, policy } = assertMatch(
    'spoof',
    subject,
    'list',
    staffCtx(BRANCH_A),
    {
      bodyBranchId: BRANCH_B,
      queryTenantId: 'tenant-b',
      spoofTeacherId: TEACHER_B,
      spoofStudentId: STUDENT_A,
      clientRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
    },
  );
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B }), false);
  assert.equal(policy.scope.mode, legacy.scope.mode);
});

test('Wave6.3 spoof: ?teacherId does not grant MANAGE_STUDENTS', () => {
  const subject = subjectOf({ permissions: [] });
  const { legacy } = assertMatch(
    'spoof-teacherId',
    subject,
    'list',
    { ...staffCtx(BRANCH_A), queryTeacherId: TEACHER_A },
    { spoofTeacherId: TEACHER_A },
  );
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.3 spoof: Branch-bound staff ignores ?branch_id override (userBranchId set)', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_STUDENTS],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch(
    'branch-override',
    subject,
    'list',
    {
      trustedBranchFilter: { branchId: BRANCH_A },
      queryBranchId: BRANCH_B,
    },
  );
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_B }), false);
  assert.equal(scopeIncludesStudent(legacy.scope, { branchId: BRANCH_A }), true);
});

// ── Edges ────────────────────────────────────────────────────────────────────

test('Wave6.3 edge: missing actor → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '', role: 'staff' },
    actorDoc: { adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_STUDENTS], role: 'staff' },
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('missing', subject, 'list', staffCtx());
  assert.equal(legacy.decision, 'DENY');
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.3 fail-closed: Policy throw → ERROR; next(); no res mutation', async () => {
  const policyPath = require.resolve('../../services/policyShadow/studentReadPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowStudentRead');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/studentReadPolicy');
  policyMod.evaluatePolicyStudentRead = () => {
    throw new Error('forced student policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const origFind = Teacher.findById;
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
    const { policyShadowStudentRead } = require('../../middleware/policyShadowStudentRead');
    const mw = policyShadowStudentRead('list');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      branchFilter: { branchId: BRANCH_A },
      body: {},
      query: { branchId: BRANCH_B, tenantId: 'x' },
      method: 'GET',
      originalUrl: '/api/students',
      requestId: 'req-wave63',
      correlationId: 'corr-wave63',
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(res.body, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
    // Must not mutate trusted scope fields
    assert.equal(String(req.userBranchId), BRANCH_A);
    assert.deepEqual(req.branchFilter, { branchId: BRANCH_A });
  } finally {
    Teacher.findById = origFind;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/studentReadPolicy');
    require('../../middleware/policyShadowStudentRead');
  }
});

// ── Static / adapter ─────────────────────────────────────────────────────────

test('Wave6.3 static: GET / and /stats keep legacy + shadow', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8');
  for (const [route, action] of [
    ["router.get('/',", 'list'],
    ["router.get('/stats',", 'stats'],
  ]) {
    const start = src.indexOf(route);
    assert.ok(start >= 0, route);
    const end = src.indexOf('], async', start);
    const block = src.slice(start, end);
    assert.ok(block.includes('authMiddleware'));
    assert.ok(block.includes('branchFilter'));
    assert.ok(block.includes(`policyShadowStudentRead('${action}')`));
    assert.ok(block.includes('requireManageStudentsUnlessTeacher'));
    const shadowIdx = block.indexOf('policyShadowStudentRead');
    const legacyIdx = block.indexOf('requireManageStudentsUnlessTeacher');
    assert.ok(shadowIdx < legacyIdx, `${action}: shadow before legacy`);
  }
  assert.ok(src.includes('req.user.role === \'teacher\''));
  assert.ok(src.includes("'enrollments.teacherId': req.user.id"));
});

// ── Phase 7.35 get_one / full_detail shadow prep ─────────────────────────────

test('Phase7.35 get_one/full_detail parity actor matrix', () => {
  const owned = {
    _id: STUDENT_A,
    branchId: BRANCH_A,
    teacherId: TEACHER_A,
    enrollments: [{ teacherId: TEACHER_A, status: 'active' }],
  };
  const otherOwned = {
    _id: STUDENT_A,
    branchId: BRANCH_A,
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
  };
  const branchB = { ...owned, branchId: BRANCH_B };
  const ctx = (doc) => ({ resourceStudent: doc, resourceId: STUDENT_A });

  const staff = subjectOf({ permissions: [PERMISSIONS.MANAGE_STUDENTS] });
  const staffNoPerm = subjectOf({ permissions: [] }); // role staff still ALLOW on get_one
  const teacherOwn = subjectOf({ id: TEACHER_A, role: 'teacher', adminRole: null, permissions: [] });
  const teacherOther = subjectOf({ id: TEACHER_B, role: 'teacher', adminRole: null, permissions: [] });
  const studentSelf = subjectOf({ id: STUDENT_A, role: 'student', adminRole: null, permissions: [] });
  const studentOther = subjectOf({ id: '507f1f77bcf86cd7994390s9', role: 'student', adminRole: null, permissions: [] });
  const unauth = buildSubject({ user: {}, actorDoc: null, userBranchId: null });
  const superA = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const highNoManage = subjectOf({
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [],
    userBranchId: BRANCH_A,
  });

  for (const action of ['get_one', 'full_detail']) {
    assert.equal(assertMatch(`${action}-staff`, staff, action, ctx(owned)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-staff-noperm`, staffNoPerm, action, ctx(owned)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-teacher-own`, teacherOwn, action, ctx(owned)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-teacher-other`, teacherOther, action, ctx(owned)).legacy.decision, 'DENY');
    assert.equal(assertMatch(`${action}-self`, studentSelf, action, ctx(owned)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-student-other`, studentOther, action, ctx(owned)).legacy.decision, 'DENY');
    assert.equal(assertMatch(`${action}-unauth`, unauth, action, ctx(owned)).legacy.decision, 'DENY');
    assert.equal(assertMatch(`${action}-super-cross`, superA, action, ctx(branchB)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-high-noperm`, highNoManage, action, ctx(owned)).legacy.decision, 'ALLOW');
    assert.equal(assertMatch(`${action}-cross`, staff, action, ctx(branchB)).legacy.decision, 'DENY');
    assert.equal(assertMatch(`${action}-missing`, staff, action, { resourceStudent: null, resourceId: STUDENT_A }).legacy.reason, 'missing_student_handler_404');
  }
});

test('Phase7.35 get_one/full_detail spoof resistance', () => {
  const doc = {
    _id: STUDENT_A,
    branchId: BRANCH_B,
    teacherId: TEACHER_B,
    enrollments: [{ teacherId: TEACHER_B, status: 'active' }],
  };
  const teacher = subjectOf({ id: TEACHER_A, role: 'teacher', adminRole: null, permissions: [] });
  const spoof = {
    clientRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_STUDENTS],
    bodyBranchId: BRANCH_A,
    spoofStudentId: STUDENT_A,
    spoofTeacherId: TEACHER_A,
  };
  for (const action of ['get_one', 'full_detail']) {
    const { legacy, policy } = assertMatch(`spoof-${action}`, teacher, action, {
      resourceStudent: doc,
      resourceId: STUDENT_A,
    }, spoof);
    assert.equal(legacy.decision, 'DENY');
    assert.equal(policy.decision, 'DENY');
  }
});

test('Phase7.35 static: get_one/full_detail shadowed; no cutover; students LEGACY', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes("policyShadowStudentRead('get_one')"));
  assert.ok(src.includes("policyShadowStudentRead('full_detail')"));
  assert.ok(!src.includes('studentsCutoverGate'));
  assert.ok(!src.includes('CutoverGate'));

  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const routesLine = (env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1];
  assert.ok(!/(^|,)students(,|$)/.test(routesLine), 'students must not be allowlisted');

  const { getAuthorizationAuthority, AUTHORITY } = require('../../services/policyShadow/cutoverAuthority');
  const parsed = {};
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) parsed[m[1].trim()] = m[2].trim();
  }
  assert.equal(getAuthorizationAuthority('students', null, parsed), AUTHORITY.LEGACY);
  for (const fam of ['finance', 'webhooks', 'invoices', 'transactions']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
});

test('Phase7.35 side-effect: policy/shadow evaluation-only', () => {
  for (const rel of [
    'services/policyShadow/studentReadPolicy.js',
    'middleware/policyShadowStudentRead.js',
  ]) {
    const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const bad of ['.save(', 'Student.create', 'NotificationService', 'io.emit(', 'queue.add', 'settlePayment', 'postRefund']) {
      assert.ok(!s.includes(bad), `${rel} ${bad}`);
    }
  }
});

test('Wave6.3 adapter: MANAGE_STUDENTS identity; constants/permissions authority', () => {
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_STUDENTS), 'manage_students');
  assert.equal(STUDENT_READ_LIVE, PERMISSIONS.MANAGE_STUDENTS);
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
});

test('Wave6.3 logging: mismatch/error metadata; no secrets; always next()', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'middleware/policyShadowStudentRead.js'),
    'utf8',
  );
  for (const field of [
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
    assert.ok(src.includes(field), field);
  }
  assert.ok(src.includes('POLICY_MISMATCH'));
  assert.ok(src.includes('POLICY_SHADOW_ERROR'));
  assert.ok(src.includes('return next()'));
  assert.ok(!src.includes('req.userBranchId ='));
  assert.ok(!src.includes('req.branchFilter ='));
  assert.ok(!/password|refreshToken|JWT_SECRET|payment/i.test(src));
});

test('Wave6.3 freeze: prior teacher/quiz shadows unchanged', () => {
  const teachers = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  const quizzes = fs.readFileSync(path.join(ROOT, 'routes/quizRoutes.js'), 'utf8');
  assert.ok(teachers.includes("teacherWriteGuard('score')"));
  assert.ok(teachers.includes('policyShadowTeacherWrite'));
  assert.ok(
    quizzes.includes('policyShadowQuizAdminRead()')
    || quizzes.includes('quizzesAdminGuard()'),
  );
  const quizGate = fs.readFileSync(path.join(ROOT, 'middleware/quizzesCutoverGate.js'), 'utf8');
  assert.ok(
    quizzes.includes('checkPermission(PERMISSIONS.MANAGE_TRAINING)')
    || quizGate.includes('MANAGE_TRAINING'),
  );
});
