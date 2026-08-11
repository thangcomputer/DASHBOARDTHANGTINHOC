# PHASE C2 — PAYMENT VERIFICATION

## Order (unchanged)

```text
PaymentSession.ref (primary)
  → studentCode OR legacyStudentCodes fallback (exact + unpaid + amount)
  → ObjectId settlement (Invoice.hocVien / Ledger.studentId)
```

`PaymentSession.ref` values were **not** rewritten. Pending sessions remain matchable.

## Fail-closed multi-match

Implemented in:

- [`utils/sepayMatch.js`](../../utils/sepayMatch.js) → `selectUnpaidStudentCandidates`
- [`routes/webhookRoutes.js`](../../routes/webhookRoutes.js)
- [`modules/payment/services/PaymentApplicationService.js`](../../modules/payment/services/PaymentApplicationService.js)

| Candidates after filters | Action |
|--------------------------|--------|
| 0 | no settlement |
| 1 | settle |
| ≥2 | FAIL CLOSED + structured log; no invoice/ledger write |

## Unit tests

```text
node --test tests/integration/sepayMatch.test.js
→ 8 passed (2026-08-11)
```

Covers: HV/TTH extract, amounts, legacy match, ambiguous fail-closed, format helpers, HV≠GV coupling.

## Invoice / Ledger

```text
UNCHANGED — still ObjectId references; no studentCode on finance docs
```

## FE QR

| Surface | Behavior |
|---------|----------|
| AddStudent | `POST /students/reserve-code` then QR with HV###### |
| AddEnrollment | uses existing `student.studentCode` only |
| TuitionPayment | blocks UI if missing server code |

## Verdict

```text
Payment compatibility: PASS (code + unit)
Production live SePay soak: NOT RUN (prod audit BLOCKED)
```
