const { isMobileMultiSessionAuthEnabled } = require('../config/mobileMultiSessionAuth');
const mobileAuthSessions = require('./mobileAuthSessionService');

async function revokeMobileSessionsForUser({
  userId,
  role,
  reason,
  io,
  excludeSessionId,
  enabled = isMobileMultiSessionAuthEnabled(),
  sessionService = mobileAuthSessions,
}) {
  if (!enabled) return { revokedCount: 0, disconnectedSocketRooms: 0 };

  const revokeOptions = { userId, role, reason };
  if (excludeSessionId) revokeOptions.excludeSessionId = excludeSessionId;
  const result = await sessionService.revokeAllSessions(revokeOptions);
  let disconnectedSocketRooms = 0;
  if (io && result.sessionIds.length) {
    for (const sessionId of result.sessionIds) {
      const sessionRoom = io.in(`session:${sessionId}`);
      sessionRoom.emit('auth:session-replaced', {});
      sessionRoom.disconnectSockets(true);
      disconnectedSocketRooms += 1;
    }
  }

  return {
    revokedCount: result.revokedCount,
    disconnectedSocketRooms,
  };
}

module.exports = { revokeMobileSessionsForUser };
