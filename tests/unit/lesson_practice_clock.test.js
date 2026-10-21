'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('unit practice time is shared across questions and uses one deadline', async () => {
  const {
    createPracticeClockSession,
    remainingPracticeSeconds,
    resolvePracticeClock,
    resolvePracticeGroupTimeLimit,
    restorePracticeClockSession,
  } = await import('../../client/src/utils/lessonPracticeClock.js');

  const clock = resolvePracticeClock(30, 0);
  assert.deepEqual(clock, { limitSec: 30, shared: true });
  assert.deepEqual(resolvePracticeClock(30, 5), { limitSec: 30, shared: true });

  const firstQuestionSession = createPracticeClockSession(null, 'unit:round:shared', clock.limitSec, 1000);
  const nextQuestionSession = createPracticeClockSession(
    firstQuestionSession,
    'unit:round:shared',
    clock.limitSec,
    5000,
  );

  assert.equal(nextQuestionSession, firstQuestionSession);
  assert.equal(remainingPracticeSeconds(nextQuestionSession, 5000), 26);
  const resumedSession = restorePracticeClockSession(null, 'unit:round:shared', 30, 14, 9000);
  assert.equal(remainingPracticeSeconds(resumedSession, 9000), 14);
  assert.equal(remainingPracticeSeconds(resumedSession, 10000), 13);
  const freshSession = restorePracticeClockSession(null, 'unit:new:shared', 30, null, 9000);
  assert.equal(remainingPracticeSeconds(freshSession, 9000), 30);
  const isolatedSession = restorePracticeClockSession(resumedSession, 'other-unit:shared', 30, 7, 9000);
  assert.notEqual(isolatedSession, resumedSession);
  assert.equal(remainingPracticeSeconds(isolatedSession, 9000), 7);
  const groupLimits = [
    { groupId: 'part-a', timeLimitSec: 11 },
    { groupId: 'part-b', timeLimitSec: 45 },
  ];
  assert.equal(resolvePracticeGroupTimeLimit(groupLimits, 'part-a', 30), 11);
  assert.equal(resolvePracticeGroupTimeLimit(groupLimits, 'part-b', 30), 45);
  assert.equal(resolvePracticeGroupTimeLimit(groupLimits, 'part-c', 30), 30);
});

test('question-specific time starts a separate clock when no unit-wide time is set', async () => {
  const {
    createPracticeClockSession,
    remainingPracticeSeconds,
    resolvePracticeClock,
  } = await import('../../client/src/utils/lessonPracticeClock.js');

  const clock = resolvePracticeClock(0, 30);
  assert.deepEqual(clock, { limitSec: 30, shared: false });

  const firstQuestionSession = createPracticeClockSession(null, 'unit:round:q1', clock.limitSec, 1000);
  const nextQuestionSession = createPracticeClockSession(firstQuestionSession, 'unit:round:q2', clock.limitSec, 5000);

  assert.notEqual(nextQuestionSession, firstQuestionSession);
  assert.equal(remainingPracticeSeconds(nextQuestionSession, 5000), 30);
});
