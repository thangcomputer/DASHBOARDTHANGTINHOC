# PHASE C1 — MIGRATION PREVIEW (IN-MEMORY DRY-RUN)

**Phase:** C1  
**Date:** 2026-08-11  
**Status:**

```text
NOT EXECUTED
NO DB WRITE
IN_MEMORY ONLY
```

**Source data:** LOCAL/DEV Mongo `dashboardthangtinhoc @ 127.0.0.1:27018`  
**Production confirmed:** NO → this preview is **not** a production migration plan of record until re-run on prod.

Canonical targets (independent sequences):

```text
Student  → HV######
Teacher  → GV######
Employee → NV######
Course   → KH######
```

Sort order used: Mongo `_id` ascending (stable, deterministic for preview).

---

## 1. Proposed counter seeds (after hypothetical backfill)

| Counter `_id` | seq after backfill |
|---------------|-------------------:|
| student | 4 |
| teacher | 4 |
| employee | 0 |
| course | 1 |

Next create would be HV000005 / GV000005 / NV000001 / KH000002 — **only after** counters exist (not created in C1).

---

## 2. Student dry-run

| OLD CODE | NEW CODE | ENTITY ID | ACTION |
|----------|----------|-----------|--------|
| HV45836680 | HV000001 | `6a79796ccb8547ec5edc6e94` | MIGRATE_TO_CANONICAL_KEEP_LEGACY |
| HV81146854 | HV000002 | `6a7a035acb8547ec5edc6ebe` | MIGRATE_TO_CANONICAL_KEEP_LEGACY |
| HV85357155 | HV000003 | `6a7a13cdd851094f5b96845c` | MIGRATE_TO_CANONICAL_KEEP_LEGACY |
| HV15865369 | HV000004 | `6a7a8af91ed97493dbf41661` | MIGRATE_TO_CANONICAL_KEEP_LEGACY |

Rules demonstrated:

- New canonical sequence — **not** truncating `HV45836680 → HV458366`.
- Each student keeps the same `_id`.
- `enrollmentCount` remained 1 per student in this env; multi-enrollment would still share one `newCode`.
- Future: store `oldCode` in `legacyStudentCodes[]` (**not applied in C1**).

---

## 3. Teacher dry-run

| OLD CODE | NEW CODE | ENTITY ID | ACTION |
|----------|----------|-----------|--------|
| (missing) | GV000001 | `6a7a0318cb8547ec5edc6eb4` | GENERATE |
| (missing) | GV000002 | `6a7a043dcb8547ec5edc6eeb` | GENERATE |
| (missing) | GV000003 | `6a7a048fcb8547ec5edc6eef` | GENERATE |
| (missing) | GV000004 | `6a7a04cdcb8547ec5edc6ef8` | GENERATE |

- Sequence **independent** of Student (GV000001 can coexist with HV000001 without coupling).
- Assignments stay on `teacherId` ObjectId — **unchanged** by this preview.

---

## 4. Employee dry-run

| OLD CODE | NEW CODE | ENTITY ID | ACTION |
|----------|----------|-----------|--------|
| — | — | — | **no rows** (0 employees) |

Counter seed `employee = 0` → first future employee `NV000001`.

Payroll continues to use `employeeId` — business code is display/reference only.

---

## 5. Course dry-run

| OLD CODE | NEW CODE | SLUG | ENTITY ID | ACTION |
|----------|----------|------|-----------|--------|
| (missing) | KH000001 | `thvp` | `6a775eaf67c11b383f5f940b` | GENERATE |

- `slug` **unchanged**.
- `_id` **unchanged**.
- Enrollments continue to reference `courseId`, not `courseCode`.

---

## 6. Sequence independence proof

```text
Student:  HV000001 … HV000004
Teacher:  GV000001 … GV000004
Employee: (none)
Course:   KH000001
```

No shared counter. No `HV000001 ↔ GV000001` assignment implication.

---

## 7. What this dry-run does NOT do

- Does not update Mongo documents  
- Does not create `legacyStudentCodes`  
- Does not create `counters`  
- Does not create unique indexes  
- Does not rewrite Invoice / Ledger / Payroll / PaymentSession / Message  
- Does not change Messaging or payment runtime  

---

## 8. Rollback (design reminder — not executed)

If a future write phase were applied incorrectly:

- Prefer reverse-map from `legacyStudentCodes` → restore `studentCode`  
- Drop unique index if added  
- Stop generator; redeploy previous create path  
- **Never** delete Students/Teachers/Courses or rewrite financial history  

---

## 9. Gate

```text
Dry-run (this env): PASS (in-memory)
Production dry-run: BLOCKED (no prod confirmation)
PHASE C2: BLOCKED
```

```text
STOP — await owner review before any DB write.
```
