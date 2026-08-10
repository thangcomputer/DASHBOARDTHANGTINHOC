# Phase 4 Report

## Objective

Establish **one canonical MessagingPolicy** as the LIVE messaging authorization entry point, without rewriting private DM delivery, schemas, transport roles, or auth.

## Business Rules Used

- `MESSAGING_BUSINESS_DECISIONS.md` freeze:
  - `canDiscoverContacts` ← Phase 8.24B contacts matrix
  - `canSendMessage` ← Phase 8.24 pairing
  - discover ≠ send dual-layer (C1/C2)
  - SUPPORT `transportRole = staff` kept; productRole = SUPPORT
  - `admin_admin` kept; no Message.isRead / schema / JWT changes

## Files Changed

| File | Role |
|---|---|
| `services/messagingPolicy.js` | **NEW — CANONICAL** |
| `services/chatAccessService.js` | WRAPPER → MessagingPolicy |
| `services/directMessageService.js` | WIRE send ACL via `assertCanDirectMessage` |
| `server.js` | typing/read → `canViewConversation` / `canMarkRead` |
| `tests/integration/phase4_messaging_policy.test.js` | **NEW** Phase 4 suite |
| `tests/integration/messaging_hardening.test.js` | Update wiring assertions |
| `tests/integration/messaging_isolation_fix.test.js` | Update wiring assertions |
| `tests/integration/phase824_messaging_pairing_lock.test.js` | Update wiring assertions |

## Files Not Changed

- `services/messagingPairing.js` (SEND engine — delegated)
- `utils/messagingRoles.js` (transport + access — delegated)
- `routes/messageRoutes.js` contacts matrix (Phase 6)
- Message / Conversation schemas
- Frontend policy duplication (Phase 7)
- JWT / RBAC / finance / LMS / scheduling
- SUPPORT transport rename
- `admin_admin` migration
- Notification persistence

## Architecture Before

```text
REST/Socket → sendCanonicalMessage → assertMessagingPairAllowed (pairing)
Socket typing/read → canAccessDirectConversation (messagingRoles)
Contacts → inline matrix in messageRoutes
chatAccessService → thin alias of pairing (unused by DMS)
```

## Architecture After

```text
PRODUCT IDENTITY (normalizeIdentity)
        ↓
MessagingPolicy  ← CANONICAL
        ├─ canDiscoverContacts (8.24B pure)
        ├─ canSendMessage → messagingPairing
        ├─ canStartConversation
        ├─ canView / canReceive / canMarkRead → messagingRoles
        └─ canReceiveNotification → receive (realtime only)
        ↓
chatAccessService.assertCanDirectMessage  ← WRAPPER
        ↓
sendCanonicalMessage (REST + Socket)  ← UNCHANGED pipeline body
```

### Module classification

| Module | Classification |
|---|---|
| `messagingPolicy.js` | **CANONICAL** |
| `messagingPairing.js` | KEEP (send engine) |
| `messagingRoles.js` | KEEP (transport / conversation access) |
| `chatAccessService.js` | **WRAPPER** |
| `directMessageService.js` | KEEP (canonical message service) |
| contacts in `messageRoutes.js` | LEGACY-inline until Phase 6 |
| `MessagesContext.jsx` | LEGACY (untouched) |

## Tests Executed

| Suite | Result |
|---|---|
| `phase4_messaging_policy.test.js` | **PASS** |
| `phase821_messaging_identity.test.js` | **PASS** |
| `phase822_messaging_identity_lock.test.js` | **PASS** |
| `phase822_legacy_admin_typing_read.test.js` | **PASS** |
| `phase823b_messaging_contact_discovery.test.js` | **PASS** |
| `phase824_messaging_pairing_lock.test.js` | **PASS** |
| `messaging_isolation_fix.test.js` | **PASS** |
| `messaging_hardening.test.js` | **PASS** |
| `messaging-isolation.test.js` | **NOT TESTED** (known 401 ENVIRONMENT FAILURE) |

## Results

- SUPPORT ≠ STAFF at product layer while sharing transport `staff` — verified
- Discover matrix encodes 8.24B (student no SUPER/HIGH; dual-layer send still structural-allow)
- REST + Socket DM both enter `sendCanonicalMessage` → `assertCanDirectMessage` → MessagingPolicy
- Socket typing/read enter MessagingPolicy conversation access
- Prior hardening expectation of `assertCanDirectMessage` in DMS now satisfied (was STALE relative to interim pairing-direct call; restored as WRAPPER path)

## Security Verification

- Fail closed on unknown productRole
- Client `receiverRole` still hint-only (pairing resolve unchanged)
- STAFF/SUPPORT still denied legacy `admin_admin` view
- Support A thread not viewable by Support B (conversation token participant check)

## Branch Verification

- Discover: student/staff cross-branch DENY when `sameBranch: false`
- Full DB branch scope on send remains in pairing (unchanged) — **NOT retested with live Mongo in Phase 4**

## Tenant Verification

- `tenantId` normalized on identity; **not enforced** on live DM (documented freeze) — **NOT TESTED** as deny path

## Socket Verification

- Static wiring: `message:send` → `sendCanonicalMessage`; typing/read → MessagingPolicy
- Live multi-socket isolation E2E — **NOT TESTED** this phase (Phase 5+)

## REST Verification

- Static: `POST /api/messages` still uses `sendCanonicalMessage` which now calls policy wrapper
- Live HTTP matrix E2E — **NOT TESTED** this phase

## Performance Considerations

- Negligible: one extra function hop; no new queries beyond existing pairing

## Debugging Improvements

- Structured decisions: `{ allowed, reason, policy, scope, code }`
- Stable codes: `MESSAGING_*` constants on policy module

## Known Risks

1. Contacts route still has **inline** discover matrix (duplicate until Phase 6) — Policy pure function is source for tests; route not yet calling it
2. `canStartConversation` deep-link path (`allowSendWithoutDiscover`) needs DB pairing — not exercised in unit suite
3. Group conversation access still membership-gated outside policy (`GROUP_REQUIRES_MEMBERSHIP_CHECK`)
4. Unrelated dirty tree files (redis/cache/rbac artifacts) must not be mixed into messaging commits

## Rollback

```text
1. Revert messagingPolicy.js (delete)
2. Restore chatAccessService to direct pairing delegate
3. Restore DMS assertMessagingPairAllowed import
4. Restore server.js canAccessDirectConversation for typing/read
5. Revert test wiring string updates
```

No schema or data migration to roll back.

## Next Phase

**STOP here.** Do not start Phase 5 until approved.

Recommended Phase 5: Canonical recipient resolution surface exported from MessagingPolicy / single resolver used explicitly by DMS (already largely inside pairing `resolveCanonicalPeer`) + isolation E2E for Support A vs B.
