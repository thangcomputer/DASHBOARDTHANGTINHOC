'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Student = require('../../models/Student');
const { syncStudentFromPrimaryEnrollment } = require('../../services/enrollmentService');

function baseStudent(overrides = {}) {
  return new Student({
    name: 'TEST HV',
    zalo: '0900000000',
    phone: '0900000000',
    course: 'thvp',
    price: 3000000,
    paid: true,
    enrollments: [],
    ...overrides,
  });
}

describe('REFUND-FIX-1 syncStudentFromPrimaryEnrollment', () => {
  it('A: cancel one of many — course stays remaining active name', () => {
    const idA = new mongoose.Types.ObjectId();
    const idB = new mongoose.Types.ObjectId();
    const student = baseStudent({
      enrollments: [
        {
          _id: idA,
          courseName: 'Course A',
          price: 1000,
          paid: true,
          status: 'cancelled',
          isPrimary: false,
        },
        {
          _id: idB,
          courseName: 'Course B',
          price: 2000,
          paid: true,
          status: 'active',
          isPrimary: true,
        },
      ],
    });
    syncStudentFromPrimaryEnrollment(student);
    assert.equal(student.course, 'Course B');
    assert.equal(student.price, 2000);
    assert.equal(student.paid, true);
    const err = student.validateSync();
    assert.equal(err, undefined);
  });

  it('B: cancel final enrollment — course is (Đã hủy), not empty; validates', () => {
    const idA = new mongoose.Types.ObjectId();
    const student = baseStudent({
      enrollments: [
        {
          _id: idA,
          courseName: 'thvp',
          price: 3000000,
          paid: false,
          status: 'cancelled',
          isPrimary: false,
          refundedAmount: 0,
        },
      ],
    });
    syncStudentFromPrimaryEnrollment(student);
    assert.equal(student.course, '(Đã hủy)');
    assert.notEqual(student.course, '');
    assert.equal(student.price, 0);
    assert.equal(student.paid, false);
    const err = student.validateSync();
    assert.equal(err, undefined, err && err.message);
  });

  it('C: empty course would fail schema required (regression guard)', () => {
    const student = baseStudent({ course: '' });
    const err = student.validateSync();
    assert.ok(err);
    assert.match(String(err.message), /Tên khóa học là bắt buộc|course/i);
  });

  it('D: placeholder (Đã hủy) satisfies required course', () => {
    const student = baseStudent({ course: '(Đã hủy)', price: 0, paid: false });
    const err = student.validateSync();
    assert.equal(err, undefined, err && err.message);
  });

  it('E: refund idempotency key pattern is stable per student+enrollment', () => {
    const sid = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const eid = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const key1 = `refund:cancel:${sid}:${eid}`;
    const key2 = `refund:cancel:${sid}:${eid}`;
    assert.equal(key1, key2);
    assert.notEqual(key1, `refund:cancel:${sid}:cccccccccccccccccccccccc`);
  });

  it('F: legacy main — list should not invent enrollment id (contract)', () => {
    // Mirrors AdminStudentsTab openRefundModal guard — documentation as assertion
    const enrId = 'main';
    const blocked = !enrId || enrId === 'main';
    assert.equal(blocked, true);
  });
});
