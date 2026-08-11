# BUSINESS CODE COMPATIBILITY

**Phase:** B — Design  
**Date:** 2026-08-11  
**Status:** DESIGN ONLY  

---

## 1. Why compatibility is required

PHASE A + live audit show Student codes today are **not** canonical:

- Client historically: `TTH` + `Date.now()`
- Server historically: `HV` + timestamp-like digits (`HV45836680`, …)
- Target: `HV000001`

Simple rewrite `TTH123 → HV123` or truncating long HV codes **risks collision** and breaks any external reference (QR text, bank description, SePay content, ops notes).

Payment stack must keep:

```text
PaymentSession.ref  →  primary match
studentCode         →  fallback (strict)
```

`Invoice.maHoaDon` (`HD…`) remains **independent**.

---

## 2. Student legacy model (recommended)

Add (PHASE C schema — not applied in B):

```text
studentCode: String          // canonical HV###### only after backfill
legacyStudentCodes: [String] // former codes that must still match
```

On backfill for each Student:

```text
legacyStudentCodes = unique([current studentCode, ...existing legacy])
studentCode        = next HV###### from counter
```

Rules:

- Never delete a legacy value once stored.
- Never put canonical into legacy array as duplicate of itself unless needed for transition tooling.
- Search / admin UI may show: primary `studentCode` + “mã cũ” list.

Alternative (if owner rejects array on Student): collection `student_code_aliases { code, studentId, retiredAt }` — same matching rules.

---

## 3. Payment / SePay matching (target behavior)

### Order (unchanged)

1. Match `PaymentSession` by `ref` / session token (primary).  
2. Else fallback by student business code.  
3. Else reject.

### Fallback exact-match algorithm

```text
candidates = Students where
  studentCode == incomingCode
  OR incomingCode in legacyStudentCodes

filter: unpaid / eligible invoice or open fee obligation
filter: amount validation (existing rules)

if candidates.length == 0 → reject
if candidates.length == 1 → allow
if candidates.length  > 1 → FAIL CLOSED (no pick-first)
```

### Forbidden

- Using `studentCode` as primary identity instead of session when session exists.  
- Choosing arbitrary Student on multi-match.  
- Rewriting payment history / ledger / invoice numbers for migration.  
- Matching on student **name**.  
- Matching on Mongo `_id` string in transfer content unless already product-supported (do not expand).

### Legacy formats to accept in fallback (until sunset)

| Pattern | Action |
|---------|--------|
| `HV######` | Match `studentCode` |
| `HV` + longer digits | Match `legacyStudentCodes` |
| `TTH…` | Match `legacyStudentCodes` |
| Canonical after cutover | Match `studentCode` only for new |

Sunset of legacy match: **owner decision** after zero traffic window + monitoring.

---

## 4. QR / tuition / registration

| Surface | Rule |
|---------|------|
| QR content | Always server `studentCode` (canonical after create/backfill) |
| AddStudent / Enrollment / Registration / TuitionPayment | One generator path |
| Display name | Never used as payment identity |
| Client-generated TTH/HV | Removed in C1; ignored if still sent |

Prevent split-brain:

```text
QR = client TTH…   vs   DB = server HV…   → FORBIDDEN
```

---

## 5. Teacher / Employee / Course

No payment primary dependency on these codes today (PHASE A).

| Entity | Compatibility |
|--------|----------------|
| Teacher | New field only; assignments stay `teacherId` |
| Employee | New field only; payroll stays `employeeId` / `PayrollLog.employeeId` |
| Course | New `courseCode`; keep `slug` and `_id`; enrollments stay `courseId` |

No legacy alias arrays required unless prod later invents parallel course identifiers.

VietQR payroll: **do not** introduce `employeeCode` dependency if current flow does not need it.

---

## 6. Multi-course behavior (compatibility)

Unchanged relational model:

```text
1 studentCode ↔ 1 Student._id ↔ N enrollments (courseId, teacherId)
```

No per-course student codes. Payment sessions remain tied to student / invoice / session — not to `courseCode` as FK.

---

## 7. Teacher assignment independence

```text
Student A → Teacher X
Student A → Teacher Y
Student B → Teacher X
```

Resolved only via ObjectIds / enrollment. Business codes are labels only. No HV/GV numeric coupling.

---

## 8. Messaging

**No compatibility bridge.** Do not map codes into:

- conversationId  
- pairing  
- transportRole  
- contacts policy  

If any messaging file is found referencing business codes during later work: **REPORT ONLY**, do not “fix” by editing messaging.

PHASE A conclusion: **Messaging dependency = NONE**.

---

## 9. Payment regression matrix (PHASE C tests)

| Case | Expect |
|------|--------|
| New student, session QR, webhook | Match by session; invoice/ledger OK |
| Legacy long HV in transfer text, session missing | Match via legacy if unique + unpaid + amount |
| Two students share same legacy (should not exist) | Fail closed |
| Amount mismatch | Reject |
| Refund / payroll / invoice number | Unchanged |
| Multi-enrollment student | Still one code; payment not split by course code |

---

## 10. Data that must remain untouched

```text
Student._id, Teacher._id, Employee._id, Course._id
enrollments[], teacher assignment ObjectIds
Invoice.maHoaDon, ledger entries, payment history docs
PayrollLog.employeeId
Message / Conversation / Socket rooms
JWT / RBAC
```

---

## 11. Owner decisions still open

1. Approve `legacyStudentCodes[]` vs alias collection.  
2. Legacy match sunset date.  
3. Production audit before C3.  
4. Global sequence (recommended) vs branch sequence (not recommended).  

---

## Next

```
STOP — await owner approval for PHASE C
```
