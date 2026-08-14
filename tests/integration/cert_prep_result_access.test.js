'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const {
  CertPrepError,
  getSessionResult,
  listStudentAttempts,
  toStudentSession,
} = require('../../services/certPrepService');
const CertPrepSession = require('../../models/CertPrepSession');

const STUDENT_A = '507f1f77bcf86cd7994390aa';
const STUDENT_B = '507f1f77bcf86cd7994390bb';
const SESSION_ID = '507f1f77bcf86cd7994390c1';
const TEST_ID = '507f1f77bcf86cd7994390b1';

test('result and attempts routes are student-gated under /api/cert-prep', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  assert.ok(src.includes("router.get('/sessions/:id/result'"));
  assert.ok(src.includes("router.get('/tests/:id/attempts'"));
  assert.ok(src.includes('...requireStudent'));
  assert.equal(src.includes('modules/cert-prep'), false);
});

test('IDOR: student B cannot read student A result', async () => {
  const orig = CertPrepSession.findById;
  CertPrepSession.findById = async () => ({
    _id: SESSION_ID,
    studentId: STUDENT_A,
    status: 'submitted',
  });
  try {
    await getSessionResult(STUDENT_B, SESSION_ID);
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  } finally {
    CertPrepSession.findById = orig;
  }
});

test('IDOR: attempts query always uses authenticated studentId', async () => {
  const orig = CertPrepSession.find;
  let queried = null;
  CertPrepSession.find = (q) => {
    queried = q;
    return { sort() { return { lean: async () => [] }; } };
  };
  try {
    await listStudentAttempts(STUDENT_B, TEST_ID);
    assert.equal(String(queried.studentId), STUDENT_B);
    assert.notEqual(String(queried.studentId), STUDENT_A);
  } finally {
    CertPrepSession.find = orig;
  }
});

test('pre-submit player payload still omits result secrets', () => {
  const session = {
    _id: SESSION_ID,
    testId: TEST_ID,
    locale: 'vi',
    status: 'in_progress',
    answers: [],
    startedAt: new Date(),
    configSnapshot: { name: 'T', timeLimitMinutes: 50, questionCount: 1, passingScore: 700 },
    score: 889,
    passed: true,
  };
  const out = toStudentSession(session, [{
    _id: '507f1f77bcf86cd7994390a1',
    type: 'single_choice',
    questionText: 'Q',
    correctAnswer: 1,
    explanation: 'secret',
  }]);
  const blob = JSON.stringify(out);
  assert.equal(out.score, undefined);
  assert.equal(blob.includes('correctAnswer'), false);
  assert.equal(blob.includes('secret'), false);
});
