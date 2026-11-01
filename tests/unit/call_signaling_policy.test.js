'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCallPeer } = require('../../utils/callSignalingPolicy');

const conversationId = 'student_student-1__teacher_teacher-1';

test('allows only the other teacher or student in a direct conversation', () => {
  assert.deepEqual(
    resolveCallPeer({ id: 'student-1', role: 'student' }, conversationId, 'teacher-1'),
    { id: 'teacher-1', role: 'teacher' },
  );
  assert.deepEqual(
    resolveCallPeer({ id: 'teacher-1', role: 'teacher' }, conversationId, 'student-1'),
    { id: 'student-1', role: 'student' },
  );
});

test('rejects groups, mismatched targets, and non teacher-student pairs', () => {
  assert.equal(resolveCallPeer({ id: 'student-1', role: 'student' }, 'group_class-1', 'teacher-1'), null);
  assert.equal(resolveCallPeer({ id: 'student-1', role: 'student' }, conversationId, 'teacher-2'), null);
  assert.equal(
    resolveCallPeer({ id: 'student-1', role: 'student' }, 'student_student-1__student_student-2', 'student-2'),
    null,
  );
  assert.equal(
    resolveCallPeer({ id: 'admin-1', role: 'admin' }, 'admin_admin-1__student_student-1', 'student-1'),
    null,
  );
});
