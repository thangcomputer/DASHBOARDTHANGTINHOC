const { isMobileMultiSessionAuthEnabled } = require('../config/mobileMultiSessionAuth');
const mobileAuthSessions = require('./mobileAuthSessionService');

async function revokeMobileSessionsForUser({
  userId,
  role,
  reason,
  io,
  enabled = isMobileMultiSessionAuthEnabled(),
  sessionService = mobileAuthSessions,
}) {
  if (!enabled) return { revokedCount: 0, disconnectedSocketRooms: 0 };

  const result = await sessionService.revokeAllSessions({ userId, role, reason });
  let disconnectedSocketRooms = 0;
  if (io && result.sessionIds.length) {
    for (const sessionId of result.sessionIds) {
      io.in(`session:${sessionId}`).disconnectSockets(true);
      disconnectedSocketRooms += 1;
    }
  }

  return {
    revokedCount: result.revokedCount,
    disconnectedSocketRooms,
  };
}

module.exports = { revokeMobileSessionsForUser };
