# Phase 15 Gate — Multi-tenant deepen / defer Postgres

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 0–14 PASS (branch + ledger + RBAC cứng)

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| ADR | `docs/adr/0007-multi-tenant-deepen.md` |
| Scope utils | `utils/tenantScope.js` — merge filter, isolation, spoof guard |
| Auth harden | `req.user.adminRole` từ DB trước `X-Tenant-Id`; non-super bỏ qua header |
| Suspended | Tenant suspended → 400 `INVALID_TENANT` |
| Assign branch | Sync `tenantId` xuống Student/Teacher (+ Course nếu có branchId) |
| Backfill | `POST /api/tenants/backfill-tenant-ids` (dryRun mặc định) |
| Postgres | **Deferred** — `POSTGRES_OPTIONAL.enabled = false` |
| Tests | `tests/integration/tenantPhase15.test.js` |

## Mô hình

```
Tenant (tổ chức)
  └── Branch[] (chi nhánh)
        └── Student / Teacher / Schedule… (branchId + tenantId nullable)
```

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Chỉ Super Admin dùng X-Tenant-Id | PASS |
| 2 | Filter merge cô lập branch theo tenant | PASS |
| 3 | Isolation A ∩ B = ∅ | PASS |
| 4 | adminRole gắn trước tenant scope | PASS (static) |
| 5 | Không migrate Prisma/PG | PASS |
| 6 | ADR 0007 + backfill API | PASS |

## Không làm (đúng ADR)

- Big-bang Mongo → Postgres/Prisma
- Tenant-admin role đầy đủ
- DB-per-tenant / PG RLS

## Kết luận

**PASS** — Phase 15 tests xanh (`tenantPhase15.test.js`).

**Roadmap LMS/ERP business track Phase 0–15 hoàn tất** trên Mongo. Postgres chỉ khi có ADR + dual-write riêng.
