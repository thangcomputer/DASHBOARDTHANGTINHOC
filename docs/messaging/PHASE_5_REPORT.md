# Phase 5 Report

## Objective

1. Expose **one explicit canonical recipient-resolution surface**.
2. Prove private DM isolation (exact recipient; Support A ≠ Support B; Staff ≠ Support collision) without schema/frontend/unread/auth changes.

## Files Changed

| File | Change |
|---|---|
| `services/messagingPolicy.js` | Added `resolveCanonicalRecipient`; `canSendMessage` resolves once then reuses engine via pairing options |
| `services/messagingPairing.js` | `assertMessagingPairAllowed(..., options.resolved)`; select includes `tenantId` when present |
| `services/chatAccessService.js` | Re-export `resolveCanonicalRecipient` |
| `tests/integration/phase5_messaging_recipient_resolution.test.js` | **NEW** resolver + isolation suite |
| `docs/messaging/PHASE_5_BLOCKER.md` | Tenant NOT ENFORCED blocker |
| `docs/messaging/PHASE_5_REPORT.md` | This report |

## Files Not Changed

- Frontend (`useDataMessaging`, Inbox, MessagesContext)
- Message / Conversation schemas
- JWT / auth / global RBAC
- Unread (`Message.isRead`)
- Socket room join map / role-room architecture
- Contacts API (Phase 6)
- `admin_admin` format
- SUPPORT `transportRole = staff`

## Canonical Recipient Resolver

```text
CANONICAL SURFACE:
  services/messagingPolicy.js → resolveCanonicalRecipient(recipientId, context)

ENGINE (KEEP, not competing):
  services/messagingPairing.js → resolveCanonicalPeer

WRAPPER:
  services/chatAccessService.js → resolveCanonicalRecipient (re-export)

Flow:
  recipientId (+ optional roleHint)
       ↓
  resolveCanonicalRecipient
       ↓
  authoritative { id, tenantId, branchId, productRole, adminRole, transportRole }
       ↓
  assertMessagingPairAllowed({ resolved })  // no duplicate DB lookup
       ↓
  sendCanonicalMessage
```

### Usage classification

| Symbol | Classification |
|---|---|
| `resolveCanonicalRecipient` | **CANONICAL** surface |
| `resolveCanonicalPeer` | **ENGINE** (internal; not a second authority) |
| `assertCanDirectMessage` | **WRAPPER** → MessagingPolicy |
| `assertMessagingPairAllowed` | **ENGINE** send ACL |
| `buildConversationId` / `buildCanonicalConversationId` | **KEEP** conversation id helpers |
| Client `receiverRole` | **HINT ONLY** (non-authoritative) |
| Group path | **OUTSIDE** recipient resolver (membership check; documented) |

## Recipient Identity Rules

- Server loads peer from Teacher/Student DB (hint may prefer Student lookup first).
- `productRole` from `resolveProductRole` / adminRole — **never** from client.
- `transportRole` from `getMessagingRole` — SUPPORT → `staff`.
- Wrong client `receiverRole: 'teacher'` for Support id still resolves SUPPORT + staff.
- Unknown id → `MESSAGING_RECIPIENT_NOT_FOUND` (no send).

## SUPPORT vs STAFF Verification

| Identity | productRole | transportRole |
|---|---|---|
| Support A | SUPPORT | staff |
| Staff A | STAFF | staff |

**PASS** — transport shared; product distinct; delivery targets exact user id / socket.

## REST Delivery Verification

Harness: stubbed models + `sendCanonicalMessage` + mock `notifyUser` mirroring `server.js`.

```text
Student A → Support A (receiverRole=teacher wrong hint)
→ receiverId=Support A
→ receiverRole persisted = staff
→ message:receive → Support A only
→ NOT Support B / Staff A / ALL_STAFF / ALL_SUPPORT
```

**PASS** (harness). Live HTTP against running API: **NOT TESTED** this phase (`messaging-isolation.test.js` remains ENVIRONMENT FAILURE when API/auth ids missing).

## Socket Delivery Verification

- Static: `message:send` → `sendCanonicalMessage` (unchanged).
- Behavioral: same `notifyUser` semantics as Socket path (shared service).
- Live multi-client Socket.IO against running server: **NOT TESTED** (no live server in CI harness).

**PASS** for shared-service + notifyUser semantics; live Socket E2E deferred / env-dependent.

## REST / Socket Parity

Both paths call `sendCanonicalMessage` → `assertCanDirectMessage` → `canSendMessage` → `resolveCanonicalRecipient` + pairing.

**PASS** (static + shared service).

## Support A vs Support B Isolation

- Distinct `conversationId` (`staff_<A>` vs `staff_<B>`).
- View: Support B cannot `canViewConversation` Support A thread.
- Delivery: separate `message:receive` targets.

**PASS**

## Branch Isolation

| Case | Result |
|---|---|
| Student A → Staff same branch | ALLOW |
| Student A → Staff Branch B | **DENY** `MESSAGING_BRANCH_DENIED` |
| Student A → Support Branch B | **ALLOW** (global SUPPORT freeze per business decisions) |

**PASS** (pairing scope)

## Tenant Isolation

```text
ENFORCED (Phase 5.1) — fail-closed
code: MESSAGING_TENANT_MISMATCH
path: MessagingPolicy.canSendMessage (+ canDiscoverContacts)
```

See `PHASE_5_BLOCKER.md` (**CLOSED**) and `PHASE_5_1_REPORT.md`.

**Previously:** NOT ENFORCED (Phase 5). Updated 2026-08-10.

## Conversation Identity

- Support A / B distinct — **PASS**
- `admin_admin` legacy preserved — **PASS**
- Format unchanged — **PASS**

## Typing / Read Verification

- Phase 4 wiring unchanged (`canMarkRead` / `canViewConversation`).
- Peer rooms still user-id scoped (not ALL_STAFF) — static prior locks still **PASS**.
- No redesign this phase.

## Test Matrix

| Sender | Recipient | Discover | Structural send | Notes |
|---|---|---|---|---|
| Student | Support | Y | Y | |
| Student | Staff | Y* branch | Y* branch | |
| Student | Teacher | Y* assigned | Y | |
| Student | HIGH | N | Y | dual-layer |
| Student | SUPER | N | Y | dual-layer |
| Teacher | Support | Y | Y | |
| Staff | Support | Y | Y | |
| Support | Staff | Y | Y | |
| Support | Student | Y | Y | |
| Support | Support | Y | Y | |
| Student | self | N | N | |

## Test Results

| Suite | Result |
|---|---|
| `phase5_messaging_recipient_resolution.test.js` | **PASS** (17) |
| `phase4_messaging_policy.test.js` | **PASS** |
| phase821–824 | **PASS** |
| `messaging_isolation_fix.test.js` | **PASS** |
| `messaging_hardening.test.js` | **PASS** |
| `messaging-isolation.test.js` | **ENVIRONMENT FAILURE / NOT TESTED** (401 / missing API seed) |

## Environment Failures

- Live API suite `tests/messaging-isolation.test.js` requires running API + `test_account_ids.json` — not used as PASS evidence.
- Live Socket.IO multi-client E2E not run in this phase harness.

## Security Findings

1. **Tenant DM ACL missing** → BLOCKER doc.
2. Private DM notify path does not emit to ALL_STAFF / ALL_SUPPORT — verified harness + static.
3. Client role hint cannot force wrong productRole for SUPPORT.
4. Inactive Support (`status=inactive`) still **ALLOW** send under current pairing — classified **ALLOW (current)**; product may later DENY (not invented here).

## Performance Findings

- One peer DB lookup per send: `resolveCanonicalRecipient` then `assertMessagingPairAllowed({ resolved })` — **no duplicate lookup**.
- Branch code lookups inside `sendCanonicalMessage` for sender/receiver branchCode remain as before (pre-existing).

## Debugging Improvements

- `resolveCanonicalRecipient` returns `{ ok, code, reason, policy, recipient }`.
- Unknown peer → `MESSAGING_RECIPIENT_NOT_FOUND`.
- Send decisions include `recipient` snapshot when resolved.

## Known Risks

1. Tenant isolation **NOT ENFORCED** (blocker).
2. Contacts API still inline matrix (Phase 6).
3. Live Socket E2E not in CI.
4. Inactive account still messageable.
5. Group membership still outside recipient resolver.

## Rollback

```text
1. Remove resolveCanonicalRecipient; restore canSendMessage to direct assertMessagingPairAllowed
2. Revert assertMessagingPairAllowed options.resolved
3. Revert chatAccess re-export
4. Delete phase5 test + PHASE_5_BLOCKER/REPORT if needed
```

No schema/data migration.

## Next Phase

**STOP.** Awaiting approval.

Phase 6 (contacts API → MessagingPolicy) should not proceed until tenant blocker is **acknowledged** (fix, owner defer, or single-tenant acceptance).
