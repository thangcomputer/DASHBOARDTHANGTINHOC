# Phase 12 Gate — Reward

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 11 + 10 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Models | `RewardRule`, `RewardPayout` |
| Service | `services/rewardService.js` — pct_5star, minSample, period job, approve→ledger |
| API | `/api/rewards/rules`, `/run`, `/payouts`, `/approve`, `/reject`, `/preview` |
| Ledger | `source: reward`, `type: adjustment` debit khi chi thưởng |
| Cron | `REWARD_CRON` ngày 1 hàng tháng 02:00 VN (kỳ tháng trước) |
| Notify | GV khi payout paid |
| Audit | `reward.draft` / `reward.approve` / `reward.payout` / `reward.reject` |
| Tests | `tests/integration/rewardPhase12.test.js` |

## Công thức

```
sample = ratings approved (không đếm pending/rejected)
pct_5star = fiveStar / sample × 100
qualifies = sample ≥ minRatings AND pct_5star ≥ thresholdPct
amount = qualifies ? rule.amount : 0
```

## Gate fixture

| Input | Kết quả |
|-------|---------|
| 10 HV approved, 8×5★ | pct = **80%** |
| rule: ≥80%, min 10, 500.000đ | amount = **500.000** |
| pending/rejected không đếm | PASS |
| 9 ratings dù 100% 5★ | amount = **0** (thiếu minSample) |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Fixture 10/8×5★ → 500.000đ | PASS |
| 2 | minSample bắt buộc | PASS |
| 3 | Chỉ đếm approved | PASS |
| 4 | Models + idempotent payout key | PASS |
| 5 | Routes + cron wired | PASS |
| 6 | Ledger source reward | PASS |

## Không làm (phase sau)

- UI Admin đầy đủ quản lý rule/payout
- Gộp tự động vào Transaction lương buổi (Phase 13)
- Multi-metric ngoài `pct_5star`

## Kết luận

**PASS** — Phase 12 tests xanh (`rewardPhase12.test.js`).

Phase tiếp theo: **Phase 13 — Session payroll**.
