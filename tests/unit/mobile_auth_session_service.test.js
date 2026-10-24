const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  createMobileAuthSessionService,
  hashRefreshJti,
} = require('../../services/mobileAuthSessionService');

function makeQuery(value) {
  return {
    select() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(value); },
  };
}

function makeFakeModel(initial = []) {
  const sessions = initial.map((session) => ({ ...session }));
  return {
    sessions,
    async create(session) {
      sessions.push({ ...session });
      return session;
    },
    findOne(filter) {
      return makeQuery(sessions.find((session) => (
        Object.entries(filter).every(([key, value]) => {
          if (key === 'absoluteExpiresAt') return session.absoluteExpiresAt > value.$gt;
          return session[key] === value;
        })
      )) || null);
    },
    find(filter) {
      return makeQuery(sessions.filter((session) => (
        Object.entries(filter).every(([key, value]) => session[key] === value)
      )));
    },
    async updateOne(filter, update) {
      const session = sessions.find((candidate) => (
        Object.entries(filter).every(([key, value]) => {
          if (key === 'absoluteExpiresAt') return candidate.absoluteExpiresAt > value.$gt;
          return candidate[key] === value;
        })
      ));
      if (!session) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(session, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) {
      const matched = sessions.filter((session) => (
        Object.entries(filter).every(([key, value]) => session[key] === value)
      ));
      for (const session of matched) Object.assign(session, update.$set);
      return { matchedCount: matched.length, modifiedCount: matched.length };
    },
  };
}

const future = new Date(Date.now() + 60_000);
const makeSession = (overrides = {}) => ({
  sessionId: crypto.randomUUID(),
  userId: 'student-a',
  role: 'student',
  clientType: 'mobile',
  platform: 'android',
  deviceLabel: 'Test device',
  appVersion: '1.0.0',
  createdAt: new Date(),
  lastUsedAt: new Date(),
  absoluteExpiresAt: future,
  revokedAt: null,
  revocationReason: '',
  refreshFamilyId: crypto.randomUUID(),
  currentRefreshJtiHash: hashRefreshJti('current-jti'),
  ...overrides,
});

test('hashRefreshJti hashes the identifier and rejects empty input', () => {
  assert.equal(hashRefreshJti('identifier'), crypto.createHash('sha256').update('identifier').digest('hex'));
  assert.notEqual(hashRefreshJti('identifier'), 'identifier');
  assert.throws(() => hashRefreshJti(''), TypeError);
});

test('validateSession rejects invalid roles, wrong owners, revoked and expired sessions', async () => {
  const active = makeSession();
  const revoked = makeSession({ sessionId: 'revoked', revokedAt: new Date() });
  const expired = makeSession({ sessionId: 'expired', absoluteExpiresAt: new Date(Date.now() - 1000) });
  const service = createMobileAuthSessionService(makeFakeModel([active, revoked, expired]));

  assert.equal((await service.validateSession({
    sessionId: active.sessionId, userId: active.userId, role: active.role,
  })).sessionId, active.sessionId);
  assert.equal(await service.validateSession({
    sessionId: active.sessionId, userId: 'other-user', role: active.role,
  }), null);
  assert.equal(await service.validateSession({
    sessionId: active.sessionId, userId: active.userId, role: 'admin',
  }), null);
  assert.equal(await service.validateSession({
    sessionId: revoked.sessionId, userId: revoked.userId, role: revoked.role,
  }), null);
  assert.equal(await service.validateSession({
    sessionId: expired.sessionId, userId: expired.userId, role: expired.role,
  }), null);
});

test('rotateRefreshToken is an atomic compare-and-swap with one concurrent winner', async () => {
  const session = makeSession();
  const model = makeFakeModel([session]);
  const service = createMobileAuthSessionService(model);
  const args = {
    sessionId: session.sessionId,
    userId: session.userId,
    role: session.role,
    currentRefreshJtiHash: session.currentRefreshJtiHash,
    nextRefreshJtiHash: hashRefreshJti('next-jti'),
    nextExpiresAt: future,
  };

  const results = await Promise.all([
    service.rotateRefreshToken(args),
    service.rotateRefreshToken(args),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(model.sessions[0].currentRefreshJtiHash, args.nextRefreshJtiHash);
});

test('rotating one device does not change another device refresh state', async () => {
  const android = makeSession({ platform: 'android', currentRefreshJtiHash: hashRefreshJti('android-jti') });
  const ios = makeSession({
    userId: android.userId,
    platform: 'ios',
    currentRefreshJtiHash: hashRefreshJti('ios-jti'),
  });
  const model = makeFakeModel([android, ios]);
  const service = createMobileAuthSessionService(model);

  const rotated = await service.rotateRefreshToken({
    sessionId: android.sessionId,
    userId: android.userId,
    role: android.role,
    currentRefreshJtiHash: android.currentRefreshJtiHash,
    nextRefreshJtiHash: hashRefreshJti('android-next'),
  });

  assert.equal(rotated, true);
  assert.equal(model.sessions[0].currentRefreshJtiHash, hashRefreshJti('android-next'));
  assert.equal(model.sessions[1].currentRefreshJtiHash, hashRefreshJti('ios-jti'));
});

test('revokeSession enforces owner and role and listUserSessions omits security material', async () => {
  const session = makeSession();
  const service = createMobileAuthSessionService(makeFakeModel([session]));

  assert.equal(await service.revokeSession({
    sessionId: session.sessionId, userId: 'another-user', role: 'student',
  }), false);
  assert.equal(await service.revokeSession({
    sessionId: session.sessionId, userId: session.userId, role: session.role,
  }), true);

  const listed = await service.listUserSessions({ userId: session.userId, role: session.role });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].status, 'revoked');
  assert.equal(Object.hasOwn(listed[0], 'currentRefreshJtiHash'), false);
  assert.equal(Object.hasOwn(listed[0], 'refreshFamilyId'), false);
});

test('revokeAllSessions only affects active sessions belonging to the selected user', async () => {
  const owned = makeSession();
  const other = makeSession({ userId: 'student-b' });
  const alreadyRevoked = makeSession({ revokedAt: new Date() });
  const model = makeFakeModel([owned, other, alreadyRevoked]);
  const service = createMobileAuthSessionService(model);

  const result = await service.revokeAllSessions({ userId: owned.userId, role: owned.role });
  assert.equal(result.revokedCount, 1);
  assert.deepEqual(result.sessionIds, [owned.sessionId]);
  assert.ok(model.sessions[0].revokedAt);
  assert.equal(model.sessions[1].revokedAt, null);
  assert.ok(model.sessions[2].revokedAt);
});
