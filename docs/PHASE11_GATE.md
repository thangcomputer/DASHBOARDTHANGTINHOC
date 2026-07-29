# Phase 11 Gate — Rating moderation

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 6 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Schema | `Evaluation.status` pending\|approved\|rejected\|hidden + moderatedBy/At/Note + stars |
| Service | `services/ratingLifecycleService.js` |
| Submit | `POST /api/evaluations` → `submitTeacherRating` (default **pending**) |
| Moderate | `PUT /api/evaluations/:id/moderate` — approve\|reject\|hide |
| Queue | `GET /api/evaluations/admin/ratings` |
| Public | `GET /teacher/:id` + teacher list chỉ `approved` (+ legacy không status) |
| Notify | GV chỉ khi **approved** (không lúc pending) |
| ACL | Admin/Staff + `VIEW_EVALUATIONS` |
| Client | `evaluations.moderate` / `getAdminRatings`; không toast GV khi pending |
| Tests | `tests/integration/ratingPhase11.test.js` |

## State machine

```
pending → approved | rejected
approved → hidden | rejected
hidden → approved
rejected → pending (mở lại)
```

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | pending không public | PASS (test) |
| 2 | aggregate chỉ approved | PASS (test) |
| 3 | Moderate ACL trên route | PASS (static) |
| 4 | Teacher list filter public | PASS (static) |
| 5 | Schema moderation fields | PASS |
| 6 | Notify chỉ khi approved | PASS (static service) |

## Không làm (Phase 12+)

- UI hàng đợi duyệt đầy đủ trên Admin dashboard
- Reward % từ sample approved
- Branch setting `ratings.requireModeration` trên model Branch (dùng env `RATING_REQUIRE_MODERATION`)

## Kết luận

**PASS** — Phase 11 tests xanh (`ratingPhase11.test.js`).

Phase tiếp theo: **Phase 12 — Reward**.
