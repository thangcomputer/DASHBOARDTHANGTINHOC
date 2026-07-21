const test = require('node:test');
const assert = require('node:assert/strict');
const workflowService = require('../../services/workflowService');

test('listDefinitions has teacher_approval', () => {
  const defs = workflowService.listDefinitions();
  assert.ok(defs.some((d) => d.key === 'teacher_approval'));
  assert.ok(defs.some((d) => d.key === 'exam_unlock'));
  assert.ok(defs.some((d) => d.key === 'payout_request'));
});

test('getDefinition unknown is null', () => {
  assert.equal(workflowService.getDefinition('nope'), null);
});