/**
 * Wave 0/2 authz matrix + money helper unit tests (no Mongo required).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS } = require('../../constants/permissions');
const { checkPermission } = require('../../middleware/auth');
const { amountsMatch } = require('../../utils/sepayMatch');
const Teacher = require('../../models/Teacher');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('MANAGE_TEACHERS required for write — VIEW_TEACHERS alone is 403', async () => {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.VIEW_TEACHERS],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const mw = checkPermission(PERMISSIONS.MANAGE_TEACHERS);
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

test('MANAGE_HR passes when staff has manage_hr', async () => {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_HR],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const mw = checkPermission(PERMISSIONS.MANAGE_HR);
    const req = { user: { id: '507f1f77bcf86cd799439011', role: 'staff' } };
    const res = mockRes();
    let next = false;
    await mw(req, res, () => { next = true; });
    assert.equal(next, true);
  } finally {
    Teacher.findById = orig;
  }
});

test('amountsMatch fail-closed for zero/negative expected', () => {
  assert.equal(amountsMatch(0, 100000), false);
  assert.equal(amountsMatch(-5, 100000), false);
  assert.equal(amountsMatch(100000, 100000), true);
});

test('branchFilter: SUPPORT is scoped to own branch (not all-branch)', async () => {
  const { branchFilter } = require('../../middleware/auth');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'SUPPORT',
          branchId: '507f1f77bcf86cd799439099',
          branchCode: 'CN1',
        }),
      };
    },
  });
  try {
    const req = {
      user: { id: '507f1f77bcf86cd799439011', role: 'staff' },
      query: {},
      headers: {},
    };
    const res = mockRes();
    let next = false;
    await branchFilter(req, res, () => { next = true; });
    assert.equal(next, true);
    assert.equal(String(req.branchFilter.branchId), '507f1f77bcf86cd799439099');
  } finally {
    Teacher.findById = orig;
  }
});

test('realtimeEmit helpers export emitBranch/emitDataRefresh', () => {
  const rt = require('../../utils/realtimeEmit');
  assert.equal(typeof rt.emitBranch, 'function');
  assert.equal(typeof rt.emitDataRefresh, 'function');
  const rooms = [];
  const io = {
    to(room) {
      rooms.push(room);
      return { emit() {} };
    },
  };
  rt.emitBranch(io, 'b1', 'data:refresh', { x: 1 });
  assert.ok(rooms.includes('branch_b1'));
  assert.ok(rooms.includes('ALL_ADMIN'));
});
