# CQRS Phase A–C — Rollout checklist

Hướng mới trên layout phẳng (`routes/` + `services/cqrs/` + `shared/outbox/`).
**Luồng cũ (create/pay/refund không TX) đã gỡ** — không còn dual-path strangler.

## Policy flag

Mỗi flag (`ENABLE_CQRS_TEACHER` / `INVOICE` / `STUDENT_CREATE` / `FINANCE`):

1. Explicit `false`/`0` → tắt endpoint (503)
2. Explicit `true`/`1` → bật
3. Master `ENABLE_CQRS=false` → tắt tất cả
4. **Unset → bật nếu `MONGODB_URI` có `replicaSet=` hoặc `mongodb+srv`**

| Biến | Endpoint | Hành vi |
|------|----------|---------|
| `ENABLE_CQRS_TEACHER` | `POST /api/teachers` | Teacher + Outbox cùng TX; welcome qua Outbox |
| `ENABLE_CQRS_INVOICE` | `POST /api/invoices` | Invoice + Outbox cùng TX; PDF qua Outbox |
| `ENABLE_CQRS_STUDENT_CREATE` | `POST /api/students` | Student (+ Invoice + Ledger nếu paid) + Outbox welcome |
| `ENABLE_CQRS_FINANCE` | pay/refund HV, enrollment, SePay, chi lương GV, confirm/cancel phiếu, void ledger | Claim/ledger trong một TX |

## MongoDB replica set

Bắt buộc cho hướng mới (multi-doc transaction).

Docker Compose: `mongo --replSet rs0` và URI:

```text
mongodb://mongo:27017/dashboardthangtinhoc?replicaSet=rs0
```

`validateEnv`: CQRS bật mà URI không có `replicaSet=` / `mongodb+srv` → warn (dev) / throw (prod).

## Outbox

| Biến | Ý nghĩa |
|------|---------|
| `RUN_OUTBOX_WORKER` | `1` chạy dispatcher; `0` tắt |
| `OUTBOX_LEASE_MS` | Reclaim `PROCESSING` kẹt (mặc định 60000) |

Docker: API `RUN_OUTBOX_WORKER=0`, worker `=1`.

Events:

- `TeacherCreatedEvent` → welcome + `teacher:new`
- `StudentCreatedEvent` → welcome
- `InvoiceCreatedEvent` → enqueue PDF

Ops: `GET /api/monitoring/outbox` (admin) — `pending` / `processing` / `failed` / `processedRecent`.
Overview alerts: `OUTBOX_FAILED`, `OUTBOX_BACKLOG`, `OUTBOX_WORKER_OFF`.

## Staging / prod

1. Replica set OK (`rs.status()` PRIMARY)
2. Sync indexes
3. Để trống flag (auto-on với RS) hoặc bật tường minh
4. Smoke:
   - Staging RS: `npm run cqrs:smoke`
   - Local không Mongo: `npm run cqrs:smoke:memory` (mongodb-memory-server)
   - TX tests: `npm run test:cqrs`
5. Tạo GV / HĐ / HV / pay / lương → kiểm Outbox `PROCESSED` + ledger
6. Kill-switch tạm: `ENABLE_CQRS=false` (endpoint trả 503 — **không** quay lại legacy)

## Modular layout (nhẹ)

- `services/cqrs/index.js` — barrel export (không mount `modules/` ảo)
- `shared/cqrs/middleware.js` — `requireFinanceCqrs` / teacher / invoice / student
- Routes vẫn phẳng; middleware gắn trước handler money/create

## Rollback vận hành

```env
ENABLE_CQRS=false
```

Hoặc tắt từng flag. Restart API. Middleware auth/branch không đổi.
Muốn chạy lại luồng cũ phải revert code — không còn path song song.

## Code map

| Thành phần | Path |
|------------|------|
| Flags | `shared/cqrs/flags.js` |
| Transaction helper | `shared/cqrs/withTransaction.js` |
| Outbox model/worker | `shared/outbox/` |
| Teacher / Invoice create | `services/cqrs/createTeacherCqrs.js`, `createInvoiceCqrs.js` |
| Pay / Refund | `services/cqrs/payStudentCqrs.js`, `refundStudentCqrs.js` |
| Enrollment pay / add-paid / cancel | `payEnrollmentCqrs.js`, `addEnrollmentPaidCqrs.js`, `cancelEnrollmentCqrs.js` |
| SePay settle | `services/cqrs/sepaySettleCqrs.js` |
| Teacher salary pay | `payTeacherFlexibleCqrs.js`, `payTeacherAllCqrs.js` |
| Confirm/cancel/void/discount | `salaryTransactionCqrs.js`, `postDiscountCqrs.js` |
| Barrel + middleware | `services/cqrs/index.js`, `shared/cqrs/middleware.js` |
| Smoke script | `scripts/cqrs-smoke.js` |
| Tuition invoice helper | `services/cqrs/tuitionInvoice.js` |
| Outbox stats | `shared/outbox/stats.js` → `GET /api/monitoring/outbox` |
| Routes | `routes/teacherRoutes.js`, `invoiceRoutes.js`, `studentRoutes.js`, `webhookRoutes.js` |
