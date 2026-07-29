# Phase 1 Gate — Database foundation

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 0 PASS (`docs/PHASE0_GATE.md`)

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Course soft-delete | `deletedAt`, `deletedBy`, `deleteReason`, `tenantId` + indexes |
| Student | `displayCode`, `tenantId`, `enrollments.enrollmentCode` + unique partial index |
| Teacher | `displayCode`, `tenantId` + unique partial index |
| Models mới | `AuditLog`, `DomainOutbox`, `BranchCodeCounter` |
| Utils/Services | `utils/displayCode.js`, `services/displayCodeService.js`, `services/auditLogService.js` (redact) |
| Indexes boot | `config/ensureIndexes.js` sync 3 model mới |
| Backfill | `scripts/backfill_display_codes.cjs` (dry-run mặc định, `--apply` mới ghi) |
| Tests | `tests/integration/displayCode.test.js`, `phase1Schema.test.js` |

## Không làm (đúng scope)

- Soft-delete API + notify học viên (Phase 6)
- Gắn allocateDisplayCode vào mọi route tạo HV/GV (Phase 2+)
- Rating / Reward / Payment ledger đầy đủ
- Migrate Postgres

## Definition of Done checklist

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Schema Course soft-delete đúng ADR 0001 | PASS |
| 2 | Display code helpers đúng pattern ADR 0002 | PASS (test) |
| 3 | AuditLog fields + redact password | PASS (test) |
| 4 | Outbox + Counter model load được | PASS (test) |
| 5 | `npm`/node test Phase 1 files xanh | _(chạy gate)_ |
| 6 | Backfill dry-run không ghi DB khi thiếu --apply | PASS (code default) |
| 7 | Không đụng soft-delete business API | PASS |

## Kết luận

**PASS** — Phase 1 tests: 9/9 xanh (`displayCode` + `phase1Schema`).

Được phép sang **Phase 2: Auth / password provision** chỉ khi product xác nhận; chưa bắt đầu trong session này nếu chưa được giao tiếp tục.

**Gợi ý ops (không bắt buộc gate):** trên staging chạy `node scripts/backfill_display_codes.cjs` (dry-run) rồi `--apply` khi đã backup.

