const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReceiverMatch, VALID_TYPES } = require('../../services/notificationCenter');

test('buildReceiverMatch: admin gets ALL_ADMIN', () => {
  const { userId, match } = buildReceiverMatch({ id: 'admin', role: 'admin' });
  assert.equal(userId, 'admin');
  const receivers = match.map((m) => m.receivers);
  assert.ok(receivers.includes('admin'));
  assert.ok(receivers.includes('GLOBAL'));
  assert.ok(receivers.includes('ALL_ADMIN'));
});

test('buildReceiverMatch: staff with branch gets branch-scoped admin receivers', () => {
  const { match } = buildReceiverMatch({ id: 's1', role: 'staff', adminRole: 'STAFF', branchId: 'b1' });
  const receivers = match.map((m) => m.receivers);
  assert.ok(receivers.includes('ALL_ADMIN_b1'));
  assert.ok(receivers.includes('ALL_STAFF_b1'));
  assert.ok(!receivers.includes('ALL_ADMIN'), 'branch staff must not receive global ALL_ADMIN');
});

test('buildReceiverMatch: staff without branch gets ALL_ADMIN', () => {
  const { match } = buildReceiverMatch({ id: 's2', role: 'staff', adminRole: 'STAFF' });
  const receivers = match.map((m) => m.receivers);
  assert.ok(receivers.includes('ALL_ADMIN'));
});

test('buildReceiverMatch: teacher gets ALL_TEACHER', () => {
  const { match } = buildReceiverMatch({ id: 't1', role: 'teacher' });
  const receivers = match.map((m) => m.receivers);
  assert.ok(receivers.includes('ALL_TEACHER'));
  assert.ok(!receivers.includes('ALL_ADMIN'));
});

test('VALID_TYPES includes SYSTEM', () => {
  assert.ok(VALID_TYPES.includes('SYSTEM'));
  assert.ok(VALID_TYPES.includes('FINANCE'));
});