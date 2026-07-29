# Phase 10 Gate — Finance / Ledger

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 6 + 5 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Model | `models/LedgerEntry.js` — append-only, `idempotencyKey` unique |
| Service | `services/ledgerService.js` — settle / refund reversal / Σ / reconcile |
| API | `GET /api/finance/ledger/summary\|reconcile\|entries` |
| Admin pay | `PUT .../pay` → Invoice + `settlePayment` + grant access + audit |
| Enrollment pay | ledger `enrollment_pay` idempotent theo enrollmentId |
| Refund | `postRefund` reversal; **không xóa Invoice**; thu hẹp access |
| SePay | ledger `payment:sepay:{gatewayTxnId}` (chống double webhook) |
| Notify | `PAYMENT_SUCCESS` template khi settle |
| Tests | `tests/integration/financeLedgerPhase10.test.js` |

## Payment saga (rút gọn)

```
Confirm/Webhook (idempotent)
  → Student.paid / enrollment.paid
  → Invoice (giữ mã)
  → LedgerEntry type=payment (append)
  → AccessGrant (learningAccess / active)
  → Notify + Audit payment.settle
```

Refund:

```
→ LedgerEntry type=refund (reversal)
→ enrollment refunded / learningAccess=false
→ Invoice gốc giữ nguyên
→ Audit payment.refund
```

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Ledger append-only + unique idempotencyKey | PASS (schema) |
| 2 | Soft-delete course không đổi Σ financial | PASS (policy test + soft-delete không xóa Invoice) |
| 3 | Refund = reversal, không xóa payment/invoice | PASS (static + invoicesPreserved) |
| 4 | SePay idempotent key `payment:sepay:` | PASS (static) |
| 5 | Reconcile API | PASS (static) |
| 6 | pay/refund wired ledger | PASS (static) |

## Không làm (phase sau)

- Full double-entry GL (Cash/AR/Deferred) từng tài khoản
- UI dashboard đọc ledger thay KPI `Student.paid`
- Revenue recognition theo buổi (deferred → earned)

## Kết luận

**PASS** — Phase 10 tests xanh (`financeLedgerPhase10.test.js`).

Phase tiếp theo: **Phase 11 — Rating moderation**.
