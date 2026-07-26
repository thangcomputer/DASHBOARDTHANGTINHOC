const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.AI_API_KEY;
delete process.env.OPENAI_API_KEY;
process.env.AI_ENABLED = '1';

const aiService = require('../../services/aiService');

test('status reports not configured without key', () => {
  const s = aiService.getStatus();
  assert.equal(s.configured, false);
  assert.ok(s.features.includes('quiz'));
});

test('generateQuiz fallback returns questions', async () => {
  const r = await aiService.generateQuiz({ topic: 'Excel', count: 3, subject: 'Tin hoc' });
  assert.equal(r.source, 'fallback');
  assert.equal(r.questions.length, 3);
  assert.ok(r.questions[0].options.length >= 2);
});

test('draftNotification fallback', async () => {
  const r = await aiService.draftNotification({ purpose: 'Nhac dong hoc phi', audience: 'HV' });
  assert.equal(r.source, 'fallback');
  assert.ok(r.title);
  assert.ok(r.content);
});

test('summarize fallback truncates', async () => {
  const r = await aiService.summarizeText({ text: 'mot hai ba bon nam sau bay' });
  assert.equal(r.source, 'fallback');
  assert.ok(r.summary.length > 0);
});