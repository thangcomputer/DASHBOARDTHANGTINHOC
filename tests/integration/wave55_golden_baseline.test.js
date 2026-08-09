/**
 * Wave 5.5 — Golden security baseline registry (no app behavior change).
 * Ensures golden test files exist; documents frozen 58-test suite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GOLDEN_FILES = [
  'wave51_authz_branch.test.js',
  'wave52_realtime_isolation.test.js',
  'wave53_realtime_cleanup.test.js',
  'wave54_exam_assignment_cqrs.test.js',
  'wave_repair_authz.test.js',
  'checkPermission.test.js',
  'auth.test.js',
];

const FREEZE_DOC = path.join(__dirname, '../../docs/SECURITY_CONTRACT_FREEZE.md');

test('GOLDEN: security freeze document exists', () => {
  assert.ok(fs.existsSync(FREEZE_DOC), 'docs/SECURITY_CONTRACT_FREEZE.md missing');
  const text = fs.readFileSync(FREEZE_DOC, 'utf8');
  assert.ok(text.includes('INV-01'));
  assert.ok(text.includes('READY WITH CONDITIONS'));
  assert.ok(text.includes('58/58'));
});

test('GOLDEN: all golden security test files present', () => {
  const dir = __dirname;
  for (const name of GOLDEN_FILES) {
    const full = path.join(dir, name);
    assert.ok(fs.existsSync(full), `missing golden file: ${name}`);
  }
});

test('GOLDEN: CQRS production flags must stay documented as OFF', () => {
  const text = fs.readFileSync(FREEZE_DOC, 'utf8');
  assert.ok(/CQRS production flags:\s*MUST remain OFF/i.test(text) || text.includes('remain OFF'));
  assert.ok(text.includes('ENABLE_CQRS_TEACHER'));
});
