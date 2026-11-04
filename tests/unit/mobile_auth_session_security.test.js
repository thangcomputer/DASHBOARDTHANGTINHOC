const test = require('node:test');
const assert = require('node:assert/strict');
const { revokeMobileSessionsForUser } = require('../../services/mobileAuthSessionSecurity');

test('mobile session revocation is skipped while the feature flag is disabled', async () => {
  let calls = 0;
  const result = await revokeMobileSessionsForUser({
    userId: 'student-a',
    role: 'student',
    reason: 'password_changed',
    enabled: false,
    sessionService: {
      async revokeAllSessions() {
        calls += 1;
        return { revokedCount: 0, sessionIds: [] };
      },
    },
  });

  assert.deepEqual(result, { revokedCount: 0, disconnectedSocketRooms: 0 });
  assert.equal(calls, 0);
});

test('revocation notifies and disconnects each revoked mobile session room', async () => {
  const disconnectedRooms = [];
  const notifiedRooms = [];
  const result = await revokeMobileSessionsForUser({
    userId: 'student-a',
    role: 'student',
    reason: 'password_changed',
    enabled: true,
    sessionService: {
      async revokeAllSessions(args) {
        assert.deepEqual(args, {
          userId: 'student-a',
          role: 'student',
          reason: 'password_changed',
        });
        return { revokedCount: 2, sessionIds: ['session-a', 'session-b'] };
      },
    },
    io: {
      in(room) {
        return {
          emit(event) {
            assert.equal(event, 'auth:session-replaced');
            notifiedRooms.push(room);
          },
          disconnectSockets(force) {
            assert.equal(force, true);
            disconnectedRooms.push(room);
          },
        };
      },
    },
  });

  assert.deepEqual(result, { revokedCount: 2, disconnectedSocketRooms: 2 });
  assert.deepEqual(disconnectedRooms, ['session:session-a', 'session:session-b']);
  assert.deepEqual(notifiedRooms, disconnectedRooms);
});

test('revocation failures remain visible to the caller', async () => {
  const failure = new Error('test database unavailable');
  await assert.rejects(
    revokeMobileSessionsForUser({
      userId: 'student-a',
      role: 'student',
      reason: 'password_changed',
      enabled: true,
      sessionService: {
        async revokeAllSessions() {
          throw failure;
        },
      },
    }),
    failure,
  );
});
