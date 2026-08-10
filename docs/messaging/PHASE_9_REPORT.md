# PHASE 9 REPORT

## Executive Verdict

Messaging isolation and private DM correctness were proven in Phase 8. Phase 9 adds **diagnosability** (correlation + structured policy/persist/delivery logs + stable deny codes on HTTP) and an **evidence-based 1,000-user readiness audit**.

**1,000 concurrent users: READY WITH CONDITIONS**

Conditions: single-node or Redis-backed Socket.IO adapter + Redis presence; HIGH_ADMIN contacts unbounded load remains a risk; global `Message.isRead` unread model remains a product limitation; no 1,000-client load test was executed.

**If messaging breaks tomorrow:** a developer should inspect **~4–6 functions** first:

1. `sendCanonicalMessage` (`services/directMessageService.js`)
2. `assertCanDirectMessage` / `canSendMessage` (`services/messagingPolicy.js`)
3. `app.notifyUser` (`server.js`) — now logs `presenceKey` / `selectedSocketId` / `room` / `mode`
4. Structured logs: `messaging.policy.*`, `messaging.persist.ok`, `messaging.delivery.emit` (filter by `correlationId`)

---

## Current Runtime Architecture

```text
CLIENT (Inbox / FloatingMessenger / Socket)
        │
        ├─ POST /api/messages ──► messageRoutes ──► sendCanonicalMessage
        └─ message:send ────────► server.js ──────► sendCanonicalMessage
                                      │
                                      ▼
                         assertCanDirectMessage (MessagingPolicy)
                                      │
                         resolveCanonicalRecipient + tenant + pairing
                                      │
                         Message.create + ConversationVisibility
                                      │
                         notifyUser(role, userId, event, payload)
                                      │
                    presence socketId ──or── userId room
                                      │
                         message:receive / message:sent
```

SUPPORT and STAFF share `transportRole=staff`; product roles remain distinct.

---

## End-to-End Message Trace

| Step | File / function |
|---|---|
| Client emit / HTTP POST | `Inbox.jsx` / `FloatingMessenger.jsx` / `routes/messageRoutes.js` |
| Socket auth | `middleware/socketAuth.js` |
| Socket handler | `server.js` → `socket.on('message:send')` |
| Correlation bridge | `services/messagingObservability.js` → `runWithMessagingCorrelation` |
| Canonical send | `services/directMessageService.js` → `sendCanonicalMessage` |
| Identity | `services/messagingIdentity.js` → `resolveMessagingIdentity` |
| Policy | `services/messagingPolicy.js` → `canSendMessage` / `assertCanDirectMessage` |
| Recipient | `resolveCanonicalRecipient` / `messagingPairing.resolveCanonicalPeer` |
| Persist | `Message.create` |
| Deliver | `app.notifyUser` in `server.js` |
| Client receive | Socket `message:receive` |

---

## REST Message Trace

```text
POST /api/messages
  → messagesGuard
  → sendCanonicalMessage (ALS correlation from x-correlation-id or minted id)
  → assertCanDirectMessage
  → Message.create
  → notifyUser
  → 201 + clientMessage
  → deny: 403 + { message, code?, policy? }
```

---

## Socket Message Trace

```text
message:send
  → checkSocketRate (30 / 10s per sender)
  → runWithMessagingCorrelation(channel=socket)
  → sendCanonicalMessage
  → message:sent to sender socket
  → notifyUser → message:receive to recipient
  → deny: structured log messaging.socket.send_denied (no silent-only path for ops)
```

---

## Policy Trace

`MessagingPolicy` decisions include `allowed`, `reason`, `policy`, `scope`, `code`.

Phase 9 logs:

```text
messaging.policy.allow | messaging.policy.deny
  senderId, receiverId
  senderProductRole, receiverProductRole
  senderTransportRole, receiverTransportRole
  tenantId, branchId
  code, reason, policy, scope
  correlationId
```

Example allow (SUPPORT product + staff transport):

```text
receiverProductRole=SUPPORT
receiverTransportRole=staff
code=MESSAGING_ALLOWED
```

---

## Recipient Resolution Trace

`resolveCanonicalRecipient` → pairing peer doc → `productRole` + `transportRole` + `tenantId` (via Branch) + `branchId`.

Wrong client `receiverRole` cannot redirect (Phase 8 proven). Deny codes include `MESSAGING_RECIPIENT_NOT_FOUND`, `MESSAGING_TENANT_MISMATCH`, `MESSAGING_PAIR_DENIED`, `MESSAGING_BRANCH_DENIED`.

---

## Persistence Trace

`Message.create` fields: `conversationId`, `senderId/Role`, `receiverId/Role`, branch codes, content, `isRead`.

Log: `messaging.persist.ok` with `messageId` + `conversationId` (no body).

Schema has **no** `tenantId` column — tenant enforced at policy time only.

---

## Delivery Trace

`app.notifyUser` modes (now logged):

| Mode | Target |
|---|---|
| `legacy_admin_mailbox` | `admin` + `ALL_ADMIN` |
| `presence_socketId` | latest presence `socketId` |
| `userId_room` | room = `userId` |

**Never** private-DM fanout to `ALL_STAFF` / `ALL_SUPPORT`.

Wrong-recipient diagnosis fields: `targetUserId`, `presenceKey`, `selectedSocketId`, `room`, `mode`, `productRole`, `transportRole`, `messageId`, `correlationId`.

---

## Debug Identifiers

| ID | Available? |
|---|---|
| messageId (`_id`) | YES |
| conversationId | YES |
| senderId / receiverId | YES |
| senderRole / receiverRole (transport) | YES |
| productRole | YES (policy logs + identity enrich) |
| tenantId | YES in policy logs (not Message schema) |
| branchId / branchCode | YES (JWT + branch codes on message) |
| correlationId | YES (Phase 9 ALS) |
| socketId | YES (delivery log / socket deny log) |
| policy code | YES |

---

## Correlation ID

Reuses `shared/context/correlationContext` (AsyncLocalStorage).

- HTTP DM: `x-correlation-id` or minted id
- Socket DM: minted `sock_*` id wrapping the send path
- Nested DMS call reuses existing store

**PARTIAL historically** (Socket lost context); **bridged for DM send** in Phase 9. Typing/read/presence still do not mint correlation (by design — avoid log storms).

---

## Structured Logging

Pino via `config/logger.js` with redaction of tokens/passwords.

Messaging events: `msgDomain=messaging`, never message body.

High-frequency `typing:*` / presence still use console/pino sparingly (connect/disconnect console remains noisy — P3).

---

## Error Codes

Stable `MESSAGING_*` in `POLICY_CODES`:

- `MESSAGING_AUTH_REQUIRED`
- `MESSAGING_UNKNOWN_PRODUCT_ROLE`
- `MESSAGING_PAIR_DENIED`
- `MESSAGING_BRANCH_DENIED`
- `MESSAGING_DISCOVER_DENIED`
- `MESSAGING_CONVERSATION_DENIED`
- `MESSAGING_RECIPIENT_NOT_FOUND`
- `MESSAGING_TENANT_MISMATCH`
- `MESSAGING_ALLOWED`

Many route-level 403s remain **Vietnamese text only** (hide/group/unread) — **PARTIAL** outside canonical DM path. HTTP DM deny now returns `code` + `policy` when present.

---

## Socket Presence

- Key: `${messagingRole}_${userId}`
- Stores: `socketId`, `userId`, `role`, `branchId`, `instanceId`
- Redis Hash `cms:presence` + pub/sub when `REDIS_URL` set; else in-process Map
- Multi-tab: **latest register wins** for `presence_socketId` delivery (Phase 8)
- Disconnect: remove by socketId lookup

---

## Multi-tab Behavior

CURRENT DESIGNED BEHAVIOR — not changed. Latest presence socket receives private DM when online; offline falls back to `userId` room.

---

## MongoDB Index Audit

`Message` indexes:

- `conversationId + createdAt`
- `receiverId + isRead` ← unread
- `senderId + createdAt`
- `receiverId + createdAt`
- `messageType + fileExpired + createdAt`

No `tenantId` index (no field). Unread query is index-supported. Contacts use Teacher/Student finds by `adminRole` / `branchId` / `_id` — generally selective; HIGH_ADMIN “everyone” path is the hotspot.

---

## Unread Query Audit

`GET /unread/:userId` → `countDocuments({ receiverId: $in, isRead: false })`.

Uses `receiverId + isRead` index. **Global `isRead`** remains product design (not per-reader). Architectural limitation documented; not redesigned.

---

## Contacts Performance

`listDiscoverableContacts`: candidate queries (role-scoped) + Branch tenant map + in-memory `canDiscoverContacts` filter.

| Scale | Expectation |
|---|---|
| 100 contacts | Fine |
| 500 | Fine |
| 1,000 | Acceptable for typical roles |
| 5,000+ / HIGH_ADMIN full org | Risk — large payload, no pagination |

No pagination added (UI/business not approved).

---

## Broadcast Complexity

| Path | Complexity |
|---|---|
| Private DM notifyUser | O(1) presence lookup + emit |
| `broadcastOnlinePresence` | O(online users + branches) |
| HTTP `/broadcast` insertMany + per-target notify | O(targets) |
| Socket `ALL_*` rooms | O(subscribers in room) |

Private DM ≠ role broadcast (separated).

---

## Redis Usage

When `REDIS_URL` set:

- Token blacklist / app cache (`config/redis.js`)
- Socket.IO adapter (`config/socketIoAdapter.js`)
- Presence hash + pub/sub (`config/presenceStore.js`)
- BullMQ job queue (optional)

Redis does **not** automatically fix app-level “latest socketId” multi-tab semantics.

---

## Multi-instance Readiness

| Capability | Status |
|---|---|
| Socket.IO room fan-out across nodes | READY **if** Redis adapter attached |
| Presence shared | READY **if** Redis presence enabled |
| Private DM targeting | LIMITED — prefers local presence `socketId`; cross-node relies on adapter + shared presence |
| Without Redis | **MULTI-INSTANCE LIMITATION** (memory adapter + local Map) |

**Verdict: LIMITED** (conditional on Redis).

---

## Rate Limiting

| Surface | Protection |
|---|---|
| Socket DM | 30 msgs / 10s per sender (`checkSocketRate`) |
| Typing / read | No dedicated spam limit |
| HTTP messages | Existing express rate limiters (route-dependent) |
| Contacts polling | No messaging-specific throttle |
| Reconnect storms | Socket.IO client defaults; server accepts |

Gaps are P2/P3, not P0 isolation bugs.

---

## Load Test

**NOT LOAD TESTED** — no safe 1,000-client run in this environment.

Architecture assessment substitutes for PASS/FAIL load evidence.

---

## 1,000 User Readiness

| Component | Classification |
|---|---|
| Socket.IO | READY WITH CONDITIONS (Redis adapter for multi-node) |
| Node event loop | READY WITH CONDITIONS (avoid huge broadcasts) |
| MongoDB | READY WITH CONDITIONS (indexes OK; contacts/broadcast volume) |
| Redis | READY when configured; optional otherwise |
| BullMQ | N/A to hot DM path |
| Presence | READY WITH CONDITIONS (Redis for multi-node; ~KB–MB memory at 1k) |
| Message persistence | READY |
| Contacts API | READY WITH CONDITIONS (HIGH_ADMIN unbounded) |
| Unread | READY WITH CONDITIONS (global isRead semantics) |
| Broadcasts | READY WITH CONDITIONS (O(targets)) |
| Logging | READY WITH CONDITIONS (trim connect console at scale — P3) |
| Metrics | READY (new messaging counters) |
| Frontend | READY WITH CONDITIONS (client list sizes) |

**Overall: READY WITH CONDITIONS**

Approximate presence memory: ~0.3–1 KB/row → 1,000 sockets ≈ **0.5–1 MB** local map (negligible vs heap). Room membership dominates more than the presence Map.

---

## Findings by Severity

### P0 — security/data isolation

None found in Phase 9.

### P1 — production correctness

None found. Multi-tab latest-socket is designed behavior.

### P2 — scalability

1. HIGH_ADMIN / large contacts responses without pagination.
2. HTTP `/broadcast` O(targets) insert + notify.
3. Multi-instance requires Redis adapter + Redis presence.

### P3 — observability/debugging

1. Pre-Phase-9 Socket DM deny was silent — mitigated with structured logs + HTTP `code`.
2. Connect/disconnect `console.log` volume at 1k users.
3. Many non-DM route errors still text-only.

### P4 — cleanup

1. Dual console + pino for socket lifecycle.
2. `MessagesContext` legacy file still present (unmounted).

---

## Recommended Upgrades

1. Keep Redis adapter + presence enabled for any multi-instance deploy.
2. Add contacts pagination **after** product/UI approval if HIGH_ADMIN lists grow.
3. Replace socket connect `console.log` with sampled pino debug.
4. Optional: emit `message:send_denied` to sender socket with `code` (UX) — not done this phase.

## Not recommended yet

- Kafka / microservices split
- Redesign Conversation / per-user unread
- Speculative Redis-only rewrite of notifyUser
- Forced clustering without Redis

---

## Changes Actually Made

| File | Change |
|---|---|
| `services/messagingObservability.js` | **NEW** — correlation, structured logs, counters |
| `services/directMessageService.js` | Policy/persist logs; return `code`/`policy` on deny |
| `server.js` | ALS on `message:send`; `notifyUser` delivery trace |
| `routes/messageRoutes.js` | HTTP correlation + deny `code` |
| `shared/metrics/prometheusExporter.js` | Messaging counters |
| `tests/integration/phase9_messaging_observability.test.js` | **NEW** |
| `docs/messaging/PHASE_9_REPORT.md` | This report |

**No** changes to MessagingPolicy rules, pairing, schemas, unread model, SUPPORT transport, or room semantics.

---

## Known Environment Limitations

- No 1,000-client load harness executed.
- `tests/messaging-isolation.test.js` still ENVIRONMENT FAILURE on default `:5000` when API down.
- Messaging counters are in-process (reset on restart; per-instance).

---

## Final Architecture Score

| Dimension | Score | Evidence |
|---|---:|---|
| Correctness | 9 | Phase 8 live multi-client PASS |
| Security | 8 | Tenant/branch isolation; no body logging; token redact |
| Isolation | 9 | Support A/B + Staff collision PASS |
| Debuggability | 8 | Phase 9 traces; ~4–6 file blast radius |
| Observability | 7 | Counters + structured logs; typing not correlated |
| Performance | 7 | Indexed unread/DM; contacts hotspot for elevated |
| Scalability | 6 | READY WITH CONDITIONS; no load proof |
| Maintainability | 8 | Canonical DMS + MessagingPolicy |
| Testability | 9 | Phases 4–8 + live harness + Phase 9 tests |

**Weighted overall: 8.0 / 10**

---

## Next Phase

**STOP** — await approval for Phase 10.
