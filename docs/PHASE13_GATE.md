# Phase 13 Gate — Session payroll

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 7 + 10 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Service | `services/sessionPayrollService.js` |
| Ownership | Chỉ `Schedule.status=completed` + `teacherId` sở hữu buổi |
| Anti double-pay | Claim atomic `is_paid_to_teacher` + assert không trùng session |
| Split | Preview 8 GV-A / 12 GV-B sau reassign |
| Pay API | `PUT /api/payroll/teachers/:id/pay` + `pay-flexible` → cùng service |
| Preview | `GET /api/payroll/students/:id/split`, `/teachers/:id/pending` |
| Ledger | `source: payroll` debit + audit `payroll.session_pay` |
| Tests | `tests/integration/sessionPayrollPhase13.test.js` |

## Quy tắc ADR 0004

```
Lương GV = Σ buổi completed có teacherId = GV và chưa is_paid_to_teacher
Đổi GV: buổi completed GIỮ teacherId cũ → không double-pay sang GV mới
```

## Gate fixture 8/12

| | Buổi | Số tiền (rate 100k) |
|--|------|---------------------|
| GV-A | 8 completed | 800.000 |
| GV-B | 12 completed | 1.200.000 |
| Overlap session | 0 | — |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Split 8/12 đúng ownership | PASS |
| 2 | Scheduled không tính lương | PASS |
| 3 | Double-pay claim bị chặn | PASS |
| 4 | pay-flexible dùng sessionPayrollService | PASS |
| 5 | Ledger source payroll | PASS |

## Không làm

- UI timeline segment đầy đủ
- Tự động chi lương theo cron
- Gộp Reward + Session payroll một phiếu

## Kết luận

**PASS** — Phase 13 tests xanh (`sessionPayrollPhase13.test.js`).

Phase tiếp theo: **Phase 14 — Dashboard & Optimization**.
