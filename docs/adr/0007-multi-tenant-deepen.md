# ADR 0007 — Multi-tenant deepen (Mongo) / defer Postgres

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

Phase 0–14 đã cứng multi-branch, ledger, RBAC. Tenant model đã có (bọc Branch) nhưng scope Super Admin + sync `tenantId` còn mỏng. Brief gốc nhắc PostgreSQL/Prisma — **không** big-bang migrate lúc này.

## Decision

### 1. Tenant = lớp bao Branch (Mongo)

| Lớp | Vai trò |
|-----|---------|
| **Tenant** | Tổ chức (code, status, maxBranches) |
| **Branch** | Chi nhánh vận hành (`branchId` trên entity) |
| **User** | Role + Permission + Scope(branch) + optional tenant header (Super Admin) |

- Super Admin: `X-Tenant-Id` / `?tenant_id=` → giới hạn `branchFilter` trong các branch của tenant.
- Non-super: **bỏ qua** header tenant (không escalate).
- Tenant `suspended`: từ chối scope (không xem dữ liệu tenant đó).
- Default tenant `MAIN`: gán branch orphan khi boot (`ensureDefaultTenant`).

### 2. `tenantId` trên entity nóng

Student / Teacher / Course / Ledger / Audit / Outbox: `tenantId` nullable.  
Khi `assignBranch(tenant, branch)` → backfill `tenantId` cho entity thuộc branch (best-effort).

### 3. Optional Postgres — **deferred**

- **Không** migrate Mongo → Postgres trong Phase 15.
- Điều kiện mở ADR PG sau: dual-write plan, read-replica strategy, freeze schema 2 tuần.
- Stub policy: `utils/tenantScope.js` → `POSTGRES_OPTIONAL.enabled = false`.

## Consequences

- Harden `branchFilter` + `applyTenantScopeIfAny` (adminRole từ DB).
- Isolation test: branch sets tenant A ∩ B = ∅.
- Gate Phase 15 PASS **không** yêu cầu Prisma/PG chạy.

## Non-goals

- Tenant-admin role đầy đủ (chỉ Super Admin chọn tenant).
- Row-level PG RLS.
- Tách DB per tenant.
