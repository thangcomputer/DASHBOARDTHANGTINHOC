/**
 * Phase 2 — password provision helpers (không cần Mongo).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generatePassword,
  resolvePassword,
  MIN_LEN,
} = require('../../services/passwordProvisionService');
const { redact } = require('../../services/auditLogService');

test('generatePassword length and charset', () => {
  const pw = generatePassword(8);
  assert.equal(pw.length, 8);
  assert.match(pw, /^[A-Za-z0-9]+$/);
});

test('resolvePassword auto ignores empty manual', () => {
  const r = resolvePassword('auto');
  assert.equal(r.mode, 'auto');
  assert.equal(r.password.length, 8);
});

test('resolvePassword manual validates min length', () => {
  assert.throws(() => resolvePassword('manual', '123'), /ít nhất/);
  const r = resolvePassword('manual', 'abcdef');
  assert.equal(r.mode, 'manual');
  assert.equal(r.password, 'abcdef');
});

test('MIN_LEN is 6', () => {
  assert.equal(MIN_LEN, 6);
});

test('provision audit payload would redact password', () => {
  const out = redact({ mode: 'auto', password: 'Secret99', isFirstLogin: true });
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.mode, 'auto');
});

test('PasswordProvisionLog model loads', () => {
  const PasswordProvisionLog = require('../../models/PasswordProvisionLog');
  assert.equal(PasswordProvisionLog.modelName, 'PasswordProvisionLog');
  assert.ok(PasswordProvisionLog.schema.paths.mode);
  assert.ok(!PasswordProvisionLog.schema.paths.password);
});
