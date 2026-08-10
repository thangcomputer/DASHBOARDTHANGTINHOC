# PHASE 10 REPORT

## Executive Verdict

Phase 10 obtained **real load evidence** on a single Node process with an isolated Mongo database.

| Concurrent sockets | Classification |
|---|---|
| 100 | **PASS** |
| 250 | **PASS** |
| 500 | **PASS** |
| 1,000 | **PASS** (steady-state DM); reconnect **DEGRADED** (90/100) |

**1,000 concurrent users: PROVEN** for sustained Socket.IO presence + controlled private DM (medium rate) on **single-node**, Redis **not used**.

Distinction:

| Claim | Status |
|---|---|
| ARCHITECTURALLY READY | Yes (Phase 9 + this evidence) |
| LOAD-TEST PROVEN (1,000 concurrent + private DM) | **Yes** — this phase |
| Multi-instance proven | **No** — not tested |
| Reconnect storms at 1,000 | **Partial** — 10% reconnect failures |

Evidence artifact: `artifacts/phase10-load-evidence.json`  
Harness: `tests/load/messaging/runLoad.js`

---

## Test Environment

| Item | Value |
|---|---|
| Node.js | v24.18.0 |
| OS | Windows 10 (local) |
| API / Socket.IO | `server.js` on `127.0.0.1:5020` |
| MongoDB | Isolated DB `dashboardthangtinhoc_p10load` (host `127.0.0.1:27018`) |
| Redis | **NOT USED** (`REDIS_URL` cleared for harness) |
| Topology | **Single Node** |
| Production data | **Not used** — dedicated Phase 10 DB dropped/reseeded |
| JWT | Minted with `JWT_SECRET` (test actors only) |
| Duration | ~2026-08-10T16:51:58Z → 16:58:48Z (~6.8 min wall) |

Server probe (gated): `GET /__phase10/stats` when `PHASE10_LOADTEST=1` (loopback only).

---

## Test Dataset

| Role | Count | Mix |
|---|---:|---:|
| STUDENT | 700 | 70% |
| TEACHER | 100 | 10% |
| STAFF | 100 | 10% |
| SUPPORT | 80 | 8% |
| HIGH_ADMIN | 20 | 2% |
| **Total** | **1000** | 100% |

Prefix: `P10LOAD`. Password hash shared for seed speed.

---

## Client Distribution

Tier selection samples **proportionally** from each role (not raw insert order).

Active private DM senders: ~15% of Student→Support same-tenant pairs (controlled).

Message rates (overall):

| Tier | Medium rate | High probe |
|---|---:|---|
| 100 | 5 msg/s | 10 msg/s (ok) |
| 250 | 5 msg/s | 10 msg/s (ok) |
| 500 | 5 msg/s | inconclusive (harness stale sockets after reconnect) |
| 1,000 | 4 msg/s | not run (tier > 500) |

---

## Tenant Distribution

```text
Tenant A
 ├─ Branch P10A1
 └─ Branch P10A2

Tenant B
 ├─ Branch P10B1
 └─ Branch P10B2
```

DM path: Student → Support **same tenant** (approved SUPPORT global-send behavior). Isolation witnesses sampled each send.

---

## 100 Client Test

**PASS**

- Connect: 100/100 (p50 50ms, p95 128ms)
- DM: sendOk 19, deliveryOk 19, wrongRecipient 0
- Delivery p95 **2419ms** (cold path / first tier), p50 737ms
- High probe: 26/26 ok, p95 842ms
- CPU peak 6.2%, RSS 133.6 MB, event-loop p99 ~35ms

---

## 250 Client Test

**PASS**

- Connect: 250/250 (new 150; connect p95 854ms)
- DM: 70/70, wrong 0, delivery p95 **98ms**, p99 241ms
- High probe: 48/48, p95 276ms
- CPU 9.4%, RSS 188.7 MB

---

## 500 Client Test

**PASS** (steady DM)

- Connect: 500/500 (new 250; connect p95 1652ms)
- DM: 90/90, wrong 0, delivery p95 **76ms**, p99 136ms
- Reconnect 10%: **50/50** success (reconnect p95 ~5.2s)
- CPU 10.8%, RSS 268.8 MB
- High probe after reconnect: harness used stale closed sockets → not used as evidence

---

## 1,000 Client Test

**PASS** (steady-state connection + private DM)

- Connect: **1000/1000** (new 550; connect p50 3129ms, **p95 6368ms**, p99 8508ms)
- DM @ 4 msg/s: **75/75** send+delivery, wrongRecipient **0**, crossTenant **0**
- Delivery p50 68ms, **p95 135ms**, **p99 421ms**, max 421ms
- CPU peak 6.2%, RSS **303.1 MB**, heapUsed 124.2 MB
- Event-loop p99 ~33ms
- Reconnect 10%: **90/100** success → **DEGRADED reconnect** (10 failures / slow p95 ~40s)

---

## Connection Metrics

| Tier | Success | Conn p50 | Conn p95 | Conn p99 |
|---:|---:|---:|---:|---:|
| 100 | 100% | 50 | 128 | 134 |
| 250 | 100% | 487 | 854 | 858 |
| 500 | 100% | 1164 | 1652 | 1730 |
| 1000 | 100% | 3129 | 6368 | 8508 |

Connection time grows with online population — consistent with `broadcastOnlinePresence` cost on each `register`.

---

## Message Metrics

| Tier | Attempted | Send OK | Send Fail | Rate |
|---:|---:|---:|---:|---:|
| 100 | 19 | 19 | 0 | 5/s |
| 250 | 70 | 70 | 0 | 5/s |
| 500 | 90 | 90 | 0 | 5/s |
| 1000 | 75 | 75 | 0 | 4/s |

Duplicate persist samples: **0**. Message loss (deliveryFail): **0**.

---

## Delivery Metrics

| Tier | Delivery OK | Fail | Wrong recipient | Cross-tenant |
|---:|---:|---:|---:|---:|
| 100 | 19 | 0 | 0 | 0 |
| 250 | 70 | 0 | 0 | 0 |
| 500 | 90 | 0 | 0 | 0 |
| 1000 | 75 | 0 | 0 | 0 |

---

## Latency p50/p95/p99

**Private DM end-to-end (send → `message:receive`), medium rate:**

| Tier | p50 | p95 | p99 | max |
|---:|---:|---:|---:|---:|
| 100 | 737 | 2419 | 2419 | 2419 |
| 250 | 74 | 98 | 241 | 241 |
| 500 | 71 | 76 | 136 | 136 |
| 1000 | 68 | **135** | **421** | 421 |

Cold-start inflation at tier 100; steady-state after warmup is sub-150ms p95.

---

## CPU

Peak across suite: **10.8%** (tier 500). Tier 1000 peak sample **6.2%**.  
No CPU saturation at tested rates.

---

## Memory

| Tier | Peak RSS MB | Heap used MB |
|---:|---:|---:|
| 100 | 133.6 | 58.3 |
| 250 | 188.7 | 81.4 |
| 500 | 268.8 | 107.1 |
| 1000 | **303.1** | 124.2 |

Linear-ish growth; ~0.3 MB RSS per socket at 1k (includes Node baseline).

---

## Event Loop

Peak p99 across suite: **~35ms**. No event-loop starvation observed at medium DM rates.

---

## MongoDB

- Isolated DB; Message writes for every successful DM.
- No saturation signals at tested write rates (single-digit msg/s overall).
- Unread/contacts not under continuous poll storm in this run.
- Classification: **STABLE** for this load profile.

Index creation: schema indexes on empty DB (no blind new indexes added).

---

## Redis

**NOT USED** in this run.

Private DM + presence worked via in-process Map + memory Socket.IO adapter.

Classification: **NOT USED** (optional for single-node; still required for multi-instance — Phase 9).

---

## Socket.IO

- 1000 concurrent websocket clients: **STABLE** for hold + DM
- Engine clientsCount peaked ~1050 during reconnect overlap
- Presence register storms dominate connect latency
- Classification: **STABLE** (connect latency grows; reconnect partial at 1k)

---

## Contacts

| Actor | HTTP ms | Bytes | Count |
|---|---:|---:|---:|
| Student | 14 | 13 KB | 46 |
| Support | 14 | 134 KB | 460 |
| HIGH_ADMIN | 12 | 145 KB | 499 |

At **current seed size (~1k users)** contacts remain fast. Phase 9 P2 (unbounded HIGH_ADMIN lists) remains a **future** risk if org size ≫ test dataset — not a measured bottleneck here.

---

## Broadcast

`POST /api/messages/broadcast` (STAFF, CSRF + JWT):

- Targets: **175** students (branch-scoped STAFF filter)
- Duration: **352ms**
- Status 200

Validates O(targets) insertMany + per-receiver emit remains acceptable at hundreds of targets. Not stress-tested at thousands of targets.

---

## Reconnect

| Tier | Attempted | Success | Failures | Notes |
|---:|---:|---:|---:|---|
| 500 | 50 | 50 | 0 | p95 reconnect ~5.2s |
| 1000 | 100 | **90** | **10** | p95 ~40s; DEGRADED |

First clear soft bottleneck under churn: **reconnect/presence re-registration** while 1k sockets remain online.

---

## Multi-tab

Two sockets for one SUPPORT user: both connected. Behavior unchanged: **latest presence socketId wins** (not redesigned).

---

## Security / Isolation Verification

Under all measured DM traffic:

| Check | Result |
|---|---|
| Wrong recipient | **0** |
| Cross-tenant delivery | **0** |
| Duplicate persistence (sampled) | **0** |
| Message loss | **0** |
| Security stop triggered | **No** |

No P0 isolation failure — performance testing continued to completion.

---

## Bottleneck Analysis

**First bottleneck (measured):** Socket **presence broadcast / connection ramp**, not Mongo or CPU for private DM.

Evidence:

1. Connect latency scales from p95 ~128ms @100 → **~6.4s @1000**
2. Each `register` triggers `broadcastOnlinePresence` (O(online users / rooms))
3. CPU/RSS remain comfortable at 1k
4. Steady DM p95 stays ~70–135ms after warmup
5. Reconnect failures appear at 1k churn

**Not the bottleneck at tested rates:** MongoDB write path, Redis (unused), heap exhaustion.

---

## Capacity Estimate

| Scenario | Estimate |
|---|---|
| Single-node concurrent sockets (this machine) | **≥1,000 proven** for hold + low/medium DM |
| Single-node reconnect storms | Soft limit near **1,000** (10% fail in test) |
| Private DM throughput | Comfortable at **4–10 msg/s overall** in this harness; higher not required for proof |
| Multi-instance | **Unknown / LIMITED** without Redis adapter + shared presence (not load-tested) |

---

## 1,000 User Verdict

```text
1,000 concurrent users: PROVEN
```

Proven parameters:

| Field | Value |
|---|---|
| Test duration | ~6.8 minutes wall (tiered ramp) |
| Client count | 1000 concurrent sockets |
| Message rate | 4 msg/s overall (medium) at tier 1000 |
| p95 delivery latency | 135 ms |
| p99 delivery latency | 421 ms |
| Peak CPU | 10.8% (suite) / 6.2% (tier 1000 sample) |
| Peak RAM | 303.1 MB RSS |
| MongoDB | STABLE |
| Redis | NOT USED |
| Error rate (DM) | 0% |
| Wrong recipient | 0 |
| Caveat | Reconnect 90/100; single-node only; not multi-instance |

---

## Findings

### P0 — security/data isolation

None.

### P1 — production correctness

None under load.

### P2 — scalability

1. **Presence broadcast** makes connection time grow with online users.
2. **Reconnect under 1k** showed 10% failures — improve reconnect backoff / presence storm control before marketing “seamless reconnect at 1k”.
3. **Broadcast O(targets)** OK at 175; still a cost center at much larger fanout.
4. Multi-instance still requires Redis adapter + shared presence (unproven here).

### P3 — observability / harness

1. `console.log` on every connect/disconnect remains noisy at 1k (not removed this phase).
2. High-rate probe after reconnect at 500 invalidated by harness stale socket map (measurement bug, not app bug).

### P4 — cleanup

Phase 10 DB `dashboardthangtinhoc_p10load` may be dropped when convenient.

---

## Recommended Upgrades

1. Reduce presence fanout cost (debounce / delta presence) — **only if** product needs faster mass connect/reconnect.
2. Enable Redis adapter + Redis presence before **multi-instance** deploy.
3. Soften socket lifecycle `console.log` at scale.
4. Re-test reconnect storms with client backoff after any presence change.

## Not Recommended

- Kafka / microservices / new broker
- Redesign Conversation / `Message.isRead`
- Adding indexes without a measured slow query
- Claiming multi-instance capacity from this single-node run

---

## Application Code Changes

| File | Change |
|---|---|
| `server.js` | Gated loopback `/__phase10/stats` when `PHASE10_LOADTEST=1` |
| `tests/load/messaging/*` | **NEW** harness + runner |
| `artifacts/phase10-load-evidence.json` | Evidence |
| `docs/messaging/PHASE_10_REPORT.md` | This report |

**No** changes to MessagingPolicy, pairing, contacts service, Message/Conversation schemas, unread model, notifyUser semantics, or SUPPORT transportRole.

---

## Known Limitations

- Single developer workstation / single Node process
- Controlled message rate (not pathological flood)
- Redis path not exercised
- Multi-instance not tested
- Broadcast tested at 175 targets only
- Isolation witness set capped at 40 sockets per message (not full 999 scan)

---

## Final Architecture Score

| Dimension | Score | Evidence |
|---|---:|---|
| Correctness | 9 | Phase 8 + Phase 10 wrongRecipient=0 |
| Security / Isolation | 9 | 0 cross-tenant under load |
| Debuggability | 8 | Phase 9 traces |
| Observability | 7 | Stats probe + counters |
| Performance | 8 | DM p95 135ms @1k after warmup |
| Scalability | 8 | 1k PROVEN single-node; reconnect caveat |
| Maintainability | 8 | Canonical DMS |
| Testability | 9 | Live + load harnesses |

**Overall: 8.4 / 10**

---

## Next Phase

**STOP** — await approval for Phase 11.

Do not implement speculative optimizations until product prioritizes a measured bottleneck (presence fanout / reconnect / multi-instance).
