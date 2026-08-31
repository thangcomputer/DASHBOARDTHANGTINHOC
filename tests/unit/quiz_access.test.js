'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  studentAssignedToQuiz,
  quizWindow,
  claimQuizSubmission,
} = require('../../services/quizAccess');

test('studentAssignedToQuiz: targeted student', () => {
  const quiz = { targetStudentIds: ['a1'], courseName: 'Word' };
  assert.equal(studentAssignedToQuiz(quiz, { _id: 'a1', course: 'Excel' }), true);
  assert.equal(studentAssignedToQuiz(quiz, { _id: 'b2', course: 'Word' }), false);
});

test('studentAssignedToQuiz: empty targets only matching course', () => {
  const quiz = { targetStudentIds: [], courseName: 'Word' };
  assert.equal(studentAssignedToQuiz(quiz, { _id: 'a1', course: 'Word' }), true);
  assert.equal(studentAssignedToQuiz(quiz, { _id: 'a1', course: 'Excel' }), false);
  assert.equal(studentAssignedToQuiz({ targetStudentIds: [], courseName: '' }, { _id: 'a1', course: 'Word' }), false);
});

test('studentAssignedToQuiz: enrollment name matches course', () => {
  const quiz = { targetStudentIds: [], courseName: 'Word' };
  assert.equal(
    studentAssignedToQuiz(quiz, { _id: 'a1', enrollments: [{ name: 'Word' }] }),
    true,
  );
});

test('quizWindow: startTime and deadline', () => {
  const now = 1_000_000;
  assert.deepEqual(quizWindow({ startTime: now + 1000, deadline: now + 5000 }, now), {
    notYetOpen: true,
    expired: false,
  });
  assert.deepEqual(quizWindow({ startTime: now - 1000, deadline: now - 1 }, now), {
    notYetOpen: false,
    expired: true,
  });
  assert.deepEqual(quizWindow({}, now), { notYetOpen: false, expired: false });
});

test('claimQuizSubmission: concurrent requests append only once', async () => {
  const state = { _id: 'quiz-1', submissions: [] };
  let writes = 0;
  const FakeQuiz = {
    findOneAndUpdate(_filter, update) {
      const studentId = update.$push.submissions.studentId;
      const exists = state.submissions.some((item) => String(item.studentId) === String(studentId));
      if (exists) return Promise.resolve(null);
      state.submissions.push({ ...update.$push.submissions });
      writes += 1;
      return Promise.resolve({ ...state, submissions: [...state.submissions] });
    },
    findById() {
      return {
        select() {
          return {
            lean: async () => ({ ...state, submissions: [...state.submissions] }),
          };
        },
      };
    },
  };

  const payload = { studentId: 'student-1', score: 75 };
  const [first, second] = await Promise.all([
    claimQuizSubmission(FakeQuiz, 'quiz-1', 'student-1', payload),
    claimQuizSubmission(FakeQuiz, 'quiz-1', 'student-1', payload),
  ]);

  assert.equal(writes, 1);
  assert.equal(state.submissions.length, 1);
  assert.equal([first.created, second.created].filter(Boolean).length, 1);
  assert.equal([first.existing, second.existing].filter(Boolean).length, 1);
});
