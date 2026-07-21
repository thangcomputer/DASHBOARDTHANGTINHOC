const test = require('node:test');
const assert = require('node:assert/strict');
const backupService = require('../../services/backupService');

test('formatBytes and keepCount', () => {
  assert.ok(backupService.formatBytes(2048).includes('KB'));
  assert.ok(backupService.keepCount() >= 1);
});

test('BACKUP_VERSION is 1', () => {
  assert.equal(backupService.BACKUP_VERSION, 1);
});