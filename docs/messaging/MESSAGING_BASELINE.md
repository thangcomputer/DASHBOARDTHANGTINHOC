# MESSAGING BASELINE — Phase 0 Freeze

**Status:** READ-ONLY snapshot (no code changes in this phase)  
**Date:** 2026-08-10  
**Authorities:** Phase 8.21–8.24B code + tests; `pairing-matrix-824.md`; `contact-visibility-824b.md`

---

## 0. Safety snapshot (pre-doc)

| Check | Result |
|---|---|
| `git status` | Dirty tree exists (Redis/cache/RBAC artifacts, deploy scripts) — **unrelated to messaging**. Do not mix into messaging commits. |
| Code modified this phase | **None** |
| Focused messaging tests | See §8 |

---

## 1. Current flows

### 1.1 Private DM (canonical)

```text
actor (JWT)
  → assertMessagingPairAllowed (product role + branch/assignment scope)
  → buildCanonicalConversationId (transport roles; ignore wrong client receiverRole)
  → Message.create
  → ConversationVisibility unhide participants
  → enrichMessageIdentities
  → notifyUser(receiverRole, receiverId, 'message:receive')
  → notifyUser(senderRole, senderId, 'message:sent')  [socket path also emits message:sent to sender socket]
```

**Entry points (both converge):**

| Path | Handler |
|---|---|
| `POST /api/messages` | `routes/messageRoutes.js` → `sendCanonicalMessage` |
| Socket `message:send` (non-broadcast) | `server.js` → `sendCanonicalMessage` |

**File:** `services/directMessageService.js`

### 1.2 Broadcast / role-room (separate from private DM)

| Path | Behavior |
|---|---|
| Socket `message:send` with `ALL_USERS` / `ALL_STUDENTS` / `ALL_TEACHERS` / `ALL_BRANCH_*` | Admin-only; emits to role/branch rooms; **does not** call `sendCanonicalMessage` |
| `POST /api/messages/broadcast` | Fan-out persisted 1:1 messages to many targets (admin/staff) |

Private DM must **not** use `ALL_STAFF` / `ALL_SUPPORT` / `ALL_TEACHER` / `ALL_STUDENT` for delivery. Current `app.notifyUser` documents and enforces this for `userId === 'admin'` (uses `admin` + `ALL_ADMIN` only).

### 1.3 Contact discovery

```text
GET /api/messages/contacts
  → role-specific Mongo queries (Phase 8.24B matrix)
  → returns contacts[] with id, name, role, adminRole, productRole, branchId, branchCode, …
```

Frontend `Inbox.jsx` loads this API.  
Frontend `useDataMessaging.getConversations` **also** seeds contacts from local `students`/`teachers`/`staffs` caches (duplicated policy).

### 1.4 Inbox / conversation list

| Layer | Behavior |
|---|---|
| Backend `GET /api/messages/conversations/:userId` | Aggregates `Message` by `conversationId`, sorts by `lastMessage.createdAt` DESC, computes `unreadCount` via `Message.isRead` |
| Frontend Inbox | Merges API contacts + `getConversations()` activity from **message cache** + `lastTime`; `mergeConversationsById` / `sortConversationsByLastMessageAt` |

### 1.5 Read / typing

| Event | Auth | Delivery |
|---|---|---|
| REST `PUT /api/messages/read/:conversationId` | Participant (+ legacy admin mailbox for SUPER/HIGH) | Sets `Message.isRead=true` for matching rows |
| Socket `message:read` | `canAccessDirectConversation` | Peer user rooms / legacy `admin`+`ALL_ADMIN` |
| Socket `typing:start` / `typing:stop` | Same access check | Same peer rooms → `typing:show` / `typing:hide` |

---

## 2. Current role mapping

### 2.1 Product roles (pairing / contacts)

Defined in `services/messagingPairing.js` as:

```text
SUPER_ADMIN | HIGH_ADMIN | STAFF | SUPPORT | TEACHER | STUDENT
```

Resolved from JWT/`Teacher`/`Student` via `id`, `role`, `adminRole`.

### 2.2 Transport roles (`messagingRole` / conversationId tokens)

From `utils/messagingRoles.getMessagingRole` (mirrored in `client/src/lib/messagingRoles.js`):

| Product / adminRole | Transport |
|---|---|
| `id=admin`, SUPER_ADMIN, HIGH_ADMIN | `admin` |
| STAFF | `staff` |
| **SUPPORT** | **`staff`** (shared with STAFF) |
| TEACHER | `teacher` |
| STUDENT | `student` |

**Architectural fact (frozen):** SUPPORT and STAFF share transport identity `staff`. Student → Support is transported as `staff`. Distinguisher is `adminRole` / `displayRole` / `productRole` on identity payloads — **not** a separate `support` transport token.

### 2.3 Display roles (Phase 8.21/8.22)

`services/messagingIdentity.js`: `SUPER_ADMIN | HIGH_ADMIN | ADMIN_STAFF | SUPPORT | TEACHER | STUDENT | LEGACY_ROOT | UNKNOWN`  
Never elevate to SUPER by transport role alone.

---

## 3. Current rooms

| Room | Joined when | Purpose |
|---|---|---|
| `{userId}` | `register` | **Canonical private delivery** (`notifyUser` fallback / primary) |
| `ALL_{TRANSPORT}` e.g. `ALL_STAFF`, `ALL_TEACHER` | `register` via transport | Presence / broadcast / lastSeen |
| `ALL_STAFF` | STAFF adminRole **or** transport `staff` | **SUPPORT also joins** because transport is `staff` |
| `ALL_SUPPORT` | `adminRole === 'SUPPORT'` (or transport `support` — currently unused) | Support-scoped broadcast/presence |
| `ALL_ADMIN` | SUPER / HIGH / legacy root | Elevated admin fan-out |
| `ALL_*_{branchId\|branchCode}` | Has branch | Branch-scoped broadcasts |
| `presence_{branchId}` / `presence_none` | Branch | Scoped online list |
| `branch_{branchId}` | Branch | Branch system events |
| `group_{groupId}` | `group:join` after membership check | Group chat |
| `teacher_{id}` / `student_{id}` / `admin_room` / `feed_room` | Explicit joins | Non-DM features |

**Private DM delivery target:** user-specific room (`userId`) and/or presence socket lookup — **not** role broadcast rooms.

---

## 4. Current Socket.IO event contracts

| Event | Direction | Classification | Notes |
|---|---|---|---|
| `register` | C→S | PRESENCE | Joins rooms from JWT |
| `users:online` | S→C | PRESENCE | Role/branch scoped |
| `users:lastSeen` | S→C | PRESENCE | On disconnect to role rooms |
| `message:send` | C→S | PRIVATE_DM **or** SYSTEM_BROADCAST | Branch: if `ALL_*` → broadcast; else → `sendCanonicalMessage` |
| `message:receive` | S→C | PRIVATE_DM / CONVERSATION / BROADCAST | Same event name; room decides scope |
| `message:sent` | S→C | PRIVATE_DM ack | Sender confirmation |
| `message:read` | C→S | READ_EVENT | |
| `message:read_ack` | S→C | READ_EVENT | Peer notify |
| `typing:start` / `typing:stop` | C→S | TYPING_EVENT | |
| `typing:show` / `typing:hide` | S→C | TYPING_EVENT | |
| `group:join` | C→S | CONVERSATION | Membership-gated |
| `join` | C→S | rejected for privileged rooms | Deny GLOBAL / ALL_ / branch_ / presence_ spoof |

---

## 5. Current HTTP API contracts

Mounted at **`/api/messages`** (`server.js`). Comments sometimes say `/api/chat/*`; live path is `/api/messages/*`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/contacts` | Contact discovery authority (8.24B) |
| GET | `/conversations/:userId` | Conversation list from Message aggregate |
| GET | `/search/:userId` | Content search |
| GET | `/hidden` | Hidden conversations |
| GET | `/:conversationId` | History |
| GET | `/sync/:userId` | Sync |
| POST | `/upload` | File upload |
| POST | `/` | Send DM → `sendCanonicalMessage` |
| POST | `/hide/:conversationId` | Hide |
| PUT | `/read/:conversationId` | Mark read |
| PATCH | `/:messageId/reaction` | Reactions |
| PATCH | `/:messageId/recall` | Recall |
| PATCH | `/:messageId/soft-delete` | Soft delete |
| POST | `/groups` | Create group |
| GET | `/groups/user/:userId` | List groups |
| DELETE | `/groups/:groupId` | Delete group |
| GET | `/unread/:userId` | Global unread count |
| POST | `/broadcast` | Bulk send |

---

## 6. Current Message schema

**File:** `models/Message.js`

Key fields:

- `conversationId` (string, indexed) — format `role1_id1__role2_id2` (sorted) or `group_{id}`
- `senderId`, `senderName`, `senderRole` ∈ `admin|teacher|student|staff`
- `receiverId`, `receiverName`, `receiverRole` ∈ `admin|teacher|student|staff|system`
- `senderBranchCode`, `receiverBranchCode`
- `content`, `messageType`, file fields
- **`isRead`**, **`readAt`** — **global per message** (not per participant)
- `isRecalled`, `groupId`, `isGroup`, `reactions`, `hiddenFor`
- timestamps

**No** `tenantId`, **no** `participants[]`, **no** per-user read cursor on Message.

---

## 7. Current “Conversation” schema

**There is no first-class `Conversation` document for DMs.**

Related models:

| Model | Role |
|---|---|
| `ConversationVisibility` | `{ conversationId, hiddenByUsers[] }` only |
| `Group` | Multi-party: `participants[]`, `lastMessage { content, senderName, sentAt }` |
| Implicit DM conversation | Derived from `Message.conversationId` + last message aggregate |

Target Conversation shape (participants, lastMessageAt, status) is **not** implemented for DMs yet.

---

## 8. Current frontend messaging state

| Module | Status |
|---|---|
| `useDataMessaging` via `DataContext` | **Live** — message cache, send/sync, `getConversations` with local discovery seeds + `lastTime` ordering |
| `Inbox.jsx` | **Live** — loads `/messages/contacts`, merges with activity, tabs Admin/Staff/Support/… |
| `FloatingMessenger.jsx` | Uses `getConversations` from DataContext |
| `client/src/lib/messagingRoles.js` | Transport role mirror |
| `client/src/lib/messagingIdentity.js` | Display identity resolution |
| `client/src/lib/conversationList.js` | `lastTime` / `lastMessageAt` sort + merge |
| `MessagesContext.jsx` | **Not mounted in App** — DataContext comment: avoid double socket/SWR. Still present; hardening tests still read its source. |

---

## 9. Known bugs / debt (frozen list)

1. **SUPPORT transport = `staff`** — intentional compatibility; SUPPORT also joins `ALL_STAFF` on register → broadcast/presence coupling risk if misused for DM (DM path itself avoids role rooms).
2. **Dual contact policy** — backend `/contacts` vs `useDataMessaging` local seeding (frontend may over-seed vs API).
3. **Inbox ordering** — UI primarily from message cache `lastTime`, not solely from Conversation aggregate API.
4. **Unread model** — `Message.isRead` cannot express independent read state per group participant.
5. **`buildConversationId` legacy** — still special-cases student↔`admin` role into shared `admin_admin` mailbox (`utils/chatConversationId.js`), while pairing/contacts push per-user HIGH/SUPER threads — **potential ID conflict surface**.
6. **Stale static tests** — `messaging_hardening` expects `assertCanDirectMessage` string inside `directMessageService` but live code calls `assertMessagingPairAllowed` (pairing). `wave69_*` similar drift.
7. **`tests/messaging-isolation.test.js`** — fails with 401 (auth/env), not a proven DM logic regression.
8. **Legacy `MessagesContext`** — unused at runtime but not proven dead for all import graphs; do not delete until separate proof phase.
9. **No Notification document** on live chat send path — realtime only via Socket.
10. **Policy shadow / Enterprise chat modules** — `modules/chat` unmounted; shadow mirrors may lag live pairing.

---

## 10. Test baseline (2026-08-10)

| Suite | Result |
|---|---|
| `phase821_messaging_identity.test.js` | PASS |
| `phase822_messaging_identity_lock.test.js` | PASS |
| `phase822_legacy_admin_typing_read.test.js` | PASS |
| `phase823b_messaging_contact_discovery.test.js` | PASS |
| `phase824_messaging_pairing_lock.test.js` | PASS |
| `messaging_isolation_fix.test.js` | PASS |
| `messaging_hardening.test.js` | **11/12 PASS** — fail: expects `assertCanDirectMessage` in DMS (stale assertion) |
| `messaging-isolation.test.js` | **FAIL** — 401 on send (environment/auth), not isolation assertion |

**Interpretation:** Core Phase 8.21–8.24 locks are green. Hardening failure is a **test contract drift**, not evidence that DM delivery is broken. Isolation suite needs env/auth fix before use as regression gate.

---

## 11. Freeze rule

Until the architecture plan is approved and a phase begins:

- Do **not** rewrite `sendCanonicalMessage` / private DM delivery.
- Do **not** introduce `transportRole=support` without full dependency map + migration plan.
- Do **not** delete `MessagesContext.jsx`.
- Do **not** change unread schema.
- Document-only work proceeds in Phases 1–3 + final plan.
