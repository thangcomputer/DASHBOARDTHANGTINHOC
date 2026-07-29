# QA Refund E2E Report

**Date:** 2026-07-29T05:55:36.163Z
**API:** http://127.0.0.1:5000
**Result:** PASS 9 · FAIL 0

- **[PASS]** `REF-01` — Full refund API 200 — `status=200 msg=Đã hoàn/hủy thanh toán 2.500.000đ`
- **[PASS]** `REF-02` — Student paid=false after refund — `paid=false paidAmount=0`
- **[PASS]** `REF-03` — Enrollment learningAccess revoked / status refunded — `[{"paid":false,"access":false,"status":"refunded"}]`
- **[PASS]** `REF-04` — Ledger refund entry created — `amount=2500000 id=6a6995d897fbe2f3fa2fdd94`
- **[PASS]** `REF-05` — Invoice preserved (soft finance — no delete) — `before=1 after=1 seeded=true still=true`
- **[PASS]** `REF-06` — Audit payment.refund — `action=payment.refund`
- **[PASS]** `REF-07` — Double refund rejected (409 unpaid) — `status=409 msg=Học viên chưa thanh toán — không thể hoàn`
- **[PASS]** `REF-08` — Partial refund (amount=500000) giữ paid + giảm paidAmount — `status=200 paid=true paidAmount=2000000 ledger=500000 partial=true msg=Đã hoàn một phần 500.000đ (còn 2.000.000đ)`
- **[PASS]** `REF-09` — Partial vượt paidAmount → 400 — `status=400 msg=Số tiền hoàn (99.999.999đ) vượt quá đã thanh toán (2.000.000đ)`

## Findings
- Full refund + ledger + invoice preserve + double-refund guard: covered above.
- Partial refund: nếu FAIL → cần API `amount` partial + cập nhật paidAmount/revenue (Critical before Production finance).
