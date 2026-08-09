/**
 * Wave 5.1 — negative HTTP-style authorization + branch isolation.
 * Exercises authz middleware stacks (status codes match live routes: 403 deny, next = allow).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS } = require('../../constants/permissions');
const { checkPermission } = require('../../middleware/auth');
const { assertTeacherBranchAccess } = require('../../middleware/teacherBranchGuard');
const { assertStudentBranchAccess } = require('../../middleware/studentBranchGuard');
const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const TEACHER_A = '507f1f77bcf86cd7994390a1';
const TEACHER_B = '507f1f77bcf86cd7994390b1';
const STUDENT_A = '507f1f77bcf86cd7994390c1';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function runStack(middlewares, req) {
  const res = mockRes();
  let i = 0;
  let allowed = false;
  const next = async (err) => {
    if (err) throw err;
    i += 1;
    if (i >= middlewares.length) {
      allowed = true;
      return;
    }
    await middlewares[i](req, res, next);
  };
  await middlewares[0](req, res, next);
  return { res, allowed };
}

/** Mirrors studentRoutes requireManageStudentsUnlessTeacher */
function requireManageStudentsUnlessTeacher(req, res, next) {
  if (req.user?.role === 'teacher') return next();
  return checkPermission(PERMISSIONS.MANAGE_STUDENTS)(req, res, next);
}

function mockTeacherFindById(mapById) {
  const orig = Teacher.findById;
  Teacher.findById = (id) => {
    const doc = typeof mapById === 'function' ? mapById(String(id)) : mapById[String(id)];
    return {
      select() {
        return { lean: async () => doc || null };
      },
      lean: async () => doc || null,
    };
  };
  return () => { Teacher.findById = orig; };
}

function mockStudentFindById(doc) {
  const orig = Student.findById;
  Student.findById = () => ({
    select() {
      return { lean: async () => doc };
    },
  });
  return () => { Student.findById = orig; };
}

// ─── Teacher branch isolation ────────────────────────────────────────────────

test('Teacher: Branch A manager → Branch A teacher → ALLOW (assertTeacherBranchAccess)', async () => {
  const restore = mockTeacherFindById({
    [TEACHER_A]: { branchId: BRANCH_A },
  });
  try {
    const req = { params: { id: TEACHER_A }, userBranchId: BRANCH_A, user: { id: 'mgr', role: 'staff' } };
    const { res, allowed } = await runStack([assertTeacherBranchAccess], req);
    assert.equal(allowed, true);
    assert.equal(res.statusCode, 200);
  } finally {
    restore();
  }
});

test('Teacher: Branch A manager → Branch B teacher → DENY 403', async () => {
  const restore = mockTeacherFindById({
    [TEACHER_B]: { branchId: BRANCH_B },
  });
  try {
    const req = { params: { id: TEACHER_B }, userBranchId: BRANCH_A, user: { id: 'mgr', role: 'staff' } };
    const { res, allowed } = await runStack([assertTeacherBranchAccess], req);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('Teacher score stack: MANAGE_TEACHERS + same branch → ALLOW', async () => {
  const restore = mockTeacherFindById((id) => {
    if (id === '507f1f77bcf86cd799439011') {
      return {
        adminRole: 'STAFF',
        permissions: [PERMISSIONS.MANAGE_TEACHERS],
        branchId: BRANCH_A,
        role: 'staff',
      };
    }
    if (id === TEACHER_A) return { branchId: BRANCH_A };
    return null;
  });
  try {
    const req = {
      params: { id: TEACHER_A },
      userBranchId: BRANCH_A,
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
    };
    const { allowed, res } = await runStack(
      [checkPermission(PERMISSIONS.MANAGE_TEACHERS), assertTeacherBranchAccess],
      req,
    );
    assert.equal(allowed, true, `expected allow, got ${res.statusCode} ${JSON.stringify(res.body)}`);
  } finally {
    restore();
  }
});

test('Teacher score stack: MANAGE_TEACHERS + cross branch → DENY 403', async () => {
  const restore = mockTeacherFindById((id) => {
    if (id === '507f1f77bcf86cd799439011') {
      return {
        adminRole: 'STAFF',
        permissions: [PERMISSIONS.MANAGE_TEACHERS],
        branchId: BRANCH_A,
        role: 'staff',
      };
    }
    if (id === TEACHER_B) return { branchId: BRANCH_B };
    return null;
  });
  try {
    const req = {
      params: { id: TEACHER_B },
      userBranchId: BRANCH_A,
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
    };
    const { allowed, res } = await runStack(
      [checkPermission(PERMISSIONS.MANAGE_TEACHERS), assertTeacherBranchAccess],
      req,
    );
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('Teacher score stack: VIEW_TEACHERS only → DENY 403 (permission)', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.VIEW_TEACHERS],
      branchId: BRANCH_A,
      role: 'staff',
    },
  });
  try {
    const req = {
      params: { id: TEACHER_A },
      userBranchId: BRANCH_A,
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
    };
    const { allowed, res } = await runStack(
      [checkPermission(PERMISSIONS.MANAGE_TEACHERS), assertTeacherBranchAccess],
      req,
    );
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

// ─── Student authorization ───────────────────────────────────────────────────

test('Student list: staff with MANAGE_STUDENTS → ALLOW', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
      role: 'staff',
    },
  });
  try {
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const { allowed } = await runStack([requireManageStudentsUnlessTeacher], req);
    assert.equal(allowed, true);
  } finally {
    restore();
  }
});

test('Student list: staff without MANAGE_STUDENTS → DENY 403', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_FINANCE],
      role: 'staff',
    },
  });
  try {
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const { allowed, res } = await runStack([requireManageStudentsUnlessTeacher], req);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('Student list: teacher role bypasses MANAGE_STUDENTS (ownership filter elsewhere) → ALLOW', async () => {
  const req = { user: { id: TEACHER_A, role: 'teacher' } };
  const { allowed } = await runStack([requireManageStudentsUnlessTeacher], req);
  assert.equal(allowed, true);
});

test('Student mutation: Branch A manager → Branch B student → DENY 403', async () => {
  const restore = mockStudentFindById({ branchId: BRANCH_B });
  try {
    const req = {
      params: { id: STUDENT_A },
      userBranchId: BRANCH_A,
      user: { id: 'mgr', role: 'staff' },
    };
    const { allowed, res } = await runStack([assertStudentBranchAccess], req);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('Student mutation: Branch A manager → Branch A student → ALLOW', async () => {
  const restore = mockStudentFindById({ branchId: BRANCH_A });
  try {
    const req = {
      params: { id: STUDENT_A },
      userBranchId: BRANCH_A,
      user: { id: 'mgr', role: 'staff' },
    };
    const { allowed } = await runStack([assertStudentBranchAccess], req);
    assert.equal(allowed, true);
  } finally {
    restore();
  }
});

// ─── Quiz admin authorization ────────────────────────────────────────────────

test('Quiz admin/all: MANAGE_TRAINING → ALLOW', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_TRAINING],
      role: 'staff',
    },
  });
  try {
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const { allowed } = await runStack([checkPermission(PERMISSIONS.MANAGE_TRAINING)], req);
    assert.equal(allowed, true);
  } finally {
    restore();
  }
});

test('Quiz admin/all: unauthorized staff → DENY 403', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_STUDENTS],
      role: 'staff',
    },
  });
  try {
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const { allowed, res } = await runStack([checkPermission(PERMISSIONS.MANAGE_TRAINING)], req);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('Quiz admin/all: isAdmin-style role alone is insufficient without MANAGE_TRAINING', async () => {
  const restore = mockTeacherFindById({
    '507f1f77bcf86cd799439011': {
      adminRole: 'STAFF',
      permissions: [],
      role: 'admin',
    },
  });
  try {
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'admin' } };
    const { allowed, res } = await runStack([checkPermission(PERMISSIONS.MANAGE_TRAINING)], req);
    assert.equal(allowed, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});
