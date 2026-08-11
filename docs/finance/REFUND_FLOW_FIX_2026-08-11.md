# PHASE REFUND-FIX-1 — Refund/Cancel Consistency Fix

**Date:** 2026-08-11  
**Implements:** findings in `REFUND_FLOW_OUTSIDE_VS_DETAIL_2026-08-11.md`

---

## 1. Original root cause

Live `DELETE /api/students/:id/enrollments/:enrollmentId` (`routes/studentRoutes.js`):

When cancelling the **last** active enrollment, `syncStudentFromPrimaryEnrollment` set:

```text
student.course = ''
```

`Student.course` is `required` → `save()` failed with:

```text
Student validation failed: course: Tên khóa học là bắt buộc
```

Both AdminStudentsTab and StudentDetailModal call the same API.

---

## 2. Files changed

| File | Change |
|------|--------|
| `services/enrollmentService.js` | Canonical `syncStudentFromPrimaryEnrollment` — last enrollment → `course = '(Đã hủy)'` |
| `routes/studentRoutes.js` | Use shared sync; clearer save-after-refund error; keep `postRefund` before save |
| `tests/unit/refund_cancel_enrollment_sync.test.js` | Targeted unit tests (A–F) |
| `client/src/components/StudentDetailModal.jsx` | Remove debug `#region agent log` only (display mapping from prior phase kept) |

---

## 3. Exact behavior changed

### Last-enrollment fix

```text
active.length === 0 → student.course = '(Đã hủy)'
```

Aligns with `modules/student/routes/studentRoutes.js` (not mounted). Schema unchanged. Active learning state remains enrollment `status`.

### Refund ordering / transaction strategy

```text
postRefund (idempotent)
  → soft-cancel + sync
  → student.save()
```

**Mongo transaction: NOT used** on this path.

Reasons (fail-closed / no fake atomicity):

- `shared/cqrs/withTransaction` exists but is **not** established on student cancel/refund path
- `ledgerService.postEntry` does **not** accept a mongoose `session`
- Introducing TX without session-aware ledger writes would be incomplete

**Why keep postRefund before save:**

- Orphan recovery: if save once failed after ledger write, retry hits same `idempotencyKey` (`created: false`) then completes cancel
- Reversing to save-then-refund would leave “cancelled but no refund” with hard retry (`already cancelled`)

Save failure after refund now returns explicit `meta.refundLedgerMayExist` + stable `refundIdempotencyKey`.

```text
Refund consistency: REVIEW (improved; residual non-TX gap documented)
Last enrollment bug: PASS
```

---

## 4. Idempotency

Unchanged:

```text
idempotencyKey = refund:cancel:${student._id}:${enrollment._id}
sourceRef      = cancel:${student._id}:${enrollment._id}
```

Unique index on `LedgerEntry.idempotencyKey` preserved. No new key on retry.

```text
Idempotency: PASS
Double refund protection: PASS
```

---

## 5. Legacy enrollment (`main`)

Frontend list still blocks `enrollmentId === 'main'` and directs operator to Detail. No fabricated IDs.

```text
Legacy enrollment handling: PASS
```

---

## 6. Tests executed

```text
node --test tests/unit/refund_cancel_enrollment_sync.test.js
```

Result:

```text
6 pass / 0 fail
```

Coverage mapped:

| Case | Result |
|------|--------|
| A cancel one of many | PASS |
| B cancel final → `(Đã hủy)` validates | PASS |
| C empty course fails required | PASS |
| D placeholder validates | PASS |
| E idempotency key stable | PASS |
| F legacy `main` blocked | PASS |

Full HTTP integration against running server / replica-set TX: **not run** (no production/local data mutation in this phase).

---

## 7. Remaining risks

1. Non-transactional: rare save failure after successful `postRefund` still leaves ledger ahead of enrollment until **retry** completes cancel.  
2. Modules copy of sync not updated (dead path for `/api/students`).  
3. Credit-note side effects inside `postRefund` when `created=true` unchanged.

---

## 8. Out of scope (confirmed)

- Messaging / Auth / RBAC  
- Business-code / C4 / indexes / migrations  
- Invoice.maHoaDon generation / ledger schema  
- SePay / webhook  
- Frontend refund API contract  

---

## 9. Zero-write statement

```text
Production DB writes: 0
Local DB data writes outside test infrastructure: 0
Production refunds: 0
Production cancellations: 0
Webhooks replayed: 0
SePay calls: 0
Messaging changes: 0
Business-code migration: 0
C4 execution: 0
```

---

## 10. Post-implementation path

```text
Admin Students List / Student Detail
  → DELETE /api/students/:id/enrollments/:enrollmentId
  → same live routes/studentRoutes.js
  → postRefund (idempotent) → sync '(Đã hủy)' → save
```

```text
SAME API = YES
SAME BUSINESS LOGIC = YES
LAST ENROLLMENT = PASS
IDEMPOTENCY = PASS
NO DOUBLE REFUND = PASS
FINANCIAL CONSISTENCY = REVIEW (no TX; recovery via retry)
MESSAGING UNCHANGED
C4 UNCHANGED
```

---

## PHASE REFUND-FIX-1 STATUS

```text
Application code changed: YES
Database changed: NO
Production database changed: NO
Production refund executed: NO
Production cancellation executed: NO
Webhook replayed: NO
SePay called: NO
Messaging changed: NO
Auth changed: NO
RBAC changed: NO
Business-code migration: NO
C4: UNCHANGED

Last enrollment bug: PASS
Refund consistency: REVIEW
Idempotency: PASS
Double refund protection: PASS
Legacy enrollment handling: PASS
Regression tests: PASS (targeted unit suite)
```

**STOP** — C4 not started. REVIEW on consistency = residual non-TX boundary documented; last-enrollment validation fix is PASS.
