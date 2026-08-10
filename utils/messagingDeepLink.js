/**
 * Phase 7 — Frontend deep-link UX gate (NOT authorization).
 * Server MessagingPolicy remains the only send/discover authority.
 *
 * Allow opening a peer in the UI only when:
 * - an existing conversation with that peer is already visible, OR
 * - the peer is present in GET /api/messages/contacts
 *
 * Do not invent a new discoverable contact from navigation state alone.
 */
'use strict';

/**
 * @param {{
 *   peerId: string|number|null|undefined,
 *   contacts?: Array<{ id?: string|number }>,
 *   existingPeerIds?: Array<string|number>,
 * }} args
 * @returns {{ allowed: boolean, mode: 'EXISTING_CONVERSATION'|'AUTHORIZED_CONTACT'|'DENIED', reason?: string }}
 */
function resolveMessagingDeepLink({ peerId, contacts = [], existingPeerIds = [] } = {}) {
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

/**
 * Collect peer ids from conversation list entries (DMs only).
 * @param {Array<{ isGroup?: boolean, user?: { id?: string|number } }>|null|undefined} conversations
 */
function existingPeerIdsFromConversations(conversations) {
  const out = [];
  for (const c of conversations || []) {
    if (!c || c.isGroup) continue;
    if (c.user?.id != null) out.push(String(c.user.id));
  }
  return out;
}

module.exports = {
  resolveMessagingDeepLink,
  existingPeerIdsFromConversations,
};
