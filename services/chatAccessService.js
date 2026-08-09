/**
 * Kiem tra quyen nhan tin 1-1 theo ma tran pairing Phase 8.24.
 * Delegates to messagingPairing (product roles + scope). Client receiverRole is hint only.
 */
const { assertMessagingPairAllowed } = require('./messagingPairing');

/**
 * @returns {Promise<{ ok: boolean, message?: string, transportRole?: string, finalReceiverId?: string, peer?: object, productRole?: string }>}
 */
async function assertCanDirectMessage(sender, receiverId, receiverRole) {
  return assertMessagingPairAllowed(sender, receiverId, receiverRole);
}

module.exports = { assertCanDirectMessage };
