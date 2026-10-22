'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { basename, resolve } = require('node:path');

test('practice praise matches each supplied recording and avoids repeating the previous phrase', async () => {
  const feedback = await import('../../client/src/utils/lessonPracticeQuizFeedback.js');
  assert.equal(
    new Set(feedback.PRACTICE_PRAISES.map((item) => item.audio)).size,
    feedback.PRACTICE_PRAISES.length,
  );
  assert.equal(feedback.PRACTICE_PRAISES.length, 11);
  for (const praise of feedback.PRACTICE_PRAISES) {
    assert.ok(praise.audio.startsWith('/audio/lesson-practice/'));
    assert.ok(existsSync(resolve(process.cwd(), 'client', 'public', praise.audio.slice(1))), praise.audio);
  }
  assert.deepEqual(
    Object.fromEntries(feedback.PRACTICE_PRAISES.map((item) => [basename(item.audio), item.text])),
    {
      'praise-expert-male.mp3': 'Bạn là chuyên gia!',
      'praise-computer-master-female.mp3': 'Bậc thầy tin học!',
      'praise-correct-male.mp3': 'Chính xác!',
      'praise-correct-female.mp3': 'Chính xác!',
      'praise-perfect-male.mp3': 'Hoàn hảo!',
      'praise-perfect-female.mp3': 'Hoàn hảo!',
      'praise-like-an-expert-female.mp3': 'Như chuyên gia!',
      'praise-professional-female.mp3': 'Quá chuyên nghiệp!',
      'praise-beyond-wonderful-male.mp3': 'Trên cả tuyệt vời!',
      'praise-wonderful-male.mp3': 'Tuyệt vời!',
      'praise-wonderful-female.mp3': 'Tuyệt vời!',
    },
  );
  assert.equal(feedback.getPracticePraise('', () => 0).text, feedback.PRACTICE_PRAISES[0].text);
  assert.equal(feedback.getPracticePraise('', () => 0.99).text, feedback.PRACTICE_PRAISES.at(-1).text);
  for (const text of new Set(feedback.PRACTICE_PRAISES.map((item) => item.text))) {
    const nextPraise = feedback.getPracticePraise(text, () => 0);
    assert.notEqual(nextPraise.text, text);
    assert.equal(typeof nextPraise.detail, 'string');
  }
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

test('wrong question ids are unique and ignore invalid values', async () => {
  const {
    addPracticeWrongQuestionId,
    normalizePracticeWrongQuestionIds,
    retainKnownPracticeWrongQuestionIds,
  } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  assert.deepEqual(normalizePracticeWrongQuestionIds(['q1', '', 'q1', null]), ['q1']);
  assert.deepEqual(addPracticeWrongQuestionId(['q1'], 'q2'), ['q1', 'q2']);
  assert.deepEqual(addPracticeWrongQuestionId(['q1'], 'q1'), ['q1']);
  assert.deepEqual(
    retainKnownPracticeWrongQuestionIds(['unfinished', 'q1', 'removed'], [
      { id: 'unfinished', confirmed: false },
      { id: 'q1', confirmed: true },
    ]),
    ['unfinished', 'q1'],
  );
});

test('review grading uses only the backend-confirmed answer for supported objective types', async () => {
  const { gradePracticeReviewAnswer } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  const confirmed = { confirmed: true, correct: true };
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'mcq',
    type: 'mcq',
    options: [{ id: 'a' }, { id: 'b' }],
    answer: { choiceId: 'b' },
  }, { choiceId: 'b' }), true);
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'multi',
    type: 'multi',
    options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    answer: { choiceIds: ['a', 'c'] },
  }, { choiceIds: ['c', 'a'] }), true);
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'match',
    type: 'match',
    pairs: [{ id: 'a' }, { id: 'b' }],
    answer: { matches: [{ leftId: 'a', rightId: 'a' }, { leftId: 'b', rightId: 'b' }] },
  }, { matches: [{ leftId: 'b', rightId: 'b' }, { leftId: 'a', rightId: 'a' }] }), true);
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'drag',
    type: 'drag',
    options: [{ id: 'a' }, { id: 'b' }],
    answer: { order: ['b', 'a'] },
  }, { order: ['a', 'b'] }), false);
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'hotspot',
    type: 'hotspot',
    region: { x: 20, y: 10, w: 30, h: 20 },
    answer: { x: 30, y: 20 },
  }, { x: 50, y: 30 }), true);
  assert.equal(gradePracticeReviewAnswer({
    ...confirmed,
    id: 'written',
    type: 'written',
    answer: { text: 'đáp án đã được AI chấm' },
  }, { text: 'đáp án đã được AI chấm' }), null);
});

test('review results ignore unconfirmed questions and summarize only completed local reviews', async () => {
  const { normalizePracticeReviewResults, summarizePracticeAttempt, summarizePracticeReview } = await import(
    '../../client/src/utils/lessonPracticeQuizFeedback.js'
  );
  const items = [
    {
      id: 'q1',
      type: 'mcq',
      confirmed: true,
      correct: true,
      options: [{ id: 'a' }, { id: 'b' }],
      answer: { choiceId: 'a' },
    },
    {
      id: 'q2',
      type: 'mcq',
      confirmed: true,
      correct: true,
      options: [{ id: 'a' }, { id: 'b' }],
      answer: { choiceId: 'b' },
    },
    { id: 'q3', type: 'mcq', confirmed: false, correct: false, answer: null },
  ];
  const results = normalizePracticeReviewResults({ q1: true, q2: false, q3: true, extra: true }, items);
  assert.deepEqual(results, { q1: true, q2: false });
  assert.deepEqual(summarizePracticeReview(items, { q1: true }), {
    total: 2,
    improved: 1,
    needsReview: 0,
    remaining: 1,
    complete: false,
  });
  assert.deepEqual(summarizePracticeReview(items, results), {
    total: 2,
    improved: 1,
    needsReview: 1,
    remaining: 0,
    complete: true,
  });
  assert.deepEqual(summarizePracticeAttempt(items, {
    correctAttempts: 2,
    wrongAttempts: 3,
    bestStreak: 2,
  }), {
    correct: 2,
    total: 3,
    wrong: 3,
    percentage: 40,
    bestStreak: 2,
  });
  assert.deepEqual(summarizePracticeReview(items, { q1: true }), {
    total: 2,
    improved: 1,
    needsReview: 0,
    remaining: 1,
    complete: false,
  });
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
