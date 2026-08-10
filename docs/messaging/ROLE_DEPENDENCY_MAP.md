# ROLE DEPENDENCY MAP — Phase 1

**Status:** Audit only — do **not** remove `messagingRole` / `transportRole=staff` yet.  
**Question:** Can `transportRole=staff` safely remain as an internal compatibility layer for SUPPORT?  
**Answer (provisional):** **Yes, for now** — until every consumer listed below is migrated and conversationId aliases are proven. Migrating SUPPORT → `support` transport would rewrite conversation IDs and is explicitly **out of scope** in Phase 8.24.

---

## 1. Conceptual model (target vocabulary)

```text
productRole:
  STUDENT | TEACHER | SUPPORT | STAFF | ADMIN* | SUPER_ADMIN

* ADMIN in product language ≈ HIGH_ADMIN (+ sometimes SUPER). Code splits SUPER_ADMIN / HIGH_ADMIN.

transportRole (compatibility layer):
  admin | staff | teacher | student
  SUPPORT → staff   ← CURRENT
```

---

## 2. Symbol inventory (messaging-relevant)

### 2.1 `getMessagingRole` / transport `staff` / `support` / `admin` / `teacher` / `student`

| Location | Usage |
|---|---|
| `utils/messagingRoles.js` | Canonical transport mapping; SUPPORT→`staff`; participant checks; typing/read peer rooms |
| `client/src/lib/messagingRoles.js` | FE mirror of transport mapping; `isMessageFromSelf` treats admin↔staff loosely |
| `services/messagingPairing.js` | Uses `getMessagingRole` for peer `transportRole` + `buildCanonicalConversationId` |
| `services/messagingIdentity.js` | `resolveMessagingIdentity.role` = transport |
| `services/directMessageService.js` | Persists `senderRole`/`receiverRole` as transport |
| `server.js` | Socket register key `${messagingRole}_${userId}`; joins `ALL_${uRole}`; STAFF/SUPPORT room joins; broadcast payloads; `notifyUser` role try-set |
| `utils/chatConversationId.js` | Builds IDs from transport tokens; **legacy student↔admin → `admin_admin`** |
| `routes/messageRoutes.js` | Contacts map `role: 'staff'` for STAFF+SUPPORT; conversations otherUser.role from Message |
| `client/.../useDataMessaging.js` | Seeds conv IDs with transport roles |
| `client/.../Inbox.jsx` | Tabs filter by transport `role` + `adminRole` |
| `client/.../messagingIdentity.js` | Display vs transport |
| `modules/chat/**` | Enterprise/shadow copies (unmounted live) — still contain role assumptions |
| Tests `phase821`–`phase824`, `messaging_isolation_fix`, `messaging_hardening` | Lock transport behavior |

### 2.2 `messagingRole` (runtime variable name)

| Location | Usage |
|---|---|
| `server.js` `register` | `const messagingRole = getMessagingRole(socket.user)` — presence key + room joins |
| Comments / docs | Synonym for transport role |

### 2.3 `adminRole`

| Location | Usage |
|---|---|
| Pairing `resolveProductRole` | Distinguishes SUPER/HIGH/STAFF/SUPPORT |
| Contacts matrix | Branch of visibility |
| Identity `displayRole` / `adminRole` on message payload | UI labels; FE tabs |
| Socket register | `ALL_STAFF` / `ALL_SUPPORT` / `ALL_ADMIN` joins keyed off adminRole |
| Auth / RBAC parity (adjacent) | Not messaging ACL itself but feeds JWT |

### 2.4 `productRole`

| Location | Usage |
|---|---|
| `services/messagingPairing.js` `PRODUCT_ROLES` + `resolveProductRole` | **Send ACL** |
| Contacts response field `productRole` | Explicit on API contacts |
| Docs `pairing-matrix-824.md` | Canonical allow-list language |

### 2.5 Role rooms `ALL_STAFF` / `ALL_SUPPORT` / `ALL_ADMIN` / `ALL_TEACHER` / `ALL_STUDENT`

| Location | Usage |
|---|---|
| `server.js` register / presence / lastSeen / broadcast branch | Presence + SYSTEM_BROADCAST |
| `app.notifyUser` | Explicitly **must not** fan private DM to ALL_STAFF/SUPPORT; admin legacy uses ALL_ADMIN |
| `utils/realtimeEmit.js` | Non-chat realtime; fail-closed to ALL_ADMIN |
| `services/NotificationService.js` | Exam etc. — not live chat DM |

---

## 3. SUPPORT ↔ `staff` coupling map (critical)

Because SUPPORT transport is `staff`:

| Concern | Current behavior | Risk if SUPPORT→`support` without migration |
|---|---|---|
| `conversationId` tokens | `staff_<supportMongoId>` | All historical threads orphaned unless alias layer |
| Message.senderRole/receiverRole enum | No `support` value | Schema enum change required |
| Presence key | `staff_<id>` | Duplicate online keys if mixed |
| `ALL_STAFF` join | SUPPORT with transport staff joins ALL_STAFF | Today SUPPORT receives ALL_STAFF presence/broadcasts |
| `ALL_SUPPORT` join | Also joined when `adminRole===SUPPORT` | Partial separation already exists |
| FE tabs | Filter `adminRole===SUPPORT` vs staff | Relies on adminRole, not transport |
| `notifyUser` | Tries admin+staff roles for delivery | Would need `support` in tryRoles |
| Contacts | Maps SUPPORT with `role: 'staff'` | FE must keep distinguishing via adminRole/productRole |

**Recommendation:** Keep `transportRole=staff` as compatibility layer through Phases 1–7. Revisit only after Conversation identity no longer embeds transport role strings **or** a proven bidirectional alias exists for every historical ID.

---

## 4. Dependency graph (simplified)

```text
JWT (role, adminRole, id, branch*)
        │
        ├─► resolveProductRole ──► pairing allow-list / scope (SEND)
        │
        ├─► getMessagingRole ──► conversationId tokens / Message.*Role / socket keys (TRANSPORT)
        │
        └─► resolveDisplayRole / productRole on contacts (UI / DISCOVERY)

contacts API ──► who appears in danh bạ (DISCOVERY ≠ SEND)
useDataMessaging seeds ──► DUPLICATE DISCOVERY (to remove later)
Inbox tabs ──► display grouping only (must not redefine allow-list)
```

---

## 5. Safe-to-leave vs must-touch later

| Artifact | Keep for now | Migrate later (controlled phase) |
|---|---|---|
| `getMessagingRole` SUPPORT→staff | ✅ | Only with ID migration plan |
| `Message.senderRole` enum without support | ✅ | If transport expands |
| Pairing product roles | ✅ evolve policy module | — |
| FE `messagingRoles.js` | ✅ keep in sync | Eventually delete local policy; keep transport helper if needed |
| `MessagesContext` role assumptions | Document only | Deprecate after unused proof |
| Role broadcast rooms | Keep for broadcast/presence | Ensure DM never uses them |

---

## 6. Explicit non-goals of Phase 1

- Do not rename SUPPORT transport to `support`.
- Do not change conversationId format.
- Do not unify SUPER/HIGH into a single ADMIN transport without alias plan.
- Do not delete dual FE/BE role helpers yet.
