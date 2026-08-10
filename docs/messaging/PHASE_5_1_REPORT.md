# Phase 5.1 Report

## Objective

Close `PHASE_5_BLOCKER.md` by enforcing **fail-closed tenant isolation** on private DM inside the canonical MessagingPolicy path (REST + Socket).

## Where tenant information was available (pre-change)

| Source | Available? | Notes |
|---|---|---|
| `normalizeIdentity` / `resolveCanonicalRecipient` | Surfaces `tenantId` if present on peer/user | Not enforced before 5.1 |
| `Teacher` / `Student` schema | **No** declared `tenantId` | Strict schema strips undeclared fields from Mongo reads |
| `Branch.tenantId` | **Yes** | Authoritative org scope for a branch |
| JWT / `req.tenantScope` | Optional header scope for Super Admin | Not used as DM pair authority; must not trust client |
| Client body `receiverTenantId` | Spoofable | **Ignored** |

## Files Changed

- `services/messagingPolicy.js` — `resolveAuthoritativeTenantId`, `assertTenantIsolation`, tenant gate in `canSendMessage` + `canDiscoverContacts`; `POLICY_CODES.TENANT_MISMATCH`
- `tests/integration/phase5_1_tenant_isolation.test.js` — **NEW**
- `tests/integration/phase5_messaging_recipient_resolution.test.js` — fixtures + tenant expectations
- `tests/integration/phase4_messaging_policy.test.js` — same-tenant fixture `tenantId`
- `docs/messaging/PHASE_5_BLOCKER.md` — **CLOSED**
- `docs/messaging/PHASE_5_REPORT.md` — tenant status update
- `docs/messaging/PHASE_5_1_REPORT.md` — this file

## Files Not Changed

Frontend, JWT/auth, Message/Conversation schemas, unread, Socket rooms, contacts API, SUPPORT transportRole, pairing branch matrix logic (still separate layer).

## Architecture

```text
Tenant Policy (NEW, fail-closed)
    ↓
Branch / Assignment Policy (unchanged pairing)
    ↓
Messaging pair allow-list
```

## Test Results

| Test area | Result |
|---|---|
| Same-tenant Student → Support | PASS |
| Cross-tenant Student → Support | PASS (DENY) |
| Cross-tenant reverse | PASS |
| Staff A → Staff B cross-tenant | PASS (DENY) |
| Support A → Support B cross-tenant | PASS (DENY) |
| Same-tenant Support ↔ Staff | PASS (ALLOW) |
| Teacher/Student cross-tenant | PASS (DENY before pairing) |
| Missing actor/recipient tenant | PASS (DENY) |
| Client tenant spoof | PASS (DENY) |
| sendCanonicalMessage no partial write | PASS |
| Same-tenant delivery exact user | PASS |
| Live Socket multi-client E2E | **NOT TESTED** |
| `messaging-isolation.test.js` | **ENVIRONMENT FAILURE** (unchanged) |

## Regression

phase4, phase5, phase821–824, isolation_fix, hardening — **PASS**

## Remaining security risks

1. Users without resolvable tenant (`tenantId` and `Branch.tenantId` via `branchId`) cannot DM (fail-closed) — includes some elevated/null-branch accounts until identity carries tenant.
2. `canViewConversation` does not independently re-validate peer tenant from conversationId.
3. Contacts route (Phase 6) still inline — discover policy function is tenant-aware when identities include `tenantId`, but HTTP contacts not yet migrated.

## Rollback

Revert MessagingPolicy tenant helpers + gates; restore prior tests/docs. No schema migration.

## Next

**STOP** — await approval for Phase 6 (contacts API → MessagingPolicy), with tenant blocker closed.
