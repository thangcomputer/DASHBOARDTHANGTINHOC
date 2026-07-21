const test = require('node:test');
const assert = require('node:assert/strict');
const tenantService = require('../../services/tenantService');

test('DEFAULT_CODE is MAIN', () => {
  assert.equal(tenantService.DEFAULT_CODE, 'MAIN');
});