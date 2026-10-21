'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('practice praise cycles by confirmed correct answer count', async () => {
  const feedback = await import('../../client/src/utils/lessonPracticeQuizFeedback.js');
  assert.equal(feedback.PRACTICE_PRAISES.length, 10);
  assert.equal(new Set(feedback.PRACTICE_PRAISES.map((item) => item.text)).size, 10);
  assert.equal(feedback.getPracticePraise(1).text, 'Bạn giỏi quá!');
  assert.equal(feedback.getPracticePraise(10).text, 'HOÀN HẢO! Bạn là nhà vô địch!');
  assert.equal(feedback.getPracticePraise(11).text, feedback.getPracticePraise(1).text);
});

test('wrong attempts reset the streak and correct attempts update its record', async () => {
  const { advancePracticeAttemptStats, createPracticeAttemptStats } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  let stats = advancePracticeAttemptStats(createPracticeAttemptStats(), true);
  stats = advancePracticeAttemptStats(stats, true);
  stats = advancePracticeAttemptStats(stats, false);
  assert.deepEqual(stats, { correctAttempts: 2, wrongAttempts: 1, streak: 0, bestStreak: 2 });
  stats = advancePracticeAttemptStats(stats, true);
  assert.equal(stats.streak, 1);
  assert.equal(stats.bestStreak, 2);
});

test('summary uses backend-confirmed correct questions and completed attempts only', async () => {
  const { isPracticeAttemptComplete, isPerfectTenPracticeResult, summarizePracticeAttempt } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  const items = [
    { confirmed: true, correct: true },
    { confirmed: true, correct: true },
    { confirmed: false, correct: false },
  ];
  assert.equal(isPracticeAttemptComplete(items), false);
  assert.deepEqual(summarizePracticeAttempt(items, {
    correctAttempts: 2,
    wrongAttempts: 1,
    bestStreak: 2,
  }), {
    correct: 2,
    total: 3,
    wrong: 1,
    percentage: 67,
    bestStreak: 2,
  });
  assert.equal(isPracticeAttemptComplete(items.slice(0, 2)), true);
  assert.equal(isPerfectTenPracticeResult({ total: 10, correct: 10 }), true);
  assert.equal(isPerfectTenPracticeResult({ total: 4, correct: 4 }), false);
});

test('a question cannot be submitted twice while its first request is pending', async () => {
  const { claimPracticeSubmission } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  const activeIds = new Set();
  assert.equal(claimPracticeSubmission(activeIds, 'question-1'), true);
  assert.equal(claimPracticeSubmission(activeIds, 'question-1'), false);
  activeIds.delete('question-1');
  assert.equal(claimPracticeSubmission(activeIds, 'question-1', true), false);
});
