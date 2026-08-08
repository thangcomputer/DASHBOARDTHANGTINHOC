# CQRS Phase A–C — Rollout checklist

Strangler CQRS trên layout phẳng hiện tại (`routes/` + `services/cqrs/` + `shared/outbox/`).

**Không** mount toàn bộ `modules/` ảo — chỉ endpoint đã wire + feature flag.

## Flags (mặc định tắt)

| Biến | Endpoint | Hành vi khi bật |
|------|----------|-----------------|
| `ENABLE_CQRS_TEACHER` | `POST /api/teachers` | Teacher + Outbox cùng transaction; welcome qua Outbox |
| `ENABLE_CQRS_INVOICE` | `POST /api/invoices` | Invoice + Outbox cùng transaction; PDF qua Outbox |
| `ENABLE_CQRS_STUDENT_CREATE` | `POST /api/students` | Legacy create + Outbox welcome (TX full student+ledger = follow-up) |

## MongoDB replica set

Bắt buộc khi bật teacher/invoice CQRS (multi-doc transaction).

Docker Compose đã cấu hình `mongo --replSet rs0` và URI:

```text
mongodb://mongo:27017/dashboardthangtinhoc?replicaSet=rs0
```

`validateEnv`: flag CQRS bật mà URI không có `replicaSet=` / `mongodb+srv` → warn (dev) / throw (prod).

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

## Thứ tự bật staging (khuyến nghị)

1. Replica set OK (`rs.status()` PRIMARY)
2. Sync indexes / collections sẵn sàng
3. Bật `ENABLE_CQRS_TEACHER=true` → tạo GV → kiểm Outbox `PROCESSED`
4. Bật `ENABLE_CQRS_INVOICE=true` → tạo HĐ → PDF queue
5. Bật `ENABLE_CQRS_STUDENT_CREATE=true` → welcome async
6. Prod: từng flag, có thể tắt ngay để rollback

## Rollback

```env
ENABLE_CQRS_TEACHER=false
ENABLE_CQRS_INVOICE=false
ENABLE_CQRS_STUDENT_CREATE=false
```

Restart API. Middleware auth/branch không đổi.

## Code map

| Thành phần | Path |
|------------|------|
| Flags | `shared/cqrs/flags.js` |
| Transaction helper | `shared/cqrs/withTransaction.js` |
| Outbox model/worker | `shared/outbox/` |
| Teacher CQRS | `services/cqrs/createTeacherCqrs.js` |
| Invoice CQRS | `services/cqrs/createInvoiceCqrs.js` |
| Student outbox | `services/cqrs/enqueueStudentCreatedOutbox.js` |
| Stranglers | `routes/teacherRoutes.js`, `invoiceRoutes.js`, `studentRoutes.js` |
