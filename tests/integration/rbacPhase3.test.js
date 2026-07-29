/**
 * Phase 3 — RBAC harden tests (không cần server HTTP).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Teacher = require('../../models/Teacher');
const {
  ACCESS_MATRIX,
  provisionPermissionForTarget,
  PERMISSIONS,
  ROLES,
} = require('../../constants/rbacMatrix');
const { evaluateBranchAccess } = require('../../middleware/targetBranchGuard');
const { assertProvisionAccess, requireStaffOrAdmin } = require('../../middleware/rbacGuards');
const { checkPermission } = require('../../middleware/auth');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('rbac matrix: student/teacher cannot cross_branch', () => {
  assert.equal(ACCESS_MATRIX.cross_branch.teacher, false);
  assert.equal(ACCESS_MATRIX.cross_branch.student, false);
  assert.equal(ACCESS_MATRIX.cross_branch.SUPER_ADMIN, true);
  assert.equal(ACCESS_MATRIX.cross_branch.STAFF, false);
});

test('provisionPermissionForTarget maps roles', () => {
  assert.equal(provisionPermissionForTarget('student'), PERMISSIONS.MANAGE_STUDENTS);
  assert.equal(provisionPermissionForTarget('teacher'), PERMISSIONS.VIEW_TEACHERS);
});

test('evaluateBranchAccess deny cross-branch staff', () => {
  assert.equal(
    evaluateBranchAccess({
      actorBranchId: 'b1',
      targetBranchId: 'b2',
      isSuperAdmin: false,
    }),
    'deny'
  );
  assert.equal(
    evaluateBranchAccess({
      actorBranchId: 'b1',
      targetBranchId: 'b1',
      isSuperAdmin: false,
    }),
    'allow'
  );
  assert.equal(
    evaluateBranchAccess({
      actorBranchId: 'b1',
      targetBranchId: 'b2',
      isSuperAdmin: true,
    }),
    'allow'
  );
});

test('requireStaffOrAdmin: teacher denied', () => {
  const req = { user: { id: 't1', role: 'teacher' } };
  const res = mockRes();
  let next = false;
  requireStaffOrAdmin(req, res, () => { next = true; });
  assert.equal(next, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'ROLE_DENIED');
});

test('requireStaffOrAdmin: student denied', () => {
  const req = { user: { id: 's1', role: 'student' } };
  const res = mockRes();
  let next = false;
  requireStaffOrAdmin(req, res, () => { next = true; });
  assert.equal(next, false);
  assert.equal(res.statusCode, 403);
});

test('assertProvisionAccess: staff without manage_students denied for student target', async () => {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_FINANCE],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      body: { userId: 'u1', userRole: 'student' },
    };
    const res = mockRes();
    let next = false;
    await assertProvisionAccess(req, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
    assert.equal(res.body.required, PERMISSIONS.MANAGE_STUDENTS);
  } finally {
    Teacher.findById = orig;
  }
});

test('assertProvisionAccess: staff with manage_students allowed for student', async () => {
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
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      body: { userId: 'u1', userRole: 'student' },
    };
    const res = mockRes();
    let next = false;
    await assertProvisionAccess(req, res, () => { next = true; });
    assert.equal(next, true);
  } finally {
    Teacher.findById = orig;
  }
});

test('assertProvisionAccess: staff needs view_teachers for teacher target', async () => {
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
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      body: { userId: 'u1', userRole: 'teacher' },
    };
    const res = mockRes();
    let next = false;
    await assertProvisionAccess(req, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(res.body.required, PERMISSIONS.VIEW_TEACHERS);
  } finally {
    Teacher.findById = orig;
  }
});

test('assertProvisionAccess: hardcoded admin passes', async () => {
  const req = { user: { id: 'admin', role: 'admin' }, body: { userRole: 'student' } };
  const res = mockRes();
  let next = false;
  await assertProvisionAccess(req, res, () => { next = true; });
  assert.equal(next, true);
});

test('checkPermission still denies staff without finance', async () => {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({ adminRole: 'STAFF', permissions: ['manage_students'], role: 'staff' }),
      };
    },
  });
  try {
    const mw = checkPermission(PERMISSIONS.MANAGE_FINANCE);
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const res = mockRes();
    let next = false;
    await mw(req, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(res.statusCode, 403);
  } finally {
    Teacher.findById = orig;
  }
});

test('assertTargetUserBranchAccess denies cross-branch student', async () => {
  const Student = require('../../models/Student');
  const { assertTargetUserBranchAccess } = require('../../middleware/targetBranchGuard');
  const orig = Student.findById;
  Student.findById = () => ({
    select() {
      return {
        lean: async () => ({ branchId: '507f1f77bcf86cd799439099' }),
      };
    },
  });
  try {
    const req = {
      userBranchId: '507f1f77bcf86cd799439011',
      body: { userId: '507f1f77bcf86cd799439022', userRole: 'student' },
    };
    const res = mockRes();
    let next = false;
    await assertTargetUserBranchAccess(req, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'BRANCH_SCOPE_DENIED');
  } finally {
    Student.findById = orig;
  }
});

test('assertTargetUserBranchAccess allows same branch', async () => {
  const Student = require('../../models/Student');
  const { assertTargetUserBranchAccess } = require('../../middleware/targetBranchGuard');
  const branchId = '507f1f77bcf86cd799439011';
  const orig = Student.findById;
  Student.findById = () => ({
    select() {
      return {
        lean: async () => ({ branchId }),
      };
    },
  });
  try {
    const req = {
      userBranchId: branchId,
      body: { userId: '507f1f77bcf86cd799439022', userRole: 'student' },
    };
    const res = mockRes();
    let next = false;
    await assertTargetUserBranchAccess(req, res, () => { next = true; });
    assert.equal(next, true);
  } finally {
    Student.findById = orig;
  }
});
