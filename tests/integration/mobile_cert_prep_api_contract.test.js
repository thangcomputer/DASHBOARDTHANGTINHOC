'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const clientApi = fs.readFileSync(
  path.join(__dirname, '../../thang-tin-hoc-mobile/src/services/certPrepApi.ts'),
  'utf8',
);
const backendRoutes = fs.readFileSync(
  path.join(__dirname, '../../routes/certPrepRoutes.js'),
  'utf8',
);
const backendMount = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

test('mobile cert prep requests use the mounted student API routes', () => {
  assert.ok(backendMount.includes("app.use('/api/cert-prep', certPrepRoutes)"));
  assert.ok(backendRoutes.includes("router.get('/my-catalog'"));
  assert.ok(backendRoutes.includes("router.get('/levels/:id/tests'"));
  assert.ok(backendRoutes.includes("router.post('/sessions'"));
  assert.ok(backendRoutes.includes("router.get('/sessions/:id'"));
  assert.ok(backendRoutes.includes("router.patch('/sessions/:id'"));
  assert.ok(backendRoutes.includes("router.post('/sessions/:id/submit'"));
  assert.ok(backendRoutes.includes("router.get('/sessions/:id/result'"));
  assert.ok(clientApi.includes("'/cert-prep/my-catalog'"));
  assert.ok(clientApi.includes('/cert-prep/levels/${encodeURIComponent(levelId)}/tests'));
  assert.equal(clientApi.includes('/cert-prep/student/'), false);
});

test('mobile cert prep unwraps API envelopes and saves answers with backend PATCH payload', () => {
  assert.ok(clientApi.includes("if (!response || !('data' in response))"));
  assert.ok(clientApi.includes("method: 'PATCH'"));
  assert.ok(clientApi.includes('answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value }))'));
});

test('mobile cert prep normalizes backend level, question, session, and result fields', () => {
  assert.ok(clientApi.includes('test.activeSessionId'));
  assert.ok(clientApi.includes('test.submittedCount'));
  assert.ok(clientApi.includes('question.questionText'));
  assert.ok(clientApi.includes('session.remainingSeconds'));
  assert.ok(clientApi.includes('result.totalQuestions'));
  assert.ok(clientApi.includes('result.scoreMax'));
});
