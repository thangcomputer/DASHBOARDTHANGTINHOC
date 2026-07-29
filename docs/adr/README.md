# ADR — Architecture Decision Records (LMS / ERP Multi-Branch)

**Track:** Business completeness (khác với roadmap hardening Phase 1–20 đã Done trong `docs/ROADMAP_REVIEW.md`).

**Nguyên tắc:** Mỗi phase chỉ bắt đầu khi phase trước **PASS** checklist gate. Stack hiện tại: **MongoDB + Mongoose + Express**. Không migrate Postgres/Prisma trong track này trừ khi có ADR riêng sau.

| ADR | Chủ đề | Status |
|-----|--------|--------|
| [0001](./0001-soft-delete-and-accounting.md) | Soft delete khóa học + accounting / ledger | Accepted |
| [0002](./0002-display-codes.md) | Mã định danh hiển thị (HV/GV/AD/ST) | Accepted |
| [0003](./0003-rating-moderation.md) | Đánh giá giảng viên + moderation | Accepted |
| [0004](./0004-glossary-and-state-machines.md) | Glossary + state machines | Accepted |
| [0005](./0005-notification-and-audit-baseline.md) | Notification + Audit baseline | Accepted |
| [0006](./0006-rbac-matrix.md) | RBAC Role × Permission × Scope | Accepted |
| [0007](./0007-multi-tenant-deepen.md) | Multi-tenant deepen / defer Postgres | Accepted |

**Roadmap triển khai:** [../ROADMAP_LMS_ERP.md](../ROADMAP_LMS_ERP.md)

**Phase 0 gate:** [../PHASE0_GATE.md](../PHASE0_GATE.md)
