const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { assertTestDatabaseEnvironment } = require('../setup/testDatabaseGuard');
const AuthSession = require('../../models/AuthSession');
const {
  createMobileAuthSessionService,
  hashRefreshJti,
} = require('../../services/mobileAuthSessionService');

test('MongoDB session persistence enforces indexes, ownership, expiry and refresh CAS', async () => {
  const target = assertTestDatabaseEnvironment(process.env);
  const uri = new URL(target.uri);
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(target.hostname, '127.0.0.1', 'Mongo integration must bind to loopback');
  assert.equal(uri.port, '27019', 'Mongo integration must use the dedicated test port');
  assert.equal(target.dbName, 'dashboardthangtinhoc_mobile_auth_test');

  const redisUrl = new URL(String(process.env.REDIS_URL || ''));
  assert.equal(redisUrl.protocol, 'redis:');
  assert.equal(redisUrl.hostname, '127.0.0.1', 'Redis tests must bind to loopback');
  assert.equal(redisUrl.port, '6382', 'Redis tests must use the dedicated test port');

  const sessionId = `mobile-test-${new mongoose.Types.ObjectId()}`;
  const sessionIds = [sessionId];
  const userId = new mongoose.Types.ObjectId();
  let connected = false;

  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 3000 });
    connected = true;
    await AuthSession.createIndexes();

    const indexes = await AuthSession.collection.indexes();
    assert.ok(indexes.some((index) => index.name === 'sessionId_1' && index.unique));
    assert.ok(indexes.some((index) => (
      index.key.userId === 1
      && index.key.role === 1
      && index.key.revokedAt === 1
      && index.key.lastUsedAt === -1
    )));
    assert.ok(indexes.some((index) => (
      index.key.absoluteExpiresAt === 1 && index.expireAfterSeconds === 0
    )));

    const currentJtiHash = hashRefreshJti('initial-refresh-jti');
    const session = await AuthSession.create({
      sessionId,
      userId,
      role: 'student',
      clientType: 'mobile',
      platform: 'android',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      absoluteExpiresAt: new Date(Date.now() + 60_000),
      refreshFamilyId: new mongoose.Types.ObjectId().toString(),
      currentRefreshJtiHash: currentJtiHash,
    });

    await assert.rejects(
      AuthSession.create({
        ...session.toObject(),
        _id: new mongoose.Types.ObjectId(),
      }),
      (error) => error?.code === 11000,
    );

    const service = createMobileAuthSessionService(AuthSession);
    assert.equal((await service.validateSession({
      sessionId, userId: userId.toString(), role: 'student',
    })).sessionId, sessionId);
    assert.equal(await service.validateSession({
      sessionId, userId: new mongoose.Types.ObjectId().toString(), role: 'student',
    }), null);

    const nextJtiHash = hashRefreshJti('rotated-refresh-jti');
    const rotations = await Promise.all([
      service.rotateRefreshToken({
        sessionId,
        userId: userId.toString(),
        role: 'student',
        currentRefreshJtiHash: currentJtiHash,
        nextRefreshJtiHash: nextJtiHash,
      }),
      service.rotateRefreshToken({
        sessionId,
        userId: userId.toString(),
        role: 'student',
        currentRefreshJtiHash: currentJtiHash,
        nextRefreshJtiHash: hashRefreshJti('racing-refresh-jti'),
      }),
    ]);
    assert.equal(rotations.filter(Boolean).length, 1);

    const rotatedJtiHash = (await service.getSession(sessionId)).currentRefreshJtiHash;
    const beyondExpiry = new Date(Date.now() + 120_000);
    assert.equal(await service.validateSession({
      sessionId,
      userId: userId.toString(),
      role: 'student',
      now: beyondExpiry,
    }), null);
    assert.equal(await service.rotateRefreshToken({
      sessionId,
      userId: userId.toString(),
      role: 'student',
      currentRefreshJtiHash: rotatedJtiHash,
      nextRefreshJtiHash: hashRefreshJti('expired-refresh-jti'),
      now: beyondExpiry,
    }), false);
    const expiredInListing = await service.listUserSessions({
      userId: userId.toString(),
      role: 'student',
      now: beyondExpiry,
    });
    assert.equal(expiredInListing[0].status, 'expired');

    const revoked = await service.revokeAllSessions({
      userId: userId.toString(),
      role: 'student',
      reason: 'integration_test',
    });
    assert.equal(revoked.revokedCount, 1);
    assert.deepEqual(revoked.sessionIds, [sessionId]);
    assert.equal(await service.validateSession({
      sessionId, userId: userId.toString(), role: 'student',
    }), null);
  } finally {
    if (connected) {
      await AuthSession.deleteMany({ sessionId: { $in: sessionIds } });
      await mongoose.disconnect();
    }
  }
});
