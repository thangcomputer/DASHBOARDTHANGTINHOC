/**
 * Phase 7 — Frontend deep-link UX gate (NOT authorization).
 * Mirror of utils/messagingDeepLink.js for Vite ESM. Keep logic identical.
 */

export function resolveMessagingDeepLink({ peerId, contacts = [], existingPeerIds = [] } = {}) {
  const id = peerId != null ? String(peerId) : '';
  if (!id) {
    return { allowed: false, mode: 'DENIED', reason: 'MISSING_PEER' };
  }

  const existing = new Set((existingPeerIds || []).map((x) => String(x)));
  if (existing.has(id)) {
    return { allowed: true, mode: 'EXISTING_CONVERSATION' };
  }

  const inContacts = (contacts || []).some((c) => c && String(c.id) === id);
  if (inContacts) {
    return { allowed: true, mode: 'AUTHORIZED_CONTACT' };
  }

  return { allowed: false, mode: 'DENIED', reason: 'NOT_IN_CONTACTS_AND_NO_EXISTING' };
}

export function existingPeerIdsFromConversations(conversations) {
  const out = [];
  for (const c of conversations || []) {
    if (!c || c.isGroup) continue;
    if (c.user?.id != null) out.push(String(c.user.id));
  }
  return out;
}
