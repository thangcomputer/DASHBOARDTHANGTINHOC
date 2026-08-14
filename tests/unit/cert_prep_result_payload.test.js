'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CertPrepSession = require('../../models/CertPrepSession');
const CertPrepQuestion = require('../../models/CertPrepQuestion');
const {
  CertPrepError,
  SCORE_SCALE,
  freezeQuestion,
  toStudentResult,
  toStudentSession,
  getSession,
  getSessionResult,
  listStudentAttempts,
  submitSession,
} = require('../../services/certPrepService');

const STUDENT_A = '507f1f77bcf86cd7994390aa';
const STUDENT_B = '507f1f77bcf86cd7994390bb';
const SESSION_ID = '507f1f77bcf86cd7994390c1';
const TEST_ID = '507f1f77bcf86cd7994390b1';
const QID = '507f1f77bcf86cd7994390a1';

const liveQuestion = {
  _id: QID,
  testId: TEST_ID,
  locale: 'vi',
  type: 'single_choice',
  questionText: 'Câu gốc',
  questionImage: '/q.png',
  options: [{ text: 'A', imageUrl: '/a.png' }, { text: 'B' }],
  correctAnswer: 1,
  correctIndices: [1],
  matchingPairs: [],
  matchingItems: [],
  matchingTargets: [],
  explanation: 'Vì B đúng',
  explanationImage: '',
  hint: 'Gợi ý',
  hintImage: '',
  minSelect: 2,
  sortOrder: 0,
};

function makeSubmitted(overrides = {}) {
  const snapshot = [freezeQuestion(liveQuestion)];
  const session = {
    _id: SESSION_ID,
    studentId: STUDENT_A,
    testId: TEST_ID,
    locale: 'vi',
    status: 'submitted',
    questionIds: [QID],
    answers: [{ questionId: QID, value: 1 }],
    startedAt: new Date('2026-08-15T00:00:00.000Z'),
    submittedAt: new Date('2026-08-15T00:12:00.000Z'),
    score: 1000,
    passed: true,
    correctCount: 1,
    answeredCount: 1,
    timeSpentSeconds: 720,
    configSnapshot: {
      name: 'MOS Excel L1',
      timeLimitMinutes: 50,
      questionCount: 1,
      passingScore: 700,
      courseId: '507f1f77bcf86cd7994390d1',
      courseName: 'MOS Excel',
      levelId: '507f1f77bcf86cd7994390e1',
      levelTitle: 'Level 1',
    },
    questionSnapshot: snapshot,
    async save() { return this; },
    ...overrides,
  };
  if (!overrides.questionSnapshot) session.questionSnapshot = snapshot;
  return session;
}

function stubFinders(session, questions = [liveQuestion]) {
  const origSession = CertPrepSession.findById;
  const origQuestion = CertPrepQuestion.find;
  const origFind = CertPrepSession.find;
  CertPrepSession.findById = async () => session;
  CertPrepQuestion.find = () => ({
    lean: async () => questions,
  });
  CertPrepSession.find = () => ({
    sort() {
      return { lean: async () => [session] };
    },
  });
  return () => {
    CertPrepSession.findById = origSession;
    CertPrepQuestion.find = origQuestion;
    CertPrepSession.find = origFind;
  };
}

test('SCORE_SCALE is 1000 and used by result scoreMax', () => {
  assert.equal(SCORE_SCALE, 1000);
});

test('submitted owner result contains score/passed/correctCount, not admin metadata', async () => {
  const session = makeSubmitted();
  const restore = stubFinders(session);
  try {
    const out = await getSessionResult(STUDENT_A, SESSION_ID);
    assert.equal(out.score, 1000);
    assert.equal(out.scoreMax, 1000);
    assert.equal(out.passed, true);
    assert.equal(out.correctCount, 1);
    assert.equal(out.answeredCount, 1);
    assert.equal(out.totalQuestions, 1);
    assert.equal(out.passingScore, 700);
    assert.equal(out.questions[0].correctAnswer, 1);
    assert.equal(out.questions[0].explanation, 'Vì B đúng');
    assert.equal(out.questions[0].isCorrect, true);
    assert.equal(out.questions[0].questionImage, '/q.png');
    assert.equal(out.questions[0].options[0].imageUrl, '/a.png');
    const blob = JSON.stringify(out);
    assert.equal(blob.includes('minSelect'), false);
    assert.equal(out.durationSeconds, 720);
    assert.equal(out.test.name, 'MOS Excel L1');
    assert.equal(out.course.name, 'MOS Excel');
    assert.equal(out.level.title, 'Level 1');
  } finally {
    restore();
  }
});

test('result student B → 403 IDOR', async () => {
  const restore = stubFinders(makeSubmitted());
  try {
    await getSessionResult(STUDENT_B, SESSION_ID);
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  } finally {
    restore();
  }
});

test('in_progress result is rejected', async () => {
  const session = makeSubmitted({ status: 'in_progress', score: null, passed: null, submittedAt: null });
  const restore = stubFinders(session);
  try {
    await getSessionResult(STUDENT_A, SESSION_ID);
    assert.fail('expected 409');
  } catch (err) {
    assert.equal(err.status, 409);
    assert.equal(err.message, 'Bạn chưa nộp bài.');
  } finally {
    restore();
  }
});

test('abandoned result is rejected and status is not converted', async () => {
  const session = makeSubmitted({ status: 'abandoned', score: null, passed: null });
  const restore = stubFinders(session);
  try {
    await getSessionResult(STUDENT_A, SESSION_ID);
    assert.fail('expected 409');
  } catch (err) {
    assert.equal(err.status, 409);
    assert.equal(session.status, 'abandoned');
  } finally {
    restore();
  }
});

test('GET session after submit still does not leak score/keys', async () => {
  const session = makeSubmitted();
  const restore = stubFinders(session);
  try {
    const out = await getSession(STUDENT_A, SESSION_ID);
    const blob = JSON.stringify(out);
    assert.equal(out.score, undefined);
    assert.equal(out.passed, undefined);
    assert.equal(blob.includes('correctAnswer'), false);
    assert.equal(blob.includes('Vì B đúng'), false);
  } finally {
    restore();
  }
});

test('historical review uses snapshot, not mutated live question', () => {
  const frozen = freezeQuestion(liveQuestion);
  const session = makeSubmitted({
    questionSnapshot: [frozen],
    score: 1000,
    passed: true,
    correctCount: 1,
  });
  const mutatedLive = {
    ...liveQuestion,
    correctAnswer: 0,
    explanation: 'Admin sửa hôm nay',
    questionText: 'Câu đã bị sửa',
  };
  const fromSnapshot = toStudentResult(session, [frozen]);
  const fromLiveWouldBe = toStudentResult(session, [freezeQuestion(mutatedLive)]);
  assert.equal(fromSnapshot.questions[0].correctAnswer, 1);
  assert.equal(fromSnapshot.questions[0].explanation, 'Vì B đúng');
  assert.equal(fromSnapshot.questions[0].questionText, 'Câu gốc');
  assert.equal(fromSnapshot.score, 1000);
  assert.equal(fromSnapshot.passed, true);
  assert.equal(fromLiveWouldBe.questions[0].correctAnswer, 0);
  assert.notEqual(fromSnapshot.questions[0].correctAnswer, fromLiveWouldBe.questions[0].correctAnswer);
});

test('result does not recompute stored score from current passingScore', () => {
  const session = makeSubmitted({
    score: 650,
    passed: false,
    correctCount: 0,
    configSnapshot: {
      name: 'MOS Excel L1',
      passingScore: 700,
      questionCount: 1,
      timeLimitMinutes: 50,
    },
  });
  const liveConfigWouldPass = { ...session.configSnapshot, passingScore: 600 };
  const out = toStudentResult({ ...session, configSnapshot: liveConfigWouldPass }, session.questionSnapshot);
  assert.equal(out.score, 650);
  assert.equal(out.passed, false);
  assert.equal(out.passingScore, 600);
});

test('review types: single, multiple, matching', () => {
  const questions = [
    freezeQuestion({
      _id: '507f1f77bcf86cd7994390a1',
      type: 'single_choice',
      questionText: 'S',
      options: [{ text: 'A' }, { text: 'B' }],
      correctAnswer: 1,
    }),
    freezeQuestion({
      _id: '507f1f77bcf86cd7994390a2',
      type: 'multiple_choice',
      questionText: 'M',
      options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      correctIndices: [0, 2],
    }),
    freezeQuestion({
      _id: '507f1f77bcf86cd7994390a3',
      type: 'matching',
      questionText: 'K',
      matchingItems: [{ id: 'i1', text: 'Item A' }],
      matchingTargets: [{ id: 't1', text: 'Target 1' }, { id: 't2', text: 'Target 2' }],
      matchingPairs: [{ itemId: 'i1', targetId: 't1' }],
    }),
  ];
  const session = {
    _id: SESSION_ID,
    testId: TEST_ID,
    locale: 'vi',
    status: 'submitted',
    answers: [
      { questionId: '507f1f77bcf86cd7994390a1', value: 0 },
      { questionId: '507f1f77bcf86cd7994390a2', value: [0, 2] },
      { questionId: '507f1f77bcf86cd7994390a3', value: [{ itemId: 'i1', targetId: 't2' }] },
    ],
    score: 333,
    passed: false,
    correctCount: 1,
    answeredCount: 3,
    configSnapshot: { name: 'Mix', passingScore: 700, questionCount: 3, timeLimitMinutes: 50 },
    startedAt: new Date(),
    submittedAt: new Date(),
  };
  const out = toStudentResult(session, questions);
  assert.equal(out.questions[0].isCorrect, false);
  assert.equal(out.questions[0].studentAnswer, 0);
  assert.equal(out.questions[0].correctAnswer, 1);
  assert.equal(out.questions[1].isCorrect, true);
  assert.deepEqual(out.questions[1].correctIndices, [0, 2]);
  assert.equal(out.questions[2].isCorrect, false);
  assert.equal(out.questions[2].matchingPairs[0].targetId, 't1');
  assert.equal(out.questions[2].studentAnswer[0].targetId, 't2');
});

test('attempts list is scoped to authenticated student', async () => {
  const session = makeSubmitted();
  const restore = stubFinders(session);
  try {
    const rows = await listStudentAttempts(STUDENT_A, TEST_ID);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sessionId, SESSION_ID);
    assert.equal(rows[0].attempt, 1);
    assert.equal(rows[0].score, 1000);
    assert.equal(rows[0].passed, true);
  } finally {
    restore();
  }
});

test('attempts student B does not receive student A rows via ownership query', async () => {
  const origFind = CertPrepSession.find;
  let queried = null;
  CertPrepSession.find = (q) => {
    queried = q;
    return { sort() { return { lean: async () => [] }; } };
  };
  try {
    const rows = await listStudentAttempts(STUDENT_B, TEST_ID);
    assert.equal(String(queried.studentId), STUDENT_B);
    assert.equal(rows.length, 0);
  } finally {
    CertPrepSession.find = origFind;
  }
});

test('toStudentSession still omits result secrets before result endpoint', () => {
  const session = makeSubmitted();
  const out = toStudentSession(session, [liveQuestion]);
  const blob = JSON.stringify(out);
  assert.equal(out.score, undefined);
  assert.equal(blob.includes('correctAnswer'), false);
  assert.equal(blob.includes('Vì B đúng'), false);
});

test('submit freeze stores questionSnapshot used by result', async () => {
  const session = {
    _id: SESSION_ID,
    studentId: STUDENT_A,
    testId: TEST_ID,
    locale: 'vi',
    status: 'in_progress',
    questionIds: [QID],
    answers: [{ questionId: QID, value: 1 }],
    startedAt: new Date(Date.now() - 5 * 60 * 1000),
    submittedAt: null,
    score: null,
    passed: null,
    timeSpentSeconds: 0,
    configSnapshot: { name: 'T', timeLimitMinutes: 50, questionCount: 1, passingScore: 700 },
    async save() { return this; },
  };
  const restore = stubFinders(session);
  try {
    await submitSession(STUDENT_A, SESSION_ID);
    assert.equal(session.status, 'submitted');
    assert.ok(Array.isArray(session.questionSnapshot));
    assert.equal(session.questionSnapshot[0].correctAnswer, 1);
    assert.equal(session.correctCount, 1);
    const result = await getSessionResult(STUDENT_A, SESSION_ID);
    session.questionSnapshot[0].correctAnswer = 99;
    liveQuestion.correctAnswer = 0;
    const again = toStudentResult(session, session.questionSnapshot);
    assert.equal(result.questions[0].correctAnswer, 1);
    assert.equal(again.questions[0].correctAnswer, 99);
  } finally {
    liveQuestion.correctAnswer = 1;
    restore();
  }
});
