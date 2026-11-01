const crypto = require('crypto');
const AuthSession = require('../models/AuthSession');

function hashRefreshJti(jti) {
  if (typeof jti !== 'string' || !jti) {
    throw new TypeError('A refresh token jti is required');
  }
  return crypto.createHash('sha256').update(jti, 'utf8').digest('hex');
}

function createMobileAuthSessionService(Model = AuthSession) {
  async function createSession(session) {
    return Model.create(session);
  }

  async function getSession(sessionId) {
    return Model.findOne({ sessionId }).lean();
  }

  async function validateSession({ sessionId, userId, role, now = new Date() }) {
    if (!sessionId || !userId || !['student', 'teacher'].includes(role)) return null;
    return Model.findOne({
      sessionId,
      userId,
      role,
      revokedAt: null,
      absoluteExpiresAt: { $gt: now },
    }).lean();
  }

  async function rotateRefreshToken({
    sessionId,
    userId,
    role,
    currentRefreshJtiHash,
    nextRefreshJtiHash,
    now = new Date(),
  }) {
    if (!sessionId || !userId || !['student', 'teacher'].includes(role)) return false;
    const result = await Model.updateOne({
      sessionId,
      userId,
      role,
      revokedAt: null,
      absoluteExpiresAt: { $gt: now },
      currentRefreshJtiHash,
    }, {
      $set: {
        currentRefreshJtiHash: nextRefreshJtiHash,
        lastUsedAt: now,
      },
    });
    return result.matchedCount === 1;
  }

  async function revokeSession({ sessionId, userId, role, reason = 'user_logout', now = new Date() }) {
    if (!sessionId || !userId || !['student', 'teacher'].includes(role)) return false;
    const result = await Model.updateOne({
      sessionId,
      userId,
      role,
      revokedAt: null,
    }, {
      $set: { revokedAt: now, revocationReason: reason },
    });
    return result.matchedCount === 1;
  }

  async function revokeAllSessions({ userId, role, reason = 'security_event', now = new Date() }) {
    if (!userId || !['student', 'teacher'].includes(role)) {
      return { revokedCount: 0, sessionIds: [] };
    }
    const filter = { userId, revokedAt: null };
    filter.role = role;
    const sessions = await Model.find(filter).select('sessionId').lean();
    const result = await Model.updateMany(filter, {
      $set: { revokedAt: now, revocationReason: reason },
    });
    return {
      revokedCount: result.modifiedCount || 0,
      sessionIds: sessions.map((session) => session.sessionId),
    };
  }

  async function listUserSessions({ userId, role, now = new Date() }) {
    if (!userId || !['student', 'teacher'].includes(role)) return [];
    return Model.find({ userId, role })
      .select('sessionId clientType platform deviceLabel appVersion createdAt lastUsedAt absoluteExpiresAt revokedAt')
      .sort({ lastUsedAt: -1 })
      .lean()
      .then((sessions) => sessions.map((session) => ({
        sessionId: session.sessionId,
        clientType: session.clientType,
        platform: session.platform,
        deviceLabel: session.deviceLabel,
        appVersion: session.appVersion,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        status: session.revokedAt
          ? 'revoked'
          : (new Date(session.absoluteExpiresAt) <= now ? 'expired' : 'active'),
      })));
  }

  async function touchSession({ sessionId, userId, role, now = new Date() }) {
    if (!sessionId || !userId || !['student', 'teacher'].includes(role)) return false;
    const result = await Model.updateOne({
      sessionId,
      userId,
      role,
      revokedAt: null,
      absoluteExpiresAt: { $gt: now },
    }, {
      $set: { lastUsedAt: now },
    });
    return result.matchedCount === 1;
  }

  return {
    createSession,
    getSession,
    validateSession,
    rotateRefreshToken,
    revokeSession,
    revokeAllSessions,
    listUserSessions,
    touchSession,
  };
}

module.exports = {
  ...createMobileAuthSessionService(),
  createMobileAuthSessionService,
  hashRefreshJti,
};
