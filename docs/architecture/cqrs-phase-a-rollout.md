# CQRS Phase A — Rollout checklist

Tài liệu vận hành cho **Giai đoạn A**: củng cố slice CQRS đã có (Student create, Invoice create) trước khi mở rộng sang Teacher / domain khác.

## Mục tiêu

| Mục | Trạng thái mục tiêu |
|-----|---------------------|
| MongoDB replica set cho multi-doc transaction | Bắt buộc khi bật bất kỳ `ENABLE_CQRS_*` |
| Outbox không dispatch trùng khi multi-instance | `RUN_OUTBOX_WORKER` + atomic lease |
| Rollout `ENABLE_CQRS_STUDENT_CREATE` có kiểm soát | Staging → prod |
| Invoice CQRS (`ENABLE_CQRS_INVOICE`) sẵn sàng test | Flag tắt mặc định |

## 1. MongoDB replica set

CQRS path dùng `session.withTransaction()` (Student + Invoice + Ledger + Outbox). **Standalone Mongo không hỗ trợ.**

### Docker Compose (khuyến nghị local/staging)

`docker-compose.yml` đã chạy `mongo --replSet rs0` và healthcheck `rs.initiate`.

URI API/worker:

```text
mongodb://mongo:27017/dashboardthangtinhoc?replicaSet=rs0
```

### Local mongod

```bash
# ví dụ single-node rs0
mongod --replSet rs0 --port 27017
mongosh --eval 'rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:27017"}]})'
```

`.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dashboardthangtinhoc?replicaSet=rs0
```

`validateEnv`: nếu có flag CQRS bật mà URI không có `replicaSet=` / `mongodb+srv` → **warning (dev)** / **throw (prod)**.

## 2. Feature flags

| Biến | Endpoint | Mặc định |
|------|----------|----------|
| `ENABLE_CQRS_STUDENT_CREATE` | `POST /api/students` | tắt |
| `ENABLE_CQRS_INVOICE` | `POST /api/invoices` | tắt |
| `ENABLE_CQRS_TEACHER` | `POST /api/teachers` | tắt |

Chỉ nhận giá trị `true` / `1` mới bật (xem strangler trong `routes/studentRoutes.js`, `routes/invoiceRoutes.js`).

## 3. Outbox worker

| Biến | Ý nghĩa |
|------|---------|
| `RUN_OUTBOX_WORKER` | `1` (mặc định) chạy dispatcher; `0` tắt |
| `OUTBOX_POLL_MS` | Chu kỳ poll (mặc định 5000) |
| `OUTBOX_LEASE_MS` | Timeout reclaim `PROCESSING` kẹt (mặc định 60000) |

**Single process API:** để mặc định — Outbox chạy trong `server.js`.

**Docker Compose / multi-API:**

- API: `RUN_OUTBOX_WORKER=0`
- `worker` service: `RUN_OUTBOX_WORKER=1` (cùng BullMQ)

Claim dùng `findOneAndUpdate` trên `PENDING` hoặc `PROCESSING` hết lease → tránh duplicate khi scale.

## 4. Checklist bật `ENABLE_CQRS_STUDENT_CREATE` (staging)

1. [ ] `MONGODB_URI` có `replicaSet=` (hoặc Atlas `mongodb+srv`)
2. [ ] `rs.status()` PRIMARY OK
3. [ ] Flag **tắt** trên production khi test staging
4. [ ] Chạy: `node tests/api/student_cqrs_migration.test.js` (hoặc suite CI tương đương)
5. [ ] Chạy: `node tests/api/transaction_rollback.test.js`
6. [ ] Smoke tạo HV qua UI/API — response còn `tempPassword` / invoice như FE expect
7. [ ] Quan sát collection `outboxevents`: `PENDING` → `PROCESSED` (không stuck)
8. [ ] Bật flag staging 24–48h; so sánh lỗi / rollback
9. [ ] Production: bật flag + monitor; giữ khả năng tắt ngay (`ENABLE_CQRS_STUDENT_CREATE=false`)

## 5. Checklist `ENABLE_CQRS_INVOICE`

1. [ ] Replica set như trên
2. [ ] Staging: tạo hóa đơn thủ công `POST /api/invoices` với flag bật
3. [ ] So contract JSON với legacy (flag tắt)
4. [ ] Outbox `InvoiceCreatedEvent` được xử lý (PDF side-effect nếu đã subscribe)
5. [ ] Chỉ bật prod sau khi student CQRS ổn định

## 6. Rollback

```env
ENABLE_CQRS_STUDENT_CREATE=false
ENABLE_CQRS_INVOICE=false
```

Restart API. Middleware auth/branch không đổi — chỉ nhánh handler bên trong route.

## 7. Liên quan code

| Thành phần | Path |
|------------|------|
| Validate CQRS + replica | `config/validateEnv.js` |
| Student strangler | `routes/studentRoutes.js` |
| Invoice strangler | `routes/invoiceRoutes.js` |
| Teacher strangler | `routes/teacherRoutes.js` (`ENABLE_CQRS_TEACHER`) |
| Outbox worker | `shared/outbox/OutboxWorker.js` |
| Docker | `docker-compose.yml` |

## 8. Checklist `ENABLE_CQRS_TEACHER` (Giai đoạn B — đã wire)

`routes/teacherRoutes.js` đã có strangler (2026-08).

1. [x] Replica set (local staging: `127.0.0.1:27018?replicaSet=rs0`)
2. [x] `node test_teacher_migration.js` — legacy 201, CQRS 201 + Outbox, rollback sạch
3. [ ] Staging UI: tạo GV với flag bật — còn `tempPassword`
4. [ ] Outbox `TeacherCreatedEvent` → `PROCESSED` (cần subscriber welcome nếu muốn gửi mail)
5. [ ] Bật prod sau student (+ invoice nếu đã ổn)

**Lưu ý staging đã chạy:** syncIndexes / createCollection **trước** multi-doc TX (tránh catalog/lock errors trên DB mới).
