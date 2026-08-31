'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  attemptedTeacherExamFields,
} = require('../../utils/teacherExamFields');

test('teacher self-profile payload rejects every exam outcome and approval field', () => {
  const forbidden = attemptedTeacherExamFields({
    email: 'contact@example.test',
    testScore: 100,
    testStatus: 'Passed',
    testMcCorrect: 10,
    testMcTotal: 10,
    passed: true,
    practicalStatus: 'approved',
    status: 'active',
  });

  assert.deepEqual(forbidden.sort(), [
    'passed',
    'practicalStatus',
    'status',
    'testMcCorrect',
    'testMcTotal',
    'testScore',
    'testStatus',
  ].sort());
  assert.deepEqual(attemptedTeacherExamFields({
    email: 'contact@example.test',
    bio: 'profile',
  }), []);
});
