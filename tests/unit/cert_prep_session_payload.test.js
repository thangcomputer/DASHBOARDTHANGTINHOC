'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stripAnswerKeys,
  sessionTiming,
  toStudentSession,
  mergeAnswers,
  isSessionExpired,
} = require('../../services/certPrepService');

const question = {
  _id: '507f1f77bcf86cd7994390a1',
  testId: '507f1f77bcf86cd7994390b1',
  locale: 'vi',
  type: 'single_choice',
  questionText: 'Câu 1',
  questionImage: '',
  options: [{ text: 'A' }, { text: 'B' }],
  correctAnswer: 1,
  correctIndices: [1],
  matchingPairs: [{ itemId: 'i1', targetId: 't1' }],
  explanation: 'Bí mật',
  explanationImage: '/secret.png',
  hint: 'Gợi ý công khai',
  hintImage: '',
  minSelect: 2,
  sortOrder: 0,
};

test('stripAnswerKeys in_progress omits keys and explanation', () => {
  const out = stripAnswerKeys(question, { reveal: false });
  assert.equal(out.correctAnswer, undefined);
  assert.equal(out.correctIndices, undefined);
  assert.equal(out.matchingPairs, undefined);
  assert.equal(out.explanation, undefined);
  assert.equal(out.explanationImage, undefined);
  assert.equal(out.minSelect, undefined);
  assert.equal(out.hint, 'Gợi ý công khai');
  assert.equal(out.questionText, 'Câu 1');
});

test('toStudentSession never includes correctAnswer/score/passed', () => {
  const session = {
    _id: '507f1f77bcf86cd7994390c1',
    testId: '507f1f77bcf86cd7994390b1',
    locale: 'vi',
    status: 'submitted',
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    submittedAt: new Date('2026-08-15T00:10:00.000Z'),
    score: 889,
    passed: true,
    answers: [{ questionId: '507f1f77bcf86cd7994390a1', value: 1 }],
    configSnapshot: { name: 'Test 01', timeLimitMinutes: 50, questionCount: 45, passingScore: 700 },
  };
  const out = toStudentSession(session, [question], { now: new Date('2026-08-15T00:10:00.000Z') });
  const blob = JSON.stringify(out);
  assert.equal(out.score, undefined);
  assert.equal(out.passed, undefined);
  assert.equal(blob.includes('correctAnswer'), false);
  assert.equal(blob.includes('Bí mật'), false);
  assert.equal(blob.includes('matchingPairs'), false);
  assert.equal(out.questions[0].hint, 'Gợi ý công khai');
  assert.equal(out.status, 'submitted');
});

test('sessionTiming remainingSeconds uses startedAt + timeLimitMinutes', () => {
  const session = {
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    configSnapshot: { timeLimitMinutes: 50 },
  };
  const t = sessionTiming(session, new Date('2026-08-15T00:10:00.000Z'));
  assert.equal(t.remainingSeconds, 40 * 60);
  assert.ok(t.serverNow);
  assert.ok(t.deadlineAt);
});

test('sessionTiming is 0 after expiry; server does not use client remainingSeconds', () => {
  const session = {
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    configSnapshot: { timeLimitMinutes: 50 },
  };
  const t = sessionTiming(session, new Date('2026-08-15T00:50:00.000Z'));
  assert.equal(t.remainingSeconds, 0);
  assert.equal(isSessionExpired(session, 50, new Date('2026-08-15T00:50:00.000Z')), true);
});

test('paused time does not count toward expiry or remainingSeconds', () => {
  const session = {
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    pausedAt: new Date('2026-08-15T00:10:00.000Z'),
    pausedTotalMs: 0,
    configSnapshot: { timeLimitMinutes: 50 },
  };
  // Wall clock +40m after start, but paused since +10m → only 10m active
  const now = new Date('2026-08-15T00:40:00.000Z');
  const t = sessionTiming(session, now);
  assert.equal(t.remainingSeconds, 40 * 60);
  assert.equal(t.paused, true);
  assert.equal(isSessionExpired(session, 50, now), false);
});

test('pausedTotalMs is subtracted after resume', () => {
  const session = {
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    pausedAt: null,
    pausedTotalMs: 30 * 60 * 1000,
    configSnapshot: { timeLimitMinutes: 50 },
  };
  // Wall 40m, paused 30m total → active 10m → remaining 40m
  const t = sessionTiming(session, new Date('2026-08-15T00:40:00.000Z'));
  assert.equal(t.remainingSeconds, 40 * 60);
  assert.equal(isSessionExpired(session, 50, new Date('2026-08-15T00:40:00.000Z')), false);
});

test('mergeAnswers ignores unknown question ids and remainingSeconds-like fields', () => {
  const session = {
    questionIds: ['507f1f77bcf86cd7994390a1'],
    answers: [],
  };
  const next = mergeAnswers(session, [
    { questionId: '507f1f77bcf86cd7994390a1', value: 2 },
    { questionId: '507f1f77bcf86cd7994390ff', value: 0 },
    { remainingSeconds: 9999, value: 1 },
  ]);
  assert.equal(next.length, 1);
  assert.equal(String(next[0].questionId), '507f1f77bcf86cd7994390a1');
  assert.equal(next[0].value, 2);
});
