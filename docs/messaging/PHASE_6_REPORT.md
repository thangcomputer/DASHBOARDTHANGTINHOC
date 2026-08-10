# Phase 6 Report

## Objective

Make `MessagingPolicy.canDiscoverContacts()` the **single backend authority** for contact discovery. `GET /api/messages/contacts` becomes an orchestration layer (load candidates → policy filter → return). Frontend consumes server contacts and must not recreate discovery authorization.

## Business Rules Preserved

- Phase 3 / 8.24B discover matrix unchanged
- `SUPPORT` productRole ≠ `STAFF`; `transportRole = staff` unchanged
- `DISCOVER ≠ SEND` preserved (Student → HIGH / SUPER: discover NO, send YES)
- Tenant fail-closed from Phase 5.1 applied on discover path
- Branch rules follow approved matrix (Student→Staff same-branch; Support soft/global per freeze)
- `admin_admin` legacy behavior untouched
- Send path (`sendCanonicalMessage` / pairing / recipient resolution) not modified

## Contacts API Before

Inline matrix inside `routes/messageRoutes.js` (role chunks for SUPER / HIGH / SUPPORT / STAFF / teacher / student), returning contacts without calling `MessagingPolicy.canDiscoverContacts`. Frontend also seeded potential contacts from local `students` / `teachers` / `staffs` in `useDataMessaging.getConversations`, and FloatingMessenger fell back to local `staffs` when `/contacts` was empty.

## Contacts API After

```text
authenticate
  → messagesGuard('contacts')
  → listDiscoverableContacts(req.user, { queryBranchId })
      → loadCandidateDocs (same candidate shapes as 8.24B)
      → Branch tenant map
      → MessagingPolicy.canDiscoverContacts per candidate
  → { success, data: allowed contacts }
```

Response preserves prior FE fields and adds normalized:

- `productRole`, `transportRole`, `tenantId` (plus existing `adminRole`, `branchId`, `branchCode`, …)

## MessagingPolicy Integration

- Policy remains pure decision (no DB queries inside `canDiscoverContacts`)
- Orchestration lives in `services/messagingContactsService.js`
- Route is thin; no duplicate matrix in `messageRoutes.js`
- Re-export `canDiscoverContacts` from contacts service is documented as **WRAPPER** only

## Removed Duplicate Policy

| Location | Before | After |
|---|---|---|
| `messageRoutes.js` `/contacts` | Inline discover queries + allow lists | Delegates to contacts service |
| `useDataMessaging.getConversations` | Seeded peers from local arrays | Message-activity + groups only |
| `FloatingMessenger` | Fallback `fmContacts \|\| staffs` | Server contacts only for non-super |
| `supportPresence.buildSupportDirectory` | Presence invented staff peers | Presence marks online among authorized contacts only |

## SUPPORT Discovery

- Student / Teacher / Staff can discover SUPPORT when matrix + tenant allow
- API returns `productRole=SUPPORT`, `adminRole=SUPPORT`, `transportRole=staff`
- Not merged into product STAFF

## STAFF Discovery

- Tested separately from SUPPORT
- Same-branch Student→Staff; cross-tenant Staff B denied
- `productRole=STAFF`, `transportRole=staff`

## Student Discovery

| Target | Discover |
|---|---|
| Assigned Teacher | YES |
| Staff (same branch) | YES |
| Support | YES (tenant-safe) |
| HIGH_ADMIN | NO |
| SUPER_ADMIN | NO |

## Teacher Discovery

| Target | Discover |
|---|---|
| Assigned Student | YES |
| Staff / Support | YES |
| HIGH_ADMIN | YES |
| SUPER_ADMIN | NO |

## Admin Discovery

- SUPER discovers HIGH only (unchanged candidate load + policy)
- HIGH / STAFF / SUPPORT follow 8.24B asymmetry (no “SUPER sees everyone”)
- `admin_admin` not altered

## Tenant Isolation

- Every returned contact must pass `canDiscoverContacts` tenant gate
- Student A (Tenant A) does **not** receive Support B (Tenant B)
- Proven in `phase6_messaging_contacts_policy.test.js` + Phase 5.1 discover tests

## Branch Isolation

- Candidate queries retain 8.24B branch filters; policy re-checks `sameBranch` where required
- Student A does not discover Staff B (other branch/tenant)

## Frontend Policy Duplication

| Usage | Classification |
|---|---|
| `messagesAPI.getContacts` in Inbox / FloatingMessenger | **CONSUMES SERVER** |
| Inbox Support/Staff/Teacher/Student tabs | **PRESENTATION FILTER** |
| `getConversations` message → peer resolve via local lists | **CONVERSATION CACHE / display** |
| Inbox `seedContact` from navigation `selectUser` | **DEEP-LINK** (not directory discovery) |
| `MessagesContext.jsx` contact seeds | **LEGACY / UNMOUNTED** |

Empty `/contacts` → `[]` no longer repopulated from local staff arrays.

## MessagesContext Status

**LEGACY / UNMOUNTED** — file header documented; App mounts `DataProvider` + `useDataMessaging` only. Not deleted in Phase 6.

## Conversation ID Compatibility

- `buildConversationId` unchanged
- SUPPORT/STAFF threads remain `staff_<id>`
- `admin_admin` preserved for SUPER/HIGH

## Test Matrix

File: `tests/integration/phase6_messaging_contacts_policy.test.js`

Covers Student/Teacher/Staff/Support discovery matrices, product vs transport roles, tenant/branch, dual-layer DISCOVER≠SEND for HIGH/SUPER, wiring, FE seed removal, fail-closed unknown roles.

Updated companion tests: `phase823b`, `phase824` wiring, `messaging_hardening` #11.

## Test Results

| Suite | Result |
|---|---|
| phase6_messaging_contacts_policy | **PASS** |
| phase4 / phase5 / phase5.1 | **PASS** |
| phase821 / 822 / 823 / 823b / 824 | **PASS** |
| messaging_isolation_fix | **PASS** |
| messaging_hardening | **PASS** |

## Regression Results

Messaging phase regression set above: **PASS**.  
Send / recipient / unread / ordering suites unchanged in behavior.

## Performance

- Candidates loaded with set-based `Teacher.find` / `Student.find` (role-scoped queries)
- One Branch tenant map query per request
- Policy called in-memory per candidate (no N+1 DB policy queries)
- Correctness prioritized over premature caching

## Security Findings

- Server does not return contacts merely because they appear in staffs/students lists without policy allow
- Client role/tenant values cannot authorize discovery (actor from `req.user`; target tenant from DB/Branch map)
- Unknown product role fail-closed
- Cross-tenant Support denied

## Known Risks

1. **Deep-link `seedContact`** can still open a chat UI for a navigated user who is not in `/contacts` (intentional for SEND-without-DISCOVER / support presence entry). Send still gated by MessagingPolicy.
2. **Elevated FloatingMessenger “directory” mode** still uses online presence for SUPER/HIGH-style viewers (`isSuperAdminViewer` is broad historically) — out of student contacts scope; not used to refill empty student contacts.
3. **MessagesContext** still contains contradictory seed logic if remounted accidentally.
4. Live HTTP `/contacts` multi-role fixtures against real Mongo/JWT not executed in this phase (stubbed orchestration + policy integration tests used).
5. Accounts without resolvable tenant remain fail-closed on discover (Phase 5.1).

## Rollback

1. Restore prior inline `/contacts` handler in `messageRoutes.js` (git history)
2. Revert `messagingContactsService.js`
3. Restore FE seeding blocks in `useDataMessaging` / FloatingMessenger / `supportPresence`
4. No schema migration required

## Next Phase

**STOP** — await approval for Phase 7.
