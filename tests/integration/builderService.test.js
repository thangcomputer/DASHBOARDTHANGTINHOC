const test = require('node:test');
const assert = require('node:assert/strict');
const formService = require('../../services/formService');
const reportService = require('../../services/reportService');

test('normalizeFields assigns keys', () => {
  const fields = formService.normalizeFields([
    { label: 'Ho ten', type: 'text', required: true },
    { label: 'Tuoi', type: 'number' },
  ]);
  assert.equal(fields.length, 2);
  assert.ok(fields[0].key);
  assert.equal(fields[0].required, true);
});

test('validateAnswers requires fields', () => {
  const form = { fields: [{ key: 'name', label: 'Ten', type: 'text', required: true }] };
  const r = formService.validateAnswers(form, {});
  assert.ok(r.errors.length >= 1);
  const ok = formService.validateAnswers(form, { name: 'An' });
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.answers.name, 'An');
});

test('listSources includes students', () => {
  const s = reportService.listSources();
  assert.ok(s.some((x) => x.key === 'students'));
});

test('rowsToCsv', () => {
  const csv = reportService.rowsToCsv(['a', 'b'], [{ a: 1, b: 'x' }]);
  assert.ok(csv.includes('a,b'));
  assert.ok(csv.includes('"1"'));
});