const test = require('node:test');
const assert = require('node:assert/strict');

// Lightweight middleware smoke — mock Teacher.findById
const Teacher = require('../../models/Teacher');
const { checkPermission, checkAnyPermission } = require('../../middleware/auth');
const { PERMISSIONS } = require('../../constants/permissions');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('checkPermission: hardcoded admin passes', async () => {
  const mw = checkPermission(PERMISSIONS.MANAGE_FINANCE);
  const req = { user: { id: 'admin', role: 'admin' } };
  const res = mockRes();
  let next = false;
  await mw(req, res, () => { next = true; });
  assert.equal(next, true);
});

test('checkPermission: staff without perm is 403', async () => {
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

test('checkAnyPermission: staff with view_branch_revenue passes analytics', async () => {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const mw = checkAnyPermission(PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE);
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const res = mockRes();
    let next = false;
    await mw(req, res, () => { next = true; });
    assert.equal(next, true);
  } finally {
    Teacher.findById = orig;
  }
});

test('userHasPermission: staff without manage_students is false', async () => {
  const { userHasPermission } = require('../../middleware/auth');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({ adminRole: 'STAFF', permissions: ['manage_finance'] }),
      };
    },
  });
  try {
    const ok = await userHasPermission(
      { id: '507f1f77bcf86cd799439011', role: 'staff' },
      PERMISSIONS.MANAGE_STUDENTS,
    );
    assert.equal(ok, false);
  } finally {
    Teacher.findById = orig;
  }
});
