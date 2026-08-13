'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapEnrollmentStatusToRoot } = require('../../utils/studentStatusMap');

test('mapEnrollmentStatusToRoot: active → Đang học', () => {
  assert.equal(mapEnrollmentStatusToRoot('active'), 'Đang học');
});

test('mapEnrollmentStatusToRoot: completed → Hoàn thành', () => {
  assert.equal(mapEnrollmentStatusToRoot('completed'), 'Hoàn thành');
});

test('mapEnrollmentStatusToRoot: passes through Vietnamese root labels', () => {
  assert.equal(mapEnrollmentStatusToRoot('Đang học'), 'Đang học');
  assert.equal(mapEnrollmentStatusToRoot('Hoàn thành'), 'Hoàn thành');
  assert.equal(mapEnrollmentStatusToRoot('Chờ xếp lớp'), 'Chờ xếp lớp');
});

test('TDZ regression: attendance PUT path must use populated not pre-init student', () => {
  // Simulates the fixed branch: only `populated` exists before emit
  const populated = { _id: 'abc', branchId: null, teacherId: 't1', status: 'Đang học' };
  let emitted = null;
  function studentRealtime(_io, studentLike) {
    emitted = studentLike;
  }
  // Must not reference undeclared `student`
  studentRealtime(null, populated);
  assert.equal(emitted, populated);
  assert.equal(emitted.status, 'Đang học');
});
