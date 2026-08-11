# BUSINESS CODE MIGRATION PLAN

**Phase:** B — Design  
**Date:** 2026-08-11  
**Status:** PLAN ONLY — chưa chạy migration / chưa đổi schema runtime  

---

## 1. Current → Target

| Entity | Current | Target |
|--------|---------|--------|
| Student | `TTH*`, `HV`+timestamp (8+), empty | `HV######` + optional `legacyStudentCodes[]` |
| Teacher | no field | `teacherCode = GV######` |
| Employee | no field | `employeeCode = NV######` |
| Course | `slug` only | add `courseCode = KH######` (slug stays) |
| counters | missing | create collection |
| Unique indexes | student sparse non-unique | unique after clean audit |

Live DB snapshot (2026-08-11, read-only): xem [`BUSINESS_CODE_DB_AUDIT.md`](./BUSINESS_CODE_DB_AUDIT.md).

---

## 2. Phased implementation (sau owner approve = PHASE C+)

### C0 — Prerequisites

- Owner approve PHASE B.
- Re-run DB audit on **production** before any write.
- If `duplicateGroups > 0` → **STOP**.

### C1 — CodeGeneratorService + counters (create-path only)

- Add `services/codeGeneratorService.js` (+ Counter model).
- Wire **new creates only**: Student, Teacher, Employee, Course.
- Strip client-supplied codes.
- Frontend: remove `TTH`+`Date.now()` generators; display server code.
- **No** unique index yet; **no** backfill yet.
- Tests: concurrent create, format, multi-enrollment still one code.

### C2 — Compatibility layer (Student)

- Add `legacyStudentCodes: [String]` (or mapping collection) — design in COMPATIBILITY.md.
- On backfill: move old code → legacy array; set canonical `HV######`.
- Payment fallback: match `studentCode` **or** `legacyStudentCodes` (exact), unpaid, amount; `>1` → fail closed.
- Keep PaymentSession.ref primary.

### C3 — Backfill existing rows

Order:

1. Courses → assign `KH######` (sorted by `createdAt` / `_id`).
2. Teachers → `GV######`.
3. Employees → `NV######`.
4. Students → canonical `HV######`; preserve legacy in `legacyStudentCodes`.

Rules:

- Never change `_id`.
- Never rewrite enrollments / assignments / invoices / ledger / payroll / messages.
- Idempotent: skip if already matches `/^HV\d{6}$/` (etc.).
- Seed counters to max seq used.

### C4 — Unique indexes

Only after:

- zero duplicates on canonical fields
- all required entities have codes
- payment regression green
- messaging regression green (no code changes)

### C5 — Remove client legacy paths

- Delete FE `TTH` generators.
- Unify QR/CK to server `studentCode`.
- RegistrationForm: after create, use returned code in subsequent payment UX (session still primary).

---

## 3. Duplicate strategy

| Finding | Action |
|---------|--------|
| No duplicates | Proceed |
| Duplicates on live | **STOP** — report codes + `_id`s; owner decides (no auto-merge) |
| Empty codes | Backfill only (C3) |

---

## 4. Counter seed algorithm

After backfill entity E:

```text
maxSeq = max(numeric suffix of canonical codes, 0)
counters._id = E → seq = maxSeq
```

Next generate → `maxSeq+1`.

---

## 5. Rollback (non-destructive)

| Layer | Rollback |
|-------|----------|
| New fields | Stop writing; keep fields (nullable) — no delete of data |
| counters | Stop using generator; revert create routes to previous (deploy previous release) |
| Backfill | Restore `studentCode` from `legacyStudentCodes[0]` if needed via reverse script (owner-approved); **never** delete students |
| Unique index | `dropIndex` only — no document deletes |
| Messaging / payments | Untouched by design — nothing to roll back |

**Forbidden rollback:** delete students/teachers, merge docs, rewrite ledger/invoice/payroll/message history.

---

## 6. Testing strategy (PHASE C)

See POLICY + master prompt §15–17.

Minimum:

- Concurrent Student/Teacher/Employee/Course creates (100+).
- 1 student × 3 enrollments × different teachers → one `studentCode`.
- Assignment ObjectId independence.
- Payment: session + legacy code fallback fail-closed.
- Messaging regression suite **without** editing messaging source.

---

## 7. Migration blockers (from live audit + Phase A)

| Blocker | Status (dev DB 2026-08-11) |
|---------|----------------------------|
| Duplicate studentCode | **None** on audited DB |
| Production not audited | **Must re-audit prod before C3** |
| Client TTH vs server HV | Design addressed via C1+C2 |
| Payment ambiguity | Compatibility + fail-closed |
| Messaging dependency | NONE |

---

## 8. Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Prod duplicates unknown | Med | High | Mandatory prod audit |
| Rematch miss after rename code | Med | High | legacyStudentCodes |
| Race without counter | High if skip C1 | High | Atomic $inc only |
| Accidental Messaging edit | Low | Critical | Hard file allowlist in PR |
| Unique index too early | Med | High | Index only in C4 |

---

## Next

```
STOP — await owner approval for PHASE C
```
