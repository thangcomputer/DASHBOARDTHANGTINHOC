'use strict';

const { getMessagingRole, parseDirectConversationTokens } = require('./messagingRoles');

function resolveCallPeer(user, conversationId, targetId) {
  if (!user || !conversationId || String(conversationId).startsWith('group_')) return null;

  const tokens = parseDirectConversationTokens(String(conversationId));
  if (!tokens || tokens.length !== 2) return null;

  const userId = String(user.id || user._id || '');
  const role = getMessagingRole(user);
  if (!userId || !['student', 'teacher'].includes(role)) return null;

  const self = tokens.find((token) => token.id === userId && token.role === role);
  const peer = tokens.find((token) => token !== self);
  if (!self || !peer || !['student', 'teacher'].includes(peer.role) || peer.role === role) return null;
  if (targetId != null && String(targetId) !== peer.id) return null;

  return peer;
}

module.exports = { resolveCallPeer };
