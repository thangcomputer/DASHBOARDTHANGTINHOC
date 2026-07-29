# Phase 14 Gate — Dashboard & Optimization

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 1–13 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Service | `services/dashboardKpiService.js` |
| KPI split | `operational` (catalog/HV/lịch) ≠ `financial` (`ledgerNet`) |
| API | `GET /api/analytics/kpi`, `/queue-metrics`, `POST /audit/archive` |
| Revenue label | `/analytics/revenue` → `source: operational_enrollment` |
| Soft-delete | Ops catalog giảm; financial net không đổi |
| Queue metrics | `queueMode` + DomainOutbox pending/failed |
| Audit archive | `archivedAt` — ẩn, **không xóa** |
| Notify load | Idempotent accuracy helper (100→1 delivered) |
| Tests | `tests/integration/dashboardPhase14.test.js` |

## DoD — không trộn KPI

```
operational.activeCourses     ← Course.deletedAt = null
financial.ledgerNet           ← Σ LedgerEntry (payment − refund)
❌ financial ≠ Course.price × count
❌ soft-delete course ≠ giảm ledgerNet
```

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Ops vs financial sources khác nhau | PASS |
| 2 | Reject mixed / course_price financial | PASS |
| 3 | Soft-delete: financial unchanged | PASS |
| 4 | Notify load idempotent accuracy | PASS |
| 5 | /kpi + archive + queue routes | PASS |
| 6 | AuditLog.archivedAt | PASS |

## Không làm

- Viết lại toàn bộ UI Admin dashboard charts
- BullMQ dashboard UI
- Hard-delete audit

## Kết luận

**PASS** — Phase 14 tests xanh (`dashboardPhase14.test.js`).

Roadmap business track Phase 0–14 hoàn tất; Phase 15 (multi-tenant / optional PG) là bước tùy chọn sau.
