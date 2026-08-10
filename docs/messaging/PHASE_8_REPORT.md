# Phase 8 Report

## Objective

Prove the **live multi-client Socket.IO runtime** isolates private DMs. No architecture redesign. No mocks of `notifyUser`, `sendCanonicalMessage`, or Socket rooms.

## Runtime Harness

| Item | Detail |
|---|---|
| Test | `tests/integration/phase8_live_messaging_runtime.test.js` |
| Helper | `tests/helpers/phase8LiveHarness.js` |
| Server | Real `server.js` spawned on `PORT=5018` |
| Clients | `socket.io-client` (independent connections) |
| Auth | Minted JWT (`JWT_SECRET`, `tokenVersion: 0`) matching seeded users |
| Send path | Socket `message:send` → `sendCanonicalMessage` → `app.notifyUser` |
| Evidence | `artifacts/phase8-live-runtime-evidence.json` |

## Clients Used

| Client | Role |
|---|---|
| Student A / B | student (Tenant A, Branch P8A / P8B) |
| Support A / B | SUPPORT / transport staff |
| Staff A / B | STAFF / transport staff |
| Teacher A | teacher |
| Support TenantB | SUPPORT on Tenant B (deny fixture) |

## Authentication

Socket auth via `middleware/socketAuth.js` + Bearer JWT. HTTP `/contacts` also succeeded with minted JWT on the Phase 8 server (`status 200`, Support A present, cross-tenant Support absent).

## Student → Support

**PASS**

Evidence:

- Sender: Student A `6a79cbb8ee530fa0f98b3d20`
- Recipient: Support A `6a79cbb8ee530fa0f98b3d1e`
- Socket: Support A `message:receive` = 1
- Unexpected recipients = 0 (Support B, Staff A, Teacher A, Student B)
- DB `countDocuments(content)` delta = +1
- `conversationId`: `staff_<supportA>__student_<studentA>`

## Support A / Support B Isolation

**PASS** — Support B never received Support A’s private DMs (Student→Support A, Staff→Support A, concurrent matrix).

## STAFF / SUPPORT Transport Collision

**PASS** — shared `transportRole=staff` / `ALL_STAFF` membership did **not** cause Staff A to receive Student→Support A private DM.

## Reverse Direction

**PASS** — Support A → Student A; Student B / Staff A / Support B = 0 receives.

## Teacher Isolation

**PASS** — Teacher A → Student A; Student B / Support A / Staff A = 0.

## Branch Isolation

| Case | Result |
|---|---|
| Student A → Staff B (diff branch) | **DENY** — dbDelta 0, no receive |
| Student A → Support B (same tenant, diff branch) | **ALLOW** — approved global SUPPORT send freeze; only Support B received |

Documented as **CURRENT DESIGNED BEHAVIOR** (not a bug). Phase 8 prompt’s “Support cross-branch DENY” does **not** match the frozen pairing matrix.

## Tenant Isolation

**PASS** — Student A → Support TenantB: dbDelta 0, no local socket delivery.

## Wrong Role Hint

**PASS** — client `receiverRole: 'teacher'` with Support A id → still delivered to Support A with `receiverRole: staff` (canonical resolution).

## Duplicate Send

Not a dedicated idempotency feature. Concurrent distinct contents verified; no unintended cross-delivery. No new idempotency architecture added.

## Typing Isolation

**PASS** — peer events are `typing:show` / `typing:hide` (not raw `typing:start`). Support A received; Support B did not. Conv id from live DM.

## Read Isolation

**PASS** — Support A `message:read` did not emit to Support B. `Message.isRead` remains global boolean (unchanged).

## Presence

Online presence for all clients established via `register` + `users:online`. Presence did **not** cause fanout of private DMs to other online Staff/Support.

## Broadcast Separation

Private DM path uses `sendCanonicalMessage` + `notifyUser` (user room / presence socketId). Broadcast role rooms remain a separate `message:send` branch for `ALL_*` receivers. No private DM observed on `ALL_STAFF` / `ALL_SUPPORT`.

## Concurrent Sends

**PASS** — four parallel DMs; each intended recipient only; no cross-delivery between Support A/B.

## Reconnect

**PASS** — Support A disconnect → reconnect → still receives Student DM.

## Multi-tab

**PASS (documented current semantics)** — `app.notifyUser` prefers `onlineUsers[role_id].socketId` (last `register`) and returns early; **latest tab** receives. Not classified as duplicate-user leak.

## Message Persistence

**PASS** — `senderId`, `receiverId`, `senderRole=student`, `receiverRole=staff`, `conversationId`, branch codes present. Schema has **no** `tenantId` field (unchanged).

## No Partial Persistence

**PASS** for branch Staff deny + tenant deny (dbDelta 0).

## Live HTTP Contacts

**PASS** on Phase 8 ephemeral server — Student contacts include Support A; exclude cross-tenant Support (count 3).

## Existing 401 Environment Failure

`tests/messaging-isolation.test.js` against default `localhost:5000`:

```text
ENVIRONMENT FAILURE — API/auth seed (401 ≠ 201)
```

Not classified as messaging authorization failure. Default API was not the Phase 8 harness (`:5018`).

## Test Results

| Area | Result |
|---|---|
| Live multi-client Socket.IO | **PASS** (19/19) |
| Student → Support isolation | PASS |
| Support A/B | PASS |
| Staff/Support collision | PASS |
| Reverse / Teacher / Staff↔Support | PASS |
| Tenant deny | PASS |
| Branch Staff deny | PASS |
| Branch Support global allow | PASS (designed) |
| Typing / Read | PASS |
| Concurrent / Reconnect | PASS |
| Multi-tab semantics | PASS (documented) |
| Persistence / no partial | PASS |
| HTTP /contacts | PASS |

## Application Code Changes

**NO** — test harness + docs only.

## Known Environment Failures

1. `tests/messaging-isolation.test.js` → 401 on default `:5000` (API not Phase 8 harness / auth seed).
2. Historical “Live multi-client NOT TESTED” is now closed for this phase’s harness.

## Remaining Risks

1. Multi-tab: only latest presence `socketId` gets private DM until fallback to `userId` room.
2. `Message.isRead` remains a single global boolean (known; not redesigned).
3. SUPPORT send remains globally allowed across branches within tenant (approved freeze).
4. Ephemeral server on `:5018` requires Mongo + env secrets; Redis optional.

## Rollback

Delete Phase 8 test helper/suite/report/evidence artifact. No app rollback needed.

## Next Phase

**STOP** — await approval for Phase 9.
