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

module.exports = {
  getMessagingRole,
  parseDirectConversationTokens,
  isDirectConversationParticipant,
  isAdminLevelMessagingUser,
  canAccessDirectConversation,
};
