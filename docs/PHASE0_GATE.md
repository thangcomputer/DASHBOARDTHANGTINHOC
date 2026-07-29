# Phase 0 Gate — Architecture freeze

**Ngày:** 2026-07-29  
**Mục tiêu:** Chốt glossary, state machines, soft-delete/accounting, display code, rating moderation, notification/audit baseline — **không ship feature code**.

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | ADR soft-delete + accounting Accepted | PASS — `docs/adr/0001-soft-delete-and-accounting.md` |
| 2 | ADR display codes Accepted | PASS — `docs/adr/0002-display-codes.md` |
| 3 | ADR rating moderation Accepted | PASS — `docs/adr/0003-rating-moderation.md` |
| 4 | Glossary + state machines Accepted | PASS — `docs/adr/0004-glossary-and-state-machines.md` |
| 5 | Notification + Audit baseline Accepted | PASS — `docs/adr/0005-notification-and-audit-baseline.md` |
| 6 | Index ADR + roadmap track tách hardening cũ | PASS — `docs/adr/README.md`, `docs/ROADMAP_LMS_ERP.md` |
| 7 | Quyết định stack: giữ Mongo/Mongoose cho track này | PASS — ghi trong ADR README |
| 8 | PK ≠ display code; cấm xóa ledger khi soft-delete course | PASS — ADR 0001 + 0002 |
| 9 | Rating moderated-by-default | PASS — ADR 0003 |
| 10 | Không có code feature Phase 1+ trong Phase 0 | PASS — chỉ docs |

## Review checklist (kiểm thử Phase 0)

- [x] Soft-delete course không được phép xóa Invoice/Payment/Enrollment
- [x] Financial report lấy chứng từ tiền, không lấy “course còn trên catalog”
- [x] `HV001-CN1-EXCELMOS` là enrollment code, không thay student identity PK
- [x] Sequence display code theo (role, branch)
- [x] Enrollment state machine tương thích `active|completed|paused` hiện có
- [x] Đổi GV: session completed giữ teacher cũ; progress HV không reset
- [x] Rating public chỉ `approved`; Reward chỉ đếm approved
- [x] Audit append-only + redact password
- [x] Notification idempotent + digest reminder (không spam popup)
- [x] Multi-tenant deepen / Postgres **không** nằm Phase 1

## Lỗi phát hiện khi review

| Lỗi / rủi ro | Xử lý trong ADR |
|--------------|-----------------|
| Roadmap cũ Phase 1–20 đã Done dễ nhầm với track mới | Tách `ROADMAP_LMS_ERP.md` + ghi rõ trong ADR README |
| `studentCode` đã tồn tại, chưa chuẩn prefix | ADR 0002: backfill tương thích Phase 1 |
| `Evaluation` chưa có moderation | ADR 0003: mở rộng ở Phase Rating, không sửa Phase 0 |
| Chưa có `LedgerEntry` | ADR 0001: Phase Finance; interim = không xóa Invoice/Payment |

## Kết luận Phase 0

**PASS** — được phép sang **Phase 1: Database foundation**.

Phase 1 sẽ làm (và chỉ làm) theo ADR:

1. `Course`: `deletedAt`, `deletedBy`, `deleteReason` (+ index)
2. Display code fields / counter (Student/Teacher + enrollmentCode) — schema + utility, backfill idempotent
3. Model `AuditLog` (và optional `DomainOutbox`) theo ADR 0005
4. `tenantId` nullable nơi còn thiếu trên entity nóng (không đụng multi-tenant UI)
5. Test: schema load / unit hoặc integration nhẹ + script backfill dry-run an toàn

**Không làm trong Phase 1:** soft-delete API đầy đủ notify, Reward, Rating UI, đổi GV payroll, migrate Postgres.
