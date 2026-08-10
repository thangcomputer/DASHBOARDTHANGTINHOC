# MESSAGING ARCHITECTURE REFACTOR PLAN

**Status:** Design / freeze — **NO CODE CHANGES IN THIS STEP**  
**Date:** 2026-08-10  
**Companion docs:**

- [`MESSAGING_BASELINE.md`](./MESSAGING_BASELINE.md)
- [`ROLE_DEPENDENCY_MAP.md`](./ROLE_DEPENDENCY_MAP.md)
- [`MESSAGING_POLICY.md`](./MESSAGING_POLICY.md)
- [`MESSAGING_MATRIX.md`](./MESSAGING_MATRIX.md)
- [`pairing-matrix-824.md`](./pairing-matrix-824.md)
- [`contact-visibility-824b.md`](./contact-visibility-824b.md)

**Objective:** One source of truth for messaging policy, conversation membership, unread state, and inbox ordering — **without** rewriting working private DM delivery.

---

## 1. Current architecture

```text
┌──────────── FE ────────────┐     ┌──────────── BE ────────────┐
│ Inbox + FloatingMessenger  │     │ POST /api/messages         │
│ useDataMessaging (live)    │────►│ message:send (socket)      │
│  - message cache           │     │         │                  │
│  - lastTime ordering       │     │         ▼                  │
│  - local contact seeds     │     │ sendCanonicalMessage       │
│ MessagesContext (unmounted)│     │  ├─ assertMessagingPair…   │
│ GET /messages/contacts     │◄────│  ├─ Message.create         │
│                            │     │  └─ notifyUser(user room)  │
└────────────────────────────┘     │ GET /contacts (discovery)  │
                                   │ GET /conversations (agg)   │
                                   │ Role rooms = broadcast only│
                                   └────────────────────────────┘
```

**Facts (audit):**

1. SUPPORT and STAFF share transport `staff`.
2. Student → Support transported as `staff`.
3. Private DMs converge on `sendCanonicalMessage`.
4. DM delivery need not be rewritten if tests confirm correctness (Phase 8.21–8.24 locks green).
5. Role rooms (`ALL_STAFF` / `ALL_SUPPORT` / …) are separate from private DM delivery.
6. Unread uses global `Message.isRead`.
7. Group unread cannot represent independent per-participant read state.
8. Inbox ordering depends on FE message cache + `lastTime`.
9. Backend `/api/messages/contacts` is intended discovery authority.
10. FE `useDataMessaging` re-implements discovery policy.
11. Legacy `MessagesContext.jsx` conflicts / duplicates assumptions; not mounted.
12. REST + Socket DM recipient resolution converge on `sendCanonicalMessage`.
13. Broadcast/legacy role-room behavior must not be confused with private DM.

---

## 2. Root causes

| # | Root cause | Symptom |
|---|---|---|
| R1 | Transport role collapsed SUPPORT into `staff` for conversationId compatibility | Presence/broadcast room coupling; FE must use `adminRole` to distinguish |
| R2 | Dual policy surfaces (pairing vs contacts vs FE seeds) | Discover ≠ send conflicts; over/under-seeding inbox |
| R3 | No first-class DM Conversation document | Ordering/unread derived from Message aggregate + FE cache |
| R4 | Global `Message.isRead` | Broken multi-participant unread semantics |
| R5 | Same Socket event name `message:receive` for DM and broadcast | Ambiguous mental model; safe only if rooms differ |
| R6 | Legacy `admin_admin` special-case in `buildConversationId` | Shared mailbox vs per-user elevated threads |
| R7 | Legacy FE context retained beside live path | Drift risk; stale tests |
| R8 | Test contracts lag code (`assertCanDirectMessage` string checks) | False red baselines |

---

## 3. Role model

```text
productRole (business):
  STUDENT | TEACHER | SUPPORT | STAFF | HIGH_ADMIN | SUPER_ADMIN

transportRole (compatibility — keep):
  student | teacher | staff | admin
  SUPPORT → staff   until dependency map + ID migration approved

displayRole (UI):
  from messagingIdentity (ADMIN_STAFF, SUPPORT, …)
```

**Decision:** Keep `transportRole=staff` for SUPPORT as internal compatibility layer through early implementation phases. Do **not** migrate SUPPORT → `support` until every dependency in `ROLE_DEPENDENCY_MAP.md` is aliased.

---

## 4. Communication matrix

See [`MESSAGING_MATRIX.md`](./MESSAGING_MATRIX.md).

Unresolved items marked **CONFLICT — REQUIRES BUSINESS DECISION** (especially SUPER visibility for non-HIGH callers, and SUPPORT sitting on `ALL_STAFF`).

---

## 5. Contact policy

| Layer | Responsibility |
|---|---|
| **Backend** `GET /api/messages/contacts` | **Sole** authority for who may appear in danh bạ |
| **Backend** pairing | Sole authority for who may send |
| **Frontend** | Search, sort, tab group, display; **must not** decide allow-list |

**Phase 6–7 plan:** prove Inbox uses contacts API; strip `useDataMessaging` discovery seeds after parity tests; keep temporary dual-run behind flag if needed.

Contact payload target:

```text
id, displayName, productRole, adminRole, branchId, tenantId?, transportRole?, avatar, …
```

(Live already returns much of this; normalize naming in a later phase.)

---

## 6. Conversation model

### Current

- DM: implicit via `Message.conversationId`
- Visibility: `ConversationVisibility { conversationId, hiddenByUsers }`
- Group: `Group { participants[], lastMessage }`

### Target (design only)

```text
Conversation
├── conversationId
├── participants[]
├── tenantId
├── branchId
├── lastMessageId
├── lastMessageAt
└── status
```

### Gap analysis

| Need | Supported today? |
|---|---|
| Stable conversationId | Yes (string) |
| participants[] on DM | **No** (inferred from ID tokens) |
| lastMessageAt | Derivable from Message / Group.lastMessage; **no** DM Conversation field |
| tenantId | **No** on Message |
| status | **No** |

**Decision:** Do **not** migrate schema until a phase report proves Conversation document is required for ordering/membership. Prefer: (a) strengthen `GET /conversations` as ordering authority, then (b) optional Conversation collection if aggregates prove insufficient.

---

## 7. Unread model

### Current (OK for strict 1:1)

```text
Message.isRead / readAt / receiverId
```

### Insufficient for groups

Global flag cannot be per-participant.

### Target design (analyze only — Phase 10)

```text
ConversationParticipant
├── conversationId
├── userId
├── role
├── lastReadAt
└── unreadCount
```

### Migration impact (preview)

| Area | Impact |
|---|---|
| Data | Backfill lastReadAt from Message.isRead for DM receiver; groups need heuristic or reset |
| API | `/unread`, `/read`, conversations.unreadCount |
| Socket | `message:read` / `read_ack` payloads |
| FE | Badge from participant unread, not message cache reduce |
| Notifications | Unrelated today (no Notification on chat send) |
| Compat | Dual-write isRead + participant cursor during transition |

**Implement only after review.**

---

## 8. Inbox ordering model

| Today | Target |
|---|---|
| FE `lastTime` from message cache + seeds | `Conversation.lastMessageAt` or API aggregate `lastMessage.createdAt` |
| `mergeConversationsById` / `sortConversationsByLastMessageAt` | Keep as presentation helpers over **server-ordered** list |
| `GET /conversations/:userId` already sorts DESC | Make this the FE primary source |

**Before changing:** compare API vs UI order; inventory all `lastTime` usages; add regression tests.

---

## 9. Socket room model

| Room type | Name pattern | Allowed traffic |
|---|---|---|
| USER ROOM | `{userId}` | Private DM, typing/read toward user, personal notifies |
| CONVERSATION ROOM | `group_{id}` (future: `conv_{id}`) | Conversation messages for members |
| ROLE BROADCAST ROOM | `ALL_STAFF`, `ALL_SUPPORT`, … | System/presence broadcasts **only** |
| BRANCH BROADCAST ROOM | `branch_{id}`, `ALL_*_{branch}` | Branch-scoped system events |
| SYSTEM BROADCAST ROOM | `ALL_ADMIN`, global admin channels | Administrative events |

**Hard rule:** Private messages must never enter a role broadcast room.

### Event classification (Phase 5)

| Class | Events |
|---|---|
| PRIVATE_DM | `message:send`→canonical, `message:receive` (user room), `message:sent` |
| CONVERSATION_MESSAGE | group `message:receive` on `group_*` |
| SYSTEM_BROADCAST | `message:send` with ALL_*, REST broadcast, presence fan-out |
| PRESENCE_EVENT | `register`, `users:online`, `users:lastSeen` |
| TYPING_EVENT | `typing:*` |
| READ_EVENT | `message:read`, `message:read_ack` |

No event may ambiguously behave as both DM and broadcast: **room + authorization** disambiguate; prefer splitting event names in a later cleanup if needed (`dm:receive` vs `broadcast:receive`) — optional, not required for correctness if rooms stay strict.

---

## 10. Notification model

**Finding:** Live chat send path does **not** create `Notification` documents; realtime Socket only.

| Option | Product need? | Action |
|---|---|---|
| Realtime chat badge only | Likely current | Keep; derive from unread |
| Persistent in-app notification history | Unknown | Decide separately — do not auto-add |
| Email / push | Unknown | Decide separately |

Document product decision before any NotificationService wiring on DM send.

---

## 11. Frontend / backend responsibility

| Concern | Backend | Frontend |
|---|---|---|
| Who can message whom | ✅ Policy | ❌ |
| Who appears in contacts | ✅ `/contacts` | Display only |
| Conversation membership | ✅ | Cache for UX |
| Unread counts | ✅ (target) | Display / optimistic UI |
| Inbox order | ✅ `lastMessageAt` | Sort helper only |
| Transport role helpers | Shared util OK | No policy branching |
| Tabs / search / grouping | — | ✅ |

---

## 12. Legacy code

### `MessagesContext.jsx`

| Question | Evidence |
|---|---|
| Mounted in App? | **No** (`DataContext` uses `useDataMessaging`; comment says not mounted) |
| Imported elsewhere? | Self + `messaging_hardening` static read |
| Classification | **Legacy / partially retained for migration** — treat as **(2) legacy code**, reachable as module but **not** live UI path |
| Delete now? | **No** |
| Next steps | Prove unused import graph → mark `@deprecated` → remove in separate phase after build/test |

### Other legacy

- `admin_admin` mailbox tokens
- `modules/chat` unmounted Enterprise paths
- Stale wave69 assertions expecting old DMS imports

---

## 13. Migration risks

| Risk | Severity | Mitigation |
|---|---|---|
| Changing SUPPORT transport | **Critical** | Keep staff; alias layer first |
| Removing FE seeds early | High | Parity tests contacts vs UI |
| Conversation collection big-bang | High | API-first ordering; schema later |
| Unread participant model | High | Dual-write; DM-first |
| Splitting Socket event names | Medium | Optional; rooms first |
| Touching `sendCanonicalMessage` | High | Only for proven bugs |
| Mixing unrelated dirty git files | Process | Phase safety check |

---

## 14. Implementation phases

**Rule:** change → test → regression → audit → next. Never combine into one mega-refactor.

| Phase | Work | Code? |
|---|---|---|
| 0 | Freeze baseline | Docs only ✅ |
| 1 | Role dependency map; keep transport | Docs ✅ / later code audit only |
| 2 | MessagingPolicy design | Docs ✅ |
| 3 | Matrix + business conflict resolution | Docs ✅ + product decisions |
| 4 | Keep private DM stable | Verify tests; **no rewrite** |
| 5 | Classify Socket events/rooms in docs + asserts | Tests/docs first |
| 6 | Contacts = SoT audit of FE duplication | Audit + tests |
| 7 | Remove FE policy duplication | Code after 6 proven |
| 8 | Conversation model decision | Report; migrate only if required |
| 9 | Inbox ordering → API lastMessageAt | Code + regression |
| 10 | Unread redesign analysis → optional impl | Design first |
| 11 | Legacy MessagesContext deprecation | Proof → deprecate → delete later |
| 12 | Socket room cleanup | After DM tests green |
| 13 | Notification product decision | Doc; maybe no code |
| 14 | Test matrix expansion | Tests |
| 15 | Ordered implementation of policy module etc. | Per checklist below |

### Phase 15 coding order (only after design approval)

1. Canonical role definitions (shared module; no ID rewrite)
2. Canonical MessagingPolicy
3. Canonical recipient resolver (already largely in pairing)
4. Canonical conversation access check
5. Backend contacts harden / contract tests
6. Remove FE policy duplication
7. Conversation ordering
8. Unread model if required
9. Socket room cleanup
10. Notification cleanup (if any)
11. Legacy messaging cleanup
12. E2E tests

---

## 15. Tests

### Existing gates (baseline)

- phase821 identity, phase822 locks, phase822 typing/read, phase823b contacts, phase824 pairing, messaging_isolation_fix — **PASS**
- Fix/replace stale hardening assertion (`assertMessagingPairAllowed` vs `assertCanDirectMessage`)
- Repair `messaging-isolation` auth/env before relying on it

### Required matrix (Phase 14)

**DM:** Student↔Teacher, Student↔Support, Teacher↔Support, Support↔Student/Teacher  

**Support isolation:** Support A vs B same student — correct recipient; B does not receive; unread; inbox order; reconnect  

**Branch:** Student A → Support A vs Support B per approved matrix  

**Broadcast:** Admin→ALL_SUPPORT / ALL_STAFF per approved exclusivity (resolve SUPPORT-on-ALL_STAFF conflict first)

Also: RBAC regression, branch isolation, reconnect.

---

## 16. Rollback strategy

| Change type | Rollback |
|---|---|
| Policy module extract (behavior-preserving) | Revert PR; keep pairing as fallback export |
| FE seed removal | Feature flag restore seeds; contacts API unchanged |
| Conversation collection | Dual-read Message aggregate; stop writing new collection |
| Unread participant | Keep writing `Message.isRead`; ignore new collection |
| Transport role rename | **Do not ship without alias**; rollback = re-enable staff tokens |
| Socket room changes | Revert join map; notifyUser already user-room based |

**Process rollback:** each phase is its own PR; no force-push; unrelated files never staged.

---

## 17. Safety check (every phase)

**Before:**

```text
git diff
git status
test baseline (messaging phase suites)
```

**After:**

```text
git diff   # messaging-only files
test messaging E2E / phase suites
RBAC regression
branch isolation
```

No unrelated files may change (current dirty Redis/RBAC/deploy files must stay out of messaging PRs).

---

## 18. Final rule

This document establishes the **canonical messaging architecture**.  

**Do not modify application code until:**

1. Business conflicts in `MESSAGING_MATRIX.md` are decided where they block a phase.
2. Phase N scope is explicitly approved.
3. Baseline tests are green for the area under change.

Private DM path (`POST /api/messages`, `message:send`, `sendCanonicalMessage`) remains frozen unless a proven bug is demonstrated.
