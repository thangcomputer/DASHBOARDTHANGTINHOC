# QA Progress — Redis → Refund → Reassign

**Date:** 2026-07-29  
**Order executed:** Redis staging → Refund E2E → Reassign E2E (UI chưa làm)

## 1. Redis staging — PASS

- Redis process: `/www/server/redis` (BT panel), có `requirepass`
- Đã ghi `REDIS_URL=redis://:***@127.0.0.1:6379` vào app `.env` (không in secret)
- `GET /healthz` → `ok=true`, **`redis=up`**, `queue=bullmq`
- Scripts: `scripts/qa_fix_redis_url_staging.cjs` (alias: `qa_enable_redis_staging.cjs`)

> Lưu ý: lần đầu ghi `redis://127.0.0.1:6379` không password làm `redis=down`. Đã sửa bằng password từ `/www/server/redis/redis.conf`.

## 2. Refund E2E — PASS (9/9) sau fix partial

Report: `docs/QA_REFUND_E2E_REPORT.md` · Script: `scripts/qa_refund_e2e.cjs`  
Service: `services/refundService.js` · Route: `PUT /api/students/:id/refund`

| ID | Case | Result |
|----|------|--------|
| REF-01..07 | Full refund + ledger + invoice + audit + double-guard | PASS |
| REF-08 | Partial `amount=500000` → paid=true, paidAmount=2.000.000 | PASS |
| REF-09 | Over-refund → 400 | PASS |

### Fix đã làm
- Body `amount` optional: omit/full amount = hoàn toàn bộ; partial = giảm `paidAmount`, giữ access
- Ledger `type=refund` đúng số tiền partial
- Unit: `tests/integration/refundPartial.test.js`

## 3. Reassign E2E — PASS (8/8)

Report: `docs/QA_REASSIGN_E2E_REPORT.md` · Script: `scripts/qa_reassign_e2e.cjs`

Scenario: 8 completed GV-A + 12 scheduled → gán GV-B

| ID | Case | Result |
|----|------|--------|
| REA-01 | API assign-teacher 200 | PASS |
| REA-02 | Completed giữ GV A = 8 | PASS |
| REA-03 | Future chuyển GV B = 12 | PASS |
| REA-04 | enrollment.teacherId = B | PASS |
| REA-05 | progress 8/12 không reset | PASS |
| REA-06 | grades giữ | PASS |
| REA-07 | assignment giữ | PASS |
| REA-08 | meta.progressPreserved | PASS |

## 4. UI Golden Paths — PASS (7/7)

Report: `docs/QA_UI_GOLDEN_PATHS_REPORT.md` · Script: `node scripts/qa_ui_golden_paths.cjs`

| ID | Flow | Result |
|----|------|--------|
| UI-ADMIN-01/02 | Admin search HV + xác nhận thanh toán enrollment | PASS |
| UI-GV-01/02 | GV thấy HV + nút điểm danh sẵn sàng | PASS |
| UI-HV-01 | HV vào `#schedule` (đã login) | PASS |
| UI-STAFF-01/02 | Staff CN1 ẩn CN2, thấy CN1 | PASS |

### Fix kèm theo (để UI list không trống)
- `StudentsContext`: không reset `adminQuery` khi `/auth/me` refresh cùng user
- `GET /api/auth/me` (hardcoded admin): trả `adminRole: SUPER_ADMIN`

## 5. Next

1. Commit/deploy khi bạn yêu cầu  
2. (Optional) CAPTCHA login UI thật · Socket matrix · Local Redis

## Regression command

```bash
node scripts/qa_fix_redis_url_staging.cjs
node scripts/qa_refund_e2e.cjs
node scripts/qa_reassign_e2e.cjs
```
