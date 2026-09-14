/**
 * Phase 8.23 — Conversation list ordering helpers (FE only).
 * Newest lastMessageAt / lastTime first. Dedupe by conversationId.
 */

export function conversationActivityTime(conv) {
  const raw = conv?.lastTime ?? conv?.lastMessageAt ?? null;
  if (raw == null || raw === '') return 0;
  const t = new Date(raw).getTime();
  // Epoch / pre-2000 = placeholder “chưa có tin”, không dùng để xếp thứ tự như hoạt động thật
  if (!Number.isFinite(t) || t < Date.UTC(2000, 0, 1)) return 0;
  return t;
}

export function conversationPeerKey(entry) {
  const user = entry?.user || entry;
  const adminRole = String(user?.adminRole || '').toUpperCase();
  const name = String(user?.name || user?.displayName || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (
    adminRole === 'HIGH_ADMIN'
    && (!name || name === 'high admin' || name === 'admin cấp cao')
  ) {
    return 'admin:high_admin';
  }
  return user?.id == null ? '' : String(user.id);
}

/** Immutable sort: newest activity first. */
export function sortConversationsByLastMessageAt(conversations = []) {
  return [...conversations].sort(
    (a, b) => conversationActivityTime(b) - conversationActivityTime(a),
  );
}

/**
 * Merge conversation entries by canonical conversationId.
 * Newer lastTime wins for activity fields; user profile fields are shallow-merged.
 */
export function mergeConversationsById(entries = []) {
  const byId = new Map();
  for (const c of entries) {
    if (!c?.id && !c?.conversationId) continue;
    const id = String(c.id || c.conversationId);
    const next = { ...c, id };
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, next);
      continue;
    }
    const preferNext = conversationActivityTime(next) >= conversationActivityTime(prev);
    byId.set(id, preferNext
      ? {
          ...prev,
          ...next,
          user: { ...(prev.user || {}), ...(next.user || {}) },
          lastMessage: next.lastMessage ?? prev.lastMessage,
          lastTime: next.lastTime ?? prev.lastTime,
          unread: next.unread ?? prev.unread,
        }
      : {
          ...next,
          ...prev,
          user: { ...(next.user || {}), ...(prev.user || {}) },
          lastMessage: prev.lastMessage ?? next.lastMessage,
          lastTime: prev.lastTime ?? next.lastTime,
          unread: prev.unread ?? next.unread,
        });
  }
  return sortConversationsByLastMessageAt([...byId.values()]);
}

/**
 * Merge legacy direct-message threads that use different conversation IDs
 * for the same peer. Group conversations remain independent.
 */
export function mergeDirectConversationsByPeer(entries = []) {
  const byPeer = new Map();
  const groups = [];

  for (const entry of entries) {
    if (!entry?.isGroup && entry?.user?.id != null) {
      const peerId = conversationPeerKey(entry);
      const previous = byPeer.get(peerId);
      if (!previous) {
        byPeer.set(peerId, entry);
        continue;
      }

      const preferNext = conversationActivityTime(entry) >= conversationActivityTime(previous);
      const newer = preferNext ? entry : previous;
      const older = preferNext ? previous : entry;
      byPeer.set(peerId, {
        ...older,
        ...newer,
        user: { ...(older.user || {}), ...(newer.user || {}) },
        lastMessage: newer.lastMessage ?? older.lastMessage,
        lastTime: newer.lastTime ?? older.lastTime,
        unread: Math.max(Number(older.unread) || 0, Number(newer.unread) || 0),
      });
      continue;
    }
    groups.push(entry);
  }

  return sortConversationsByLastMessageAt([...byPeer.values(), ...groups]);
}
