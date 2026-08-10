/**
 * STAFF ↔ TEACHER branch scope must be bidirectional.
 * Regression: TEACHER→STAFF soft-allowed empty branch, STAFF→TEACHER denied.
 */
'use strict';

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');

const Teacher = require('../../models/Teacher');
const {
  PRODUCT_ROLES,
  sameBranch,
  assertMessagingPairAllowed,
} = require('../../services/messagingPairing');

const STAFF_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEACHER_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const BRANCH_A = 'cccccccccccccccccccccccc';
const BRANCH_B = 'dddddddddddddddddddddddd';

describe('STAFF ↔ TEACHER messaging scope', { concurrency: false }, () => {
  let findByIdMock;

  before(() => {
    findByIdMock = mock.method(Teacher, 'findById', (id) => {
      const sid = String(id);
      const docs = {
        [STAFF_ID]: {
          _id: STAFF_ID,
          id: STAFF_ID,
          name: 'Staff A',
          role: 'admin',
          adminRole: 'STAFF',
          branchId: BRANCH_A,
          branchCode: 'CN-A',
          status: 'Active',
        },
        [TEACHER_ID]: {
          _id: TEACHER_ID,
          id: TEACHER_ID,
          name: 'Teacher A',
          role: 'teacher',
          adminRole: null,
          branchId: null,
          branchCode: '',
          status: 'Active',
        },
      };
      const doc = docs[sid] || null;
      return {
        select() {
          return {
            lean: async () => doc,
          };
        },
        lean: async () => doc,
      };
    });
  });

  after(() => {
    findByIdMock.mock.restore();
  });

  it('sameBranch matches by branchCode when ids differ in presence', () => {
    assert.equal(
      sameBranch({ branchId: BRANCH_A, branchCode: 'CN-A' }, { branchId: null, branchCode: 'CN-A' }),
      true,
    );
    assert.equal(
      sameBranch({ branchId: BRANCH_A }, { branchId: BRANCH_B }),
      false,
    );
  });

  it('TEACHER → STAFF allowed when teacher has empty branch (soft-allow)', async () => {
    const teacher = { id: TEACHER_ID, role: 'teacher', branchId: null, branchCode: '' };
    const r = await assertMessagingPairAllowed(teacher, STAFF_ID, 'staff');
    assert.equal(r.ok, true, r.message);
  });

  it('STAFF → TEACHER allowed when teacher has empty branch (bidirectional soft-allow)', async () => {
    const staff = {
      id: STAFF_ID,
      role: 'admin',
      adminRole: 'STAFF',
      branchId: BRANCH_A,
      branchCode: 'CN-A',
    };
    const r = await assertMessagingPairAllowed(staff, TEACHER_ID, 'teacher');
    assert.equal(r.ok, true, r.message);
    assert.equal(r.productRole, PRODUCT_ROLES.TEACHER);
  });

  it('STAFF → TEACHER denied on hard cross-branch', async () => {
    findByIdMock.mock.restore();
    findByIdMock = mock.method(Teacher, 'findById', (id) => {
      const sid = String(id);
      const docs = {
        [STAFF_ID]: {
          _id: STAFF_ID,
          role: 'admin',
          adminRole: 'STAFF',
          branchId: BRANCH_A,
          branchCode: 'CN-A',
        },
        [TEACHER_ID]: {
          _id: TEACHER_ID,
          role: 'teacher',
          adminRole: null,
          branchId: BRANCH_B,
          branchCode: 'CN-B',
        },
      };
      const doc = docs[sid] || null;
      return {
        select() {
          return { lean: async () => doc };
        },
        lean: async () => doc,
      };
    });

    const staff = {
      id: STAFF_ID,
      role: 'admin',
      adminRole: 'STAFF',
      branchId: BRANCH_A,
      branchCode: 'CN-A',
    };
    const r = await assertMessagingPairAllowed(staff, TEACHER_ID, 'teacher');
    assert.equal(r.ok, false);
    assert.match(String(r.message || ''), /chi nhanh/i);
  });
});
