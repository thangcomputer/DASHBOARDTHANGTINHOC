/**
 * Role dùng cho conversationId + socket online key.
 * Tách khỏi JWT role (staff vẫn login role=admin để vào dashboard).
 */
function getMessagingRole({ id, role, adminRole } = {}) {
  if (String(id) === 'admin') return 'admin';
  if (adminRole === 'HIGH_ADMIN') return 'admin';
  if (adminRole === 'SUPER_ADMIN') return 'admin';
  if (adminRole === 'SUPPORT') return 'staff';
  if (adminRole === 'STAFF' || role === 'staff') return 'staff';
  if (role === 'teacher' || role === 'student' || role === 'admin') return role;
  return role || 'admin';
}

function parseDirectConversationTokens(conversationId) {
  if (!conversationId || conversationId.startsWith('group_')) return null;
  return conversationId.split('__').map((part) => {
    const idx = part.indexOf('_');
    if (idx === -1) return null;
    return { role: part.slice(0, idx), id: part.slice(idx + 1) };
  }).filter(Boolean);
}

/** Chỉ participant trong conversationId 1-1 mới được đọc (kể cả super admin). */
function isDirectConversationParticipant(conversationId, user) {
  const tokens = parseDirectConversationTokens(conversationId);
  if (!tokens?.length) return false;
  const messagingRole = getMessagingRole(user);
  const myId = String(user.id || user._id || '');
  return tokens.some((t) => String(t.id) === myId && String(t.role) === messagingRole);
}

function isAdminLevelMessagingUser(user = {}) {
  return String(user.id || user._id || '') === 'admin'
    || user.adminRole === 'SUPER_ADMIN'
    || user.adminRole === 'HIGH_ADMIN';
}

/**
 * Access for typing/read/get: exact participant OR legacy shared admin mailbox (SUPER/HIGH only).
 * STAFF/SUPPORT are NOT auto-granted admin_admin.
 */
function canAccessDirectConversation(conversationId, user) {
  if (!user) return false;
  if (String(conversationId || '').startsWith('group_')) return false;
  if (isDirectConversationParticipant(conversationId, user)) return true;
  const tokens = parseDirectConversationTokens(conversationId);
  if (!tokens?.length) return false;
  if (isAdminLevelMessagingUser(user) && tokens.some((t) => t.role === 'admin' && t.id === 'admin')) {
    return true;
  }
  return false;
}

function isLegacyAdminMailboxToken(token) {
  return Boolean(token)
    && String(token.role) === 'admin'
    && String(token.id) === 'admin';
}

/**
 * Socket rooms for private typing/read toward a conversation peer token.
 * Legacy admin_admin peer → root "admin" + ALL_ADMIN (SUPER/HIGH only).
 * NEVER ALL_STAFF / ALL_SUPPORT / ALL_USERS.
 */
function resolveTypingReadPeerRooms(peerToken) {
  if (!peerToken?.id) return [];
  if (isLegacyAdminMailboxToken(peerToken)) {
    return ['admin', 'ALL_ADMIN'];
  }
  return [String(peerToken.id)];
}

/**
 * Peer tokens to notify for typing/read (excludes exact self id match).
 * SUPER/HIGH on admin_admin are not token id "admin", so the admin token remains a delivery target for other admin-level sockets.
 */
function listTypingReadPeerTokens(conversationId, selfUserId) {
  const tokens = parseDirectConversationTokens(conversationId) || [];
  const selfId = String(selfUserId || '');
  return tokens.filter((t) => t?.id && String(t.id) !== selfId);
}

module.exports = {
  getMessagingRole,
  parseDirectConversationTokens,
  isDirectConversationParticipant,
  isAdminLevelMessagingUser,
  canAccessDirectConversation,
  isLegacyAdminMailboxToken,
  resolveTypingReadPeerRooms,
  listTypingReadPeerTokens,
};
