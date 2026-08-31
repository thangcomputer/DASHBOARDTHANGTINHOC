'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEnrollmentIndex } = require('../../services/enrollmentService');

test('resolveEnrollmentIndex accepts Mongo id, enr-N and main', () => {
  const list = [
    { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isPrimary: false },
    { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', isPrimary: true },
  ];
  assert.equal(resolveEnrollmentIndex(list, 'aaaaaaaaaaaaaaaaaaaaaaaa'), 0);
  assert.equal(resolveEnrollmentIndex(list, 'enr-0'), 0);
  assert.equal(resolveEnrollmentIndex(list, 'enr-1'), 1);
  assert.equal(resolveEnrollmentIndex(list, 'main'), 1);
  assert.equal(resolveEnrollmentIndex(list, 'enr-9'), -1);
  assert.equal(resolveEnrollmentIndex([], 'enr-0'), -1);
});
