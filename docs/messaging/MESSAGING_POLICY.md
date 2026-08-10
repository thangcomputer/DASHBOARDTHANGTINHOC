# MESSAGING POLICY — Canonical Design Spec (Phase 2)

**Status:** Design only — **DO NOT IMPLEMENT** in this step.  
**Sources of truth for rules:** `services/messagingPairing.js`, `routes/messageRoutes.js` contacts, `docs/messaging/pairing-matrix-824.md`, `docs/messaging/contact-visibility-824b.md`.  
**Non-source:** Frontend `useDataMessaging` / legacy `MessagesContext` (duplicated; must converge to backend).

---

## 1. Actors & dimensions

Every decision function receives:

```text
actor          — authenticated user { id, role, adminRole, branchId, branchCode, … }
actorRole      — productRole(actor)
recipient      — resolved peer document / identity (never trust client role alone)
recipientRole  — productRole(recipient)
tenantId       — reserved; live Message path does not yet enforce tenant on DM
branchId       — from actor/peer docs (branchCode used heavily today)
conversation   — { conversationId, membership/participants, isGroup?, … }
```

Transport role is an **implementation detail** of persistence/routing, not a business permission input.

---

## 2. Decision functions (target API)

### 2.1 `canDiscoverContacts(actor, target)`

**Authority:** `GET /api/messages/contacts` (Phase 8.24B).

Returns whether `target` may appear in actor’s danh bạ.

Notes:

- Discovery is **stricter or differently shaped** than send for some pairs (e.g. STUDENT may be allowed to *send* to elevated admin by pairing, but contacts matrix **does not list SUPER** for student).
- Frontend must not invent additional discoverable peers beyond API (+ optional empty seeds already on API).

### 2.2 `canStartConversation(actor, recipient)`

Equivalent to: discoverable **or** already a participant in an existing conversation **and** `canSendMessage` for first message.

Live code today: start is implicit — first successful `sendCanonicalMessage` creates the thread. Contacts seed empty rows in UI only.

### 2.3 `canViewConversation(actor, conversation)`

Live rules:

- Direct: `canAccessDirectConversation` — exact transport participant tokens **or** SUPER/HIGH on legacy `admin_admin` mailbox.
- Group: membership in `Group.participants` (or elevated admin overrides in some paths).
- REST history/sync: self or `role===admin` (note: JWT `admin` vs product elevated — existing quirk).

### 2.4 `canSendMessage(actor, conversation)` / pair form `canSendMessage(actor, recipient)`

**Authority:** `assertMessagingPairAllowed` → structural allow-list + `assertPairScope`.

Broadcast targets (`ALL_*`) are **not** private send; separate broadcast authorization.

### 2.5 `canReceiveMessage(actor, conversation)`

Actor is the `receiverId` of a private message, or group member in `group_{id}` room, or (legacy) SUPER/HIGH receiving `admin` mailbox delivery via `admin` + `ALL_ADMIN`.

Wrong SUPPORT must not receive another SUPPORT’s private student thread (delivery is user-room based — verified by design; regression tests required).

### 2.6 `canMarkRead(actor, conversation)`

Actor may mark messages where they are the receiver (plus elevated admin mailbox targets). Access gated like view for socket read ack.

### 2.7 `canReceiveNotification(actor, conversation)`

**Current live chat:** realtime Socket only (`message:receive`). No `Notification` document created on DM send.

Until product decides otherwise:

```text
canReceiveNotification := canReceiveMessage && realtime channel available
```

Persistent/email/push = **out of scope** pending Phase 13 decision.

---

## 3. Policy module shape (future implementation)

```text
MessagingPolicy
  resolveActor(actor) → { productRole, transportRole, branchId, tenantId }
  resolveRecipient(receiverId, hint) → peer + roles   // existing resolveCanonicalPeer
  canDiscoverContacts(actor, target)
  canStartConversation(actor, recipient)
  canViewConversation(actor, conversation)
  canSendMessage(actor, recipient | conversation)
  canReceiveMessage(actor, conversation)
  canMarkRead(actor, conversation)
  canReceiveNotification(actor, conversation)
```

Live precursors:

| Concern | Current module |
|---|---|
| Send pair ACL | `services/messagingPairing.js` |
| Thin wrapper | `services/chatAccessService.js` |
| View/typing access | `utils/messagingRoles.js` |
| Discovery | `routes/messageRoutes.js` GET `/contacts` |
| Identity enrichment | `services/messagingIdentity.js` |

**Goal:** one module exports all seven functions; routes/socket call it; FE stops re-implementing.

---

## 4. Scope rules (from live pairing)

| Sender product | Peer | Scope |
|---|---|---|
| SUPER / HIGH | any allowed | none (global) |
| SUPPORT | any structurally allowed | none (global in pairing) |
| STAFF | TEACHER / STUDENT | same branch |
| STAFF | SUPPORT / HIGH / SUPER | allow |
| TEACHER | STUDENT | assigned only |
| TEACHER | STAFF | same branch (empty branch soft-allow) |
| TEACHER | SUPPORT / HIGH / SUPER | allow |
| STUDENT | TEACHER | assigned only |
| STUDENT | STAFF | same branch (empty branch soft-allow) |
| STUDENT | SUPPORT / HIGH / SUPER | allow (send ACL) |
| STUDENT ↔ STUDENT | — | **deny** |
| TEACHER ↔ TEACHER | — | **deny** |

---

## 5. Conflicts requiring business decision

| ID | Conflict | Why |
|---|---|---|
| C1 | STUDENT discover vs send to SUPER | Pairing allows send to elevated; contacts hide SUPER from student |
| C2 | STUDENT discover HIGH | Contacts 8.24B: student list has no HIGH; pairing allows elevated |
| C3 | SUPPORT cross-branch students | Contacts: SUPPORT sees all HV; pairing: SUPPORT unrestricted — confirm intentional |
| C4 | STAFF sees SUPPORT with null branch | Contacts OR includes null branch SUPPORT — confirm |
| C5 | `admin_admin` mailbox vs per-user admin threads | `buildConversationId` special-case vs Phase 8.24 per-peer IDs |
| C6 | JWT `role=admin` without adminRole | Pairing treats as SUPER_ADMIN hint — confirm |
| C7 | Group unread semantics | Global `isRead` vs per-participant need |

Mark in matrix as `CONFLICT — REQUIRES BUSINESS DECISION` where outcomes diverge.

---

## 6. Implementation guardrails (when coding starts)

1. Do not call FE discovery logic for authorization.
2. Do not use role rooms for private `canReceiveMessage` delivery.
3. Do not trust `client.receiverRole` for conversationId (already ignored in pairing).
4. Keep SUPPORT transport as `staff` until Phase 1 map says otherwise.
5. Shadow/Enterprise policy must not become second live ACL without cutover plan.
