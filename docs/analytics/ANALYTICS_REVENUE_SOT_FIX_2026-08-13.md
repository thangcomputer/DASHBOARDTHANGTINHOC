# Analytics Revenue SoT Fix

**Date:** 2026-08-13

## Root cause

| Surface | Before | Problem |
|---------|--------|---------|
| KPI cards | Ledger `sumFinancialRevenue` / `postedAt` | OK |
| Revenue chart `timeSeries` | Enrollment `listPaidItems` / `paidAt` | **SoT mismatch** → empty chart while KPI > 0 |
| `1d` (“Hôm nay”) | `now - 1 day` rolling 24h | Label ≠ semantics; axis showed yesterday+today |
| Day buckets | `toISOString().slice(0,10)` (UTC) | VN midnight shift |

## Fixed

- Revenue **KPI + timeSeries + byBranch** → **Ledger** (net = payment − refund)
- `1d` → **calendar today 00:00 Asia/Ho_Chi_Minh → now**
- Previous `1d` → yesterday 00:00 → same clock elapsed
- Bucket labels via `$dateToString` + `timezone: Asia/Ho_Chi_Minh` / `utils/vnTimezone.js`
- Enrollment endpoint remains **ops-only** (registration metrics), not financial SoT
- FE shows explicit 0 state + Ledger subtitle

## Files changed

- `utils/vnTimezone.js` **(new)**
- `services/ledgerService.js` — VN timezone buckets; `aggregateNetRevenueTimeSeries`; `sumFinancialRevenueByBranch`
- `routes/analyticsRoutes.js` — revenue endpoint Ledger-only for money
- `client/src/components/RevenueAnalyticsTab.jsx` — 0đ / empty clarity
- `tests/unit/analytics_revenue_sot.test.js`
- `docs/analytics/ANALYTICS_REVENUE_SOT_FIX_2026-08-13.md`

## Tests

| Case | Result |
|------|--------|
| Revenue SoT (no listPaidItems in revenue route) | PASS |
| Calendar day `1d` | PASS |
| Timezone VN vs UTC | PASS |
| Refund net definition | PASS |
| 7d bucket span | PASS |

Command: `node --test tests/unit/analytics_revenue_sot.test.js`

## Safety

| Item | Status |
|------|--------|
| Database schema | UNCHANGED |
| Ledger data | UNCHANGED |
| Enrollment data | UNCHANGED |
| Production DB writes | 0 |
| Auth / RBAC / branchFilter | UNCHANGED |
| Messaging / Scheduling / Attendance | UNCHANGED |
| Finance transaction / SePay flows | UNCHANGED |

## Residual

- Enrollment tab still shows ops tuition from enrollment.paid (labeled as ops, not Ledger).
- Multi-day periods snap to VN calendar day starts (7/30/… days) instead of pure rolling hours — intentional for chart buckets.
- Integration DB tests for live Ledger aggregation not added in this patch (unit + route source assertion).

## Verdict

**PASS**
