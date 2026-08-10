# Phase 5 Blocker — Tenant Isolation on Live DM

**Status:** CLOSED  
**Closed:** 2026-08-10 (Phase 5.1)  
**Severity was:** Security invariant gap  

---

## Resolution

Tenant isolation is now enforced in the canonical messaging authorization path:

```text
sendCanonicalMessage
  → assertCanDirectMessage
  → MessagingPolicy.canSendMessage
  → resolveCanonicalRecipient
  → resolveAuthoritativeTenantId(actor) + recipient.tenantId
  → assertTenantIsolation (fail-closed)
  → messagingPairing (branch / assignment)
```

Code: `MESSAGING_TENANT_MISMATCH`  
Policy: `TENANT` / scope `TENANT`

### Authoritative tenant sources

1. Explicit `tenantId` on server identity (when present on peer/JWT user object)
2. Else `Branch.tenantId` via `branchId` (`resolveAuthoritativeTenantId`)

Never trusts client `receiverTenantId` / `clientTenantId`.

### Fail-closed rules

| Condition | Result |
|---|---|
| actor tenant missing | DENY |
| recipient tenant missing | DENY |
| actor ≠ recipient tenant | DENY |
| actor === recipient tenant | continue to branch/pairing |

No SUPER_ADMIN / HIGH_ADMIN tenant bypass.

Discover also fails closed on tenant (`canDiscoverContacts`) when identities carry `tenantId`.

---

## Evidence

| Suite | Result |
|---|---|
| `phase5_1_tenant_isolation.test.js` | PASS |
| `phase5_messaging_recipient_resolution.test.js` | PASS (updated) |
| phase4 + phase821–824 + isolation_fix + hardening | PASS |

See `docs/messaging/PHASE_5_1_REPORT.md`.

---

## Remaining notes (not re-opening blocker)

- Teacher/Student Mongoose schemas still lack a declared `tenantId` field; production resolution typically uses **Branch.tenantId**. Accounts without `branchId` and without resolvable Branch tenant fail closed (DENY).
- Conversation **view** path does not yet re-check peer tenant from conversationId alone (send + discover covered). Risk documented in Phase 5.1 report.
- Live multi-client Socket.IO E2E: NOT TESTED (shared `sendCanonicalMessage` path verified).
