/**
 * Wave 6.2 — Policy SHADOW for GET /api/quizzes/admin/all.
 * Legacy remains HTTP authority. Branch isolation is data-scope, not HTTP DENY.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyQuizAdminRead,
  evaluatePolicyQuizAdminRead,
  scopeIncludesTeacherBranch,
  compareDecisions,
} = require('../../services/policyShadow/quizAdminReadPolicy');
const {
  QUIZ_ADMIN_READ_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
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

function assertMatch(label, subject, untrusted = {}) {
  const legacy = evaluateLegacyQuizAdminRead(subject);
  const policy = evaluatePolicyQuizAdminRead(subject, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: expected MATCH got ${result} (L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason})`,
  );
  return { legacy, policy, result };
}

// ── Permission matrix ────────────────────────────────────────────────────────

const PERM_CASES = [
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
    name: 'HIGH_ADMIN + MANAGE_TRAINING',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TRAINING],
    }),
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN - MANAGE_TRAINING',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    }),
    expect: 'DENY',
  },
  {
    name: 'STAFF + MANAGE_TRAINING',
    subject: subjectOf({
      permissions: [PERMISSIONS.MANAGE_TRAINING],
    }),
    expect: 'ALLOW',
  },
  {
    name: 'STAFF - MANAGE_TRAINING',
    subject: subjectOf({ permissions: [] }),
    expect: 'DENY',
  },
  {
    name: 'SUPPORT + MANAGE_TRAINING',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_TRAINING],
    }),
    expect: 'ALLOW',
  },
  {
    name: 'SUPPORT - MANAGE_TRAINING',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_MESSAGES],
    }),
    expect: 'DENY',
  },
  {
    name: 'TEACHER',
    subject: subjectOf({
      role: 'teacher',
      adminRole: null,
      permissions: [],
    }),
    expect: 'DENY',
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

for (const c of PERM_CASES) {
  test(`Wave6.2 permission: ${c.name} → MATCH ${c.expect}`, () => {
    const { legacy } = assertMatch(c.name, c.subject);
    assert.equal(legacy.decision, c.expect);
  });
}

// ── Branch / data-scope matrix ───────────────────────────────────────────────

test('Wave6.2 scope: Branch A actor → Branch A teacher quiz visible; Branch B not', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  });
  const { legacy, policy } = assertMatch('scope-A', subject);
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(legacy.scope.mode, 'teacher_branch');
  assert.equal(legacy.scope.userBranchId, BRANCH_A);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_A), true);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_B), false);
  assert.equal(scopeIncludesTeacherBranch(policy.scope, BRANCH_B), false);
});

test('Wave6.2 scope: SUPER → Branch A and Branch B quizzes visible (unscoped)', () => {
  const subject = subjectOf({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const { legacy } = assertMatch('super-scope', subject);
  assert.equal(legacy.scope.mode, 'unscoped');
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_A), true);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_B), true);
});

test('Wave6.2 scope: teacher Branch A → Branch A visible; Branch B not (null teacher included)', () => {
  // "teacher Branch A" here means teacher records used for quiz scoping,
  // not the TEACHER role (which is DENY on this admin route).
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('teacher-branch-scope', subject);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_A), true);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_B), false);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, null), true);
});

test('Wave6.2 scope: userBranchId null → unscoped MATCH ALLOW (with permission)', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: null,
  });
  const { legacy } = assertMatch('null-user-branch', subject);
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(legacy.scope.mode, 'unscoped');
});

test('Wave6.2 scope: teacher.branchId null included under branch-bound actor', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('null-teacher-branch', subject);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, null), true);
  assert.equal(legacy.scope.includeNullTeacherBranch, true);
});

// ── Spoof ────────────────────────────────────────────────────────────────────

test('Wave6.2 spoof: query/body branchId + tenantId ignored — scope stays Branch A', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  });
  const { legacy, policy } = assertMatch('spoof', subject, {
    queryBranchId: BRANCH_B,
    bodyBranchId: BRANCH_B,
    queryTenantId: 'tenant-b',
    bodyTenantId: 'tenant-b',
    clientRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.MANAGE_TRAINING],
    clientTeacherId: 'spoof-teacher',
  });
  assert.equal(legacy.scope.userBranchId, BRANCH_A);
  assert.equal(policy.scope.userBranchId, BRANCH_A);
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_B), false);
});

test('Wave6.2 spoof: filters/page/limit cannot grant MANAGE_TRAINING', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.VIEW_TEACHERS],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('spoof-filter', subject, {
    queryBranchId: BRANCH_A,
    bodyBranchId: BRANCH_A,
  });
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.2 pagination: Branch A scoped actor cannot see Branch B via page/search hints', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TRAINING],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('pagination-scope', subject, {
    queryBranchId: BRANCH_B,
  });
  // Authorization ALLOW but data scope still excludes Branch B teachers
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(scopeIncludesTeacherBranch(legacy.scope, BRANCH_B), false);
});

// ── Edges ────────────────────────────────────────────────────────────────────

test('Wave6.2 edge: missing actor id → MATCH DENY', () => {
  const subject = buildSubject({
    user: { id: '', role: 'staff' },
    actorDoc: { adminRole: 'STAFF', permissions: [PERMISSIONS.MANAGE_TRAINING], role: 'staff' },
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('missing-id', subject);
  assert.equal(legacy.decision, 'DENY');
});

test('Wave6.2 edge: hardcoded admin → MATCH ALLOW unscoped', () => {
  const subject = buildSubject({
    user: { id: 'admin', role: 'admin' },
    actorDoc: null,
    userBranchId: null,
  });
  const { legacy } = assertMatch('hardcoded-admin', subject);
  assert.equal(legacy.decision, 'ALLOW');
  assert.equal(legacy.scope.mode, 'unscoped');
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.2 fail-closed: Policy throw → ERROR; next(); no res mutation', async () => {
  const policyPath = require.resolve('../../services/policyShadow/quizAdminReadPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowQuizAdminRead');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/quizAdminReadPolicy');
  policyMod.evaluatePolicyQuizAdminRead = () => {
    throw new Error('forced quiz policy failure');
  };

  const Teacher = require('../../models/Teacher');
  const origFind = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_TRAINING],
          role: 'staff',
        }),
      };
    },
  });

  try {
    const { policyShadowQuizAdminRead } = require('../../middleware/policyShadowQuizAdminRead');
    const mw = policyShadowQuizAdminRead();
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      userBranchId: BRANCH_A,
      body: {},
      query: { page: '1', limit: '50', branchId: BRANCH_B },
      method: 'GET',
      originalUrl: '/api/quizzes/admin/all',
      requestId: 'req-wave62',
      correlationId: 'corr-wave62',
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
  } finally {
    Teacher.findById = origFind;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/quizAdminReadPolicy');
    require('../../middleware/policyShadowQuizAdminRead');
  }
});

// ── Static + adapter ─────────────────────────────────────────────────────────

test('Wave6.2 static: admin/all keeps legacy authz + branchFilter + shadow', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/quizRoutes.js'), 'utf8');
  const start = src.indexOf("router.get('/admin/all'");
  assert.ok(start >= 0);
  const end = src.indexOf('], async', start);
  const block = src.slice(start, end);
  assert.ok(block.includes('authMiddleware'));
  assert.ok(block.includes('branchFilter'));
  assert.ok(
    block.includes('policyShadowQuizAdminRead()')
    || block.includes('quizzesAdminGuard()'),
  );
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/quizzesCutoverGate.js'), 'utf8');
  assert.ok(
    block.includes('checkPermission(PERMISSIONS.MANAGE_TRAINING)')
    || gate.includes('MANAGE_TRAINING')
    || gate.includes("quizzesCutoverGate('admin_read')")
    || src.includes("quizzesCutoverGate('admin_read')"),
  );
  assert.ok(src.includes('quizzesCutoverGate') || block.includes('policyShadowQuizAdminRead'));
  // Handler still scopes by teacher branch
  assert.ok(src.includes('req.userBranchId'));
  assert.ok(src.includes('branchId: null'));
});

test('Wave6.2 adapter: MANAGE_TRAINING identity map; not shared taxonomy', () => {
  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_TRAINING), 'manage_training');
  assert.equal(QUIZ_ADMIN_READ_LIVE, PERMISSIONS.MANAGE_TRAINING);
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
});

test('Wave6.2 logging: mismatch/error metadata present; no secrets', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'middleware/policyShadowQuizAdminRead.js'),
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
  assert.ok(!/password|refreshToken|JWT_SECRET|payment/i.test(src));
  assert.ok(!src.includes('JSON.stringify(req.body)'));
});

test('Wave6.2 freeze: teacher write shadow routes unchanged', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/teachersCutoverGate.js'), 'utf8');
  for (const action of ['score', 'approve', 'reject']) {
    assert.ok(src.includes(`teacherWriteGuard('${action}')`));
  }
  assert.ok(src.includes('policyShadowTeacherWrite'));
  assert.ok(src.includes('teachersCutoverGate'));
  assert.ok(gate.includes('checkPermission(PERMISSIONS.MANAGE_TEACHERS)'));
  assert.ok(gate.includes('assertTeacherBranchAccess'));
});
