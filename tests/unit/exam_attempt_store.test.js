'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  claimStudentAttempt,
  claimTeacherAttempt,
} = require('../../services/examAttemptStore');

test('student attempt atomic claim allows one concurrent writer', async () => {
  const state = {
    _id: 'student-1',
    examProgress: [{
      id: 'word',
      attemptId: 'attempt-1',
      attemptStatus: 'active',
    }],
  };
  let writes = 0;
  const StudentModel = {
    findOneAndUpdate(filter, update) {
      const expected = filter.examProgress.$elemMatch;
      const entry = state.examProgress.find((item) => (
        item.id === expected.id
        && item.attemptId === expected.attemptId
        && item.attemptStatus === expected.attemptStatus
      ));
      if (!entry) return Promise.resolve(null);
      entry.attemptStatus = update.$set['examProgress.$.attemptStatus'];
      writes += 1;
      return Promise.resolve(structuredClone(state));
    },
  };

  const input = {
    studentId: 'student-1',
    subjectId: 'word',
    attemptId: 'attempt-1',
    setFields: { 'examProgress.$.attemptStatus': 'submitted' },
  };
  const results = await Promise.all([
    claimStudentAttempt(StudentModel, input),
    claimStudentAttempt(StudentModel, input),
  ]);

  assert.equal(writes, 1);
  assert.equal(results.filter(Boolean).length, 1);
});

test('teacher attempt atomic claim allows one concurrent writer', async () => {
  const state = {
    _id: 'teacher-1',
    examAttemptId: 'attempt-1',
    examAttemptStatus: 'active',
  };
  let writes = 0;
  const TeacherModel = {
    findOneAndUpdate(filter, update) {
      const matched = state._id === filter._id
        && state.examAttemptId === filter.examAttemptId
        && state.examAttemptStatus === filter.examAttemptStatus;
      const promise = matched
        ? (() => {
          state.examAttemptStatus = update.$set.examAttemptStatus;
          writes += 1;
          return Promise.resolve(structuredClone(state));
        })()
        : Promise.resolve(null);
      promise.select = () => promise;
      return promise;
    },
  };

  const input = {
    teacherId: 'teacher-1',
    attemptId: 'attempt-1',
    setFields: { examAttemptStatus: 'submitted' },
  };
  const results = await Promise.all([
    claimTeacherAttempt(TeacherModel, input),
    claimTeacherAttempt(TeacherModel, input),
  ]);

  assert.equal(writes, 1);
  assert.equal(results.filter(Boolean).length, 1);
});
