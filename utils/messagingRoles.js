/**
 * Role dùng cho conversationId + socket online key.
 * Tách khỏi JWT role (staff vẫn login role=admin để vào dashboard).
 */
function getMessagingRole({ id, role, adminRole } = {}) {
  if (String(id) === 'admin') return 'admin';
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
  const myId = String(user.id);
  return tokens.some((t) => String(t.id) === myId && String(t.role) === messagingRole);
}

module.exports = { getMessagingRole, parseDirectConversationTokens, isDirectConversationParticipant };
