/**
 * Phase 8.23 — Conversation list ordering helpers (FE only).
 * Newest lastMessageAt / lastTime first. Dedupe by conversationId.
 */

export function conversationActivityTime(conv) {
  const raw = conv?.lastTime ?? conv?.lastMessageAt ?? 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
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
