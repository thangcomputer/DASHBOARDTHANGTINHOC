'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CertPrepSession = require('../../models/CertPrepSession');
const CertPrepQuestion = require('../../models/CertPrepQuestion');
const {
  CertPrepError,
  getSession,
  saveProgress,
  submitSession,
  toStudentSession,
  stripAnswerKeys,
} = require('../../services/certPrepService');

const STUDENT_A = '507f1f77bcf86cd7994390aa';
const STUDENT_B = '507f1f77bcf86cd7994390bb';
const SESSION_ID = '507f1f77bcf86cd7994390c1';
const QID = '507f1f77bcf86cd7994390a1';

const secretQuestion = {
  _id: QID,
  testId: '507f1f77bcf86cd7994390b1',
  locale: 'vi',
  type: 'single_choice',
  questionText: 'Câu 1',
  questionImage: '',
  options: [{ text: 'A' }, { text: 'B' }],
  correctAnswer: 1,
  correctIndices: [1],
  matchingPairs: [{ itemId: 'i1', targetId: 't1' }],
  matchingItems: [{ id: 'i1', text: 'Item' }],
  matchingTargets: [{ id: 't1', text: 'Target' }],
  explanation: 'Không được lộ',
  explanationImage: '/secret.png',
  hint: 'Gợi ý được phép',
  hintImage: '',
  minSelect: 2,
  sortOrder: 0,
};

function makeSession(overrides = {}) {
  const startedAt = overrides.startedAt || new Date(Date.now() - 10 * 60 * 1000);
  const session = {
    _id: SESSION_ID,
    studentId: STUDENT_A,
    testId: '507f1f77bcf86cd7994390b1',
    locale: 'vi',
    status: 'in_progress',
    questionIds: [QID],
    answers: [],
    startedAt,
    submittedAt: null,
    score: null,
    passed: null,
    timeSpentSeconds: 0,
    configSnapshot: {
      name: 'MOS Excel L1',
      timeLimitMinutes: 50,
      questionCount: 1,
      passingScore: 700,
      feedbackMode: 'after_submit',
    },
    async save() { return this; },
    ...overrides,
    startedAt: overrides.startedAt || startedAt,
  };
  return session;
}

function stubFinders(session, questions = [secretQuestion]) {
  const origSession = CertPrepSession.findById;
  const origQuestion = CertPrepQuestion.find;
  CertPrepSession.findById = async () => session;
  CertPrepQuestion.find = () => ({
    lean: async () => questions,
  });
  return () => {
    CertPrepSession.findById = origSession;
    CertPrepQuestion.find = origQuestion;
  };
}

function assertNoSecrets(payload) {
  const blob = JSON.stringify(payload);
  assert.equal(blob.includes('correctAnswer'), false);
  assert.equal(blob.includes('correctIndices'), false);
  assert.equal(blob.includes('matchingPairs'), false);
  assert.equal(blob.includes('Không được lộ'), false);
  assert.equal(blob.includes('explanation'), false);
  assert.equal(payload.score, undefined);
  assert.equal(payload.passed, undefined);
}

test('GET session owner A succeeds and never leaks answer keys', async () => {
  const session = makeSession();
  const restore = stubFinders(session);
  try {
    const out = await getSession(STUDENT_A, SESSION_ID);
    assert.equal(out.id, SESSION_ID);
    assert.equal(out.status, 'in_progress');
    assert.equal(out.questions[0].hint, 'Gợi ý được phép');
    assert.equal(out.questions[0].questionText, 'Câu 1');
    assertNoSecrets(out);
    assert.equal(typeof out.remainingSeconds, 'number');
    assert.ok(out.serverNow);
    assert.ok(out.deadlineAt);
  } finally {
    restore();
  }
});

test('GET session student B → 403 IDOR', async () => {
  const session = makeSession();
  const restore = stubFinders(session);
  try {
    await getSession(STUDENT_B, SESSION_ID);
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  } finally {
    restore();
  }
});

test('submit session student B → 403', async () => {
  const session = makeSession();
  const restore = stubFinders(session);
  try {
    await submitSession(STUDENT_B, SESSION_ID);
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  } finally {
    restore();
  }
});

test('autosave session student B → 403', async () => {
  const session = makeSession();
  const restore = stubFinders(session);
  try {
    await saveProgress(STUDENT_B, SESSION_ID, { answers: [{ questionId: QID, value: 0 }] });
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  } finally {
    restore();
  }
});

test('autosave on submitted session does not overwrite answers', async () => {
  const session = makeSession({
    status: 'submitted',
    answers: [{ questionId: QID, value: 1 }],
    submittedAt: new Date(),
    score: 1000,
    passed: true,
  });
  const restore = stubFinders(session);
  try {
    const out = await saveProgress(STUDENT_A, SESSION_ID, {
      answers: [{ questionId: QID, value: 0 }],
    });
    assert.equal(session.answers[0].value, 1);
    assert.equal(out.status, 'submitted');
    assert.equal(out.answers[0].value, 1);
    assertNoSecrets(out);
  } finally {
    restore();
  }
});

test('submit twice is idempotent and does not leak keys', async () => {
  const session = makeSession({
    answers: [{ questionId: QID, value: 1 }],
  });
  const restore = stubFinders(session);
  try {
    const first = await submitSession(STUDENT_A, SESSION_ID);
    assert.equal(session.status, 'submitted');
    assert.equal(first.status, 'submitted');
    const scoreAfterFirst = session.score;
    const second = await submitSession(STUDENT_A, SESSION_ID);
    assert.equal(second.status, 'submitted');
    assert.equal(session.score, scoreAfterFirst);
    assertNoSecrets(first);
    assertNoSecrets(second);
  } finally {
    restore();
  }
});

test('submit after expiry auto-finalizes on server', async () => {
  const session = makeSession({
    startedAt: new Date(Date.now() - 51 * 60 * 1000),
    answers: [{ questionId: QID, value: 0 }],
  });
  const restore = stubFinders(session);
  try {
    const out = await submitSession(STUDENT_A, SESSION_ID);
    assert.equal(session.status, 'submitted');
    assert.equal(out.status, 'submitted');
    assert.equal(out.autoSubmitted, true);
    assert.equal(out.remainingSeconds, 0);
    assertNoSecrets(out);
  } finally {
    restore();
  }
});

test('GET expired in_progress session auto-finalizes without leaking keys', async () => {
  const session = makeSession({
    startedAt: new Date(Date.now() - 51 * 60 * 1000),
  });
  const restore = stubFinders(session);
  try {
    const out = await getSession(STUDENT_A, SESSION_ID);
    assert.equal(session.status, 'submitted');
    assert.equal(out.autoSubmitted, true);
    assertNoSecrets(out);
  } finally {
    restore();
  }
});

test('client remainingSeconds is ignored; server uses startedAt + limit', async () => {
  const startedAt = new Date(Date.now() - 10 * 60 * 1000);
  const session = makeSession({ startedAt });
  const restore = stubFinders(session);
  try {
    const out = await saveProgress(STUDENT_A, SESSION_ID, {
      remainingSeconds: 9,
      answers: [{ questionId: QID, value: 1 }],
    });
    assert.equal(session.answers[0].value, 1);
    assert.ok(out.remainingSeconds > 30 * 60);
    assert.ok(out.remainingSeconds <= 40 * 60);
    assert.notEqual(out.remainingSeconds, 9);
    assertNoSecrets(out);
  } finally {
    restore();
  }
});

test('stripAnswerKeys student view keeps hint, drops explanation and keys', () => {
  const out = stripAnswerKeys(secretQuestion, { reveal: false });
  assert.equal(out.hint, 'Gợi ý được phép');
  assert.equal(out.correctAnswer, undefined);
  assert.equal(out.explanation, undefined);
});

test('toStudentSession omits passingScore from student snapshot', () => {
  const session = makeSession({
    status: 'submitted',
    score: 889,
    passed: true,
    configSnapshot: {
      name: 'MOS Excel L1',
      timeLimitMinutes: 50,
      questionCount: 1,
      passingScore: 700,
    },
  });
  const out = toStudentSession(session, [secretQuestion], { now: new Date() });
  assert.equal(out.configSnapshot.passingScore, undefined);
  assert.equal(out.configSnapshot.name, 'MOS Excel L1');
  assertNoSecrets(out);
});
