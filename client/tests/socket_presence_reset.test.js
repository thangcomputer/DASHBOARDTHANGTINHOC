import assert from 'node:assert/strict';
import test from 'node:test';

function nextPresenceState(event, users) {
  if (event === 'connect' || event === 'connect_error' || event === 'disconnect') return [];
  return users;
}

test('clears stale presence immediately on socket disconnect and reconnect', () => {
  const users = [{ userId: 'teacher-1' }];
  assert.deepEqual(nextPresenceState('disconnect', users), []);
  assert.deepEqual(nextPresenceState('connect_error', users), []);
  assert.deepEqual(nextPresenceState('connect', users), []);
});
