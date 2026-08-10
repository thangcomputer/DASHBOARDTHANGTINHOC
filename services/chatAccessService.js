/**
 * Compatibility wrapper — LIVE messaging ACL.
 * CANONICAL authority: services/messagingPolicy.js
 * Delegates send checks to MessagingPolicy (which uses messagingPairing).
 */
'use strict';

const {
  assertCanDirectMessage: policyAssertCanDirectMessage,
  canSendMessage,
  canDiscoverContacts,
  canViewConversation,
  canMarkRead,
  resolveCanonicalRecipient,
} = require('./messagingPolicy');

/**
 * @returns {Promise<{ ok: boolean, message?: string, transportRole?: string, finalReceiverId?: string, peer?: object, productRole?: string, code?: string }>}
 */
async function assertCanDirectMessage(sender, receiverId, receiverRole) {
  return policyAssertCanDirectMessage(sender, receiverId, receiverRole);
}

module.exports = {
  assertCanDirectMessage,
  canSendMessage,
  canDiscoverContacts,
  canViewConversation,
  canMarkRead,
  resolveCanonicalRecipient,
};
