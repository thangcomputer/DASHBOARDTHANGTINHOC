const test = require('node:test');
const assert = require('node:assert/strict');
const fileService = require('../../services/fileService');

test('getCategoryConfig: messages has retention', () => {
  const cfg = fileService.getCategoryConfig('messages');
  assert.equal(cfg.key, 'messages');
  assert.ok(cfg.maxBytes > 0);
  assert.ok(cfg.exts.includes('.pdf'));
  assert.equal(typeof cfg.retentionDays, 'function');
});

test('getCategoryConfig: invalid returns null', () => {
  assert.equal(fileService.getCategoryConfig('nope'), null);
});

test('formatBytes', () => {
  assert.equal(fileService.formatBytes(500), '500 B');
  assert.ok(fileService.formatBytes(2048).includes('KB'));
  assert.ok(fileService.formatBytes(2 * 1024 * 1024).includes('MB'));
});

test('expiresAtFor messages is in the future', () => {
  const d = fileService.expiresAtFor('messages');
  assert.ok(d instanceof Date);
  assert.ok(d.getTime() > Date.now());
});

test('expiresAtFor general is null', () => {
  assert.equal(fileService.expiresAtFor('general'), null);
});