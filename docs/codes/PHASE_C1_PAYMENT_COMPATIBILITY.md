# PHASE C1 — PAYMENT COMPATIBILITY

**Phase:** C1  
**Date:** 2026-08-11  
**Mode:** READ-ONLY audit — **no** payment runtime change, **no** webhook edit, **no** `legacyStudentCodes` created  

Related: [`PHASE_C1_PRODUCTION_AUDIT.md`](./PHASE_C1_PRODUCTION_AUDIT.md), Phase B [`BUSINESS_CODE_COMPATIBILITY.md`](./BUSINESS_CODE_COMPATIBILITY.md)

---

## 1. Current payment identity stack

```text
PaymentSession.ref  →  PRIMARY match (substring in SePay content + amount ±1)
        ↓ miss
Student.studentCode →  FALLBACK (unpaid + content contains code + amount vs price)
        ↓
Invoice.hocVien / Ledger.studentId → ObjectId (history)
Invoice.maHoaDon (HD…) → independent document number
```

Evidence:

- [`routes/webhookRoutes.js`](../../routes/webhookRoutes.js) — session loop then studentCode fallback  
- [`utils/sepayMatch.js`](../../utils/sepayMatch.js) — `extractStudentCodeCandidates`, `amountsMatch`  
- [`models/PaymentSession.js`](../../models/PaymentSession.js) — `sessionId`, `ref`, amount, status; **no** `studentId` in schema  
- [`models/Invoice.js`](../../models/Invoice.js) — `hocVien` ObjectId; **no** `studentCode`  
- [`models/LedgerEntry.js`](../../models/LedgerEntry.js) — `studentId` ObjectId; sample `sourceRef` = `HD2608-000x`

This env: `paymentsessions` count **0** (TTL/empty); invoices **4**; ledgerentries **4** — all ObjectId-linked.

---

## 2. Path checklist (as-is)

| Question | Session path | studentCode fallback |
|----------|--------------|----------------------|
| Uses studentCode? | No | **Yes** |
| Uses `_id`? | settle may pass claimed.studentId (usually undefined) | Yes after match |
| Uses invoice ID? | No for match | Creates invoice after pay |
| Uses PaymentSession.ref? | **Yes** | No |
| Legacy code layer? | Only if ref string embeds old code | Only current `studentCode` field |
| Amount matching? | Yes (±1; skip if amount invalid) | Yes via `amountsMatch` (fail if expected ≤0) |
| Branch matching? | Not required for match | Not required for match |
| Tenant matching? | Not in SePay matcher | Not in SePay matcher |

---

## 3. Scenarios A–E

### Scenario A — PaymentSession.ref → Student/settlement

```text
content includes session.ref + amount OK → mark session paid → settlePayment
```

**Status:** Primary path — **KEEP**. Migration of `studentCode` does not break active sessions keyed by `ref` (often full CK text).  
**TTL:** sessions expire 24h — historical session refs are not durable payment identity.

### Scenario B — Legacy student code → Student

Today: only `Student.studentCode` is queried.  
After future migration `HV45836680 → HV000001` **without** alias: unpaid transfers still quoting `HV45836680` **miss** → **P1**.

**Required (future, not C1):**

```text
legacyStudentCodes[] includes "HV45836680"
fallback: studentCode == X OR X in legacyStudentCodes
```

Classification of current legacy codes (this env):

| Code | Still required? | Payment-related? | Class |
|------|-----------------|------------------|-------|
| HV45836680 | YES until sunset | YES (QR/CK possible) | **MUST PRESERVE** |
| HV81146854 | YES | YES | **MUST PRESERVE** |
| HV85357155 | YES | YES | **MUST PRESERVE** |
| HV15865369 | YES (unpaid now) | **YES — unpaid** | **MUST PRESERVE** |
| TTH##### (FE) | May appear in session.ref / QR | Session-primary if pending | **MUST PRESERVE** if ever persisted or in open QR; else **NEEDS OWNER DECISION** on sunset |

`extractStudentCodeCandidates` also harvests loose `[a-z0-9]{5,16}` tokens → TTH-like tokens **can** enter variant set.

### Scenario C — New canonical studentCode → Student

```text
HV000001 in content → match studentCode after backfill
```

**OK** once generators + backfill exist. C1 does not apply.

### Scenario D — Same legacy code matches >1 student

**Policy target:** FAIL CLOSED (0 apply).  

**Current runtime:** query `studentCode: { $in: variants }`, iterate, first content+amount hit wins, then `break` — **PICK-FIRST**, not fail-closed.

| Item | Value |
|------|-------|
| Finding | Multi-match is pick-first |
| Evidence | [`webhookRoutes.js`](../../routes/webhookRoutes.js) ~320–444 |
| Risk | **P1** if duplicates ever exist (index is non-unique) |
| Affected path | SePay student fallback |
| Recommended fix (later) | If ≥2 candidates pass filters → reject / alert; do not pay |
| Migration impact | Unique index alone insufficient until matcher fail-closed |
| C1 action | **REPORT ONLY — not fixed** |

This env: **0** duplicate studentCodes → Scenario D not currently triggered here. Prod unknown.

### Scenario E — No match

No session + no unpaid student match → webhook does not settle. **FAIL CLOSED** for apply. **OK**.

---

## 4. TTH vs HV split-brain (report only)

| Finding | Evidence | Risk | Path |
|---------|----------|------|------|
| FE QR uses `TTH`+timestamp; may POST as `studentCode` | `AddStudentModal.jsx` | QR identity ≠ server `HV…` if create path regenerates or diverges | Admin add student |
| Server fills `HV`+Date.now when empty | `studentRoutes.js` | Dual formats in DB over time | Create API |
| Enrollment CK uses synthetic TTH | `AddEnrollmentModal.jsx` | Session.ref carries TTH; studentCode may be HV | Add enrollment pay |
| Tuition may fall back to `_id` slice / `HV001` | `TuitionPaymentModal.jsx` | Wrong fallback identity | Tuition QR |

**Severity:** **P1** (payment ambiguity / ops confusion).  
**C1:** do not change FE/BE.  
**Later:** single server generator; QR always canonical/server code; keep legacy aliases.

---

## 5. What must go into future `legacyStudentCodes[]` (design only)

For each Student at backfill time:

```text
legacyStudentCodes = unique non-empty prior studentCode values
studentCode = next HV######
```

Do **not** create the field in C1. Do **not** update Students in C1.

Also consider (owner decision): any TTH values historically persisted on Student documents (none on this env sample).

---

## 6. Invoice / Ledger / Payroll

| Artifact | studentCode dependency | Migration safety |
|----------|------------------------|------------------|
| Invoice.maHoaDon | None | **SAFE** leave untouched |
| Invoice.hocVien | ObjectId | **SAFE** |
| Ledger.studentId | ObjectId | **SAFE** |
| Ledger.sourceRef | HD… / session ids | **SAFE** |
| PayrollLog.employeeId | ObjectId | **SAFE**; employeeCode additive only |
| Payment history rewrite | — | **FORBIDDEN** |

---

## 7. Risk matrix

| Dependency | Severity | Notes |
|------------|----------|-------|
| SePay session.ref primary | **SAFE** | Keep order |
| SePay studentCode fallback after rename | **P1** | Needs legacy alias |
| Webhook multi-match pick-first | **P1** | Policy wants fail-closed |
| FE TTH generator | **P1** | Split-brain |
| Server Date.now HV | **P2** | Concurrency / format |
| Invoice/Ledger ObjectId | **SAFE** | |
| Tuition `_id` fallback display | **P2** | |
| Messaging | **MUST BE ZERO** | Confirmed none |
| Teacher assignment | **SAFE** | ObjectId |
| Reports showing studentCode | **P3** | Display update after cutover |
| Unique index too early | **P0** if done before clean | C1 forbids |

---

## 8. Payment compatibility verdict

```text
Payment compatibility: REVIEW

PASS aspects:
  - Session-first design
  - Invoice/Ledger ObjectId isolation
  - Amount validation present
  - No messaging coupling

BLOCK / REVIEW aspects:
  - Production unpaid + legacy refs UNKNOWN
  - Legacy rename without alias would break fallback
  - Multi-match not fail-closed
  - FE TTH vs server HV dual generators
```

---

## 9. Absolute C1 stops honored

```text
Application code changed: NO
Database changed: NO
legacyStudentCodes created: NO
Webhook changed: NO
SePay changed: NO
Invoice changed: NO
Ledger changed: NO
Messaging changed: NO
```

```text
STOP — await owner review before PHASE C2 / any DB write.
```
