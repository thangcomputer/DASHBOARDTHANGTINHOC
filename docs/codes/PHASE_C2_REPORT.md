# PHASE C2 REPORT — Business Code Foundation

**Date:** 2026-08-11  
**Messaging files touched:** **NONE**

---

## Summary flags

```text
Application code changed: YES
Database changed: YES (LOCAL/DEV only — 127.0.0.1:27018)
Messaging changed: NO
Payment runtime changed: YES (fail-closed + legacy match; session-first unchanged)
Financial history changed: NO (Invoice/Ledger/Payroll untouched)

Production audit: BLOCKED
Migration: PASS (local) / BLOCKED (production)
Payment compatibility: PASS (unit + local design)
Unique indexes: BLOCKED (not created — await prod clean verify)
Rollback: VERIFIED (procedure documented; not exercised on prod)
```

---

## What shipped

| Item | Status |
|------|--------|
| [`services/businessCodeService.js`](../../services/businessCodeService.js) | Atomic `$inc` counters; HV/GV/NV/KH pad-6; fail-closed >999999 |
| `counters` collection | Seeded locally: student=4, teacher=4, employee=0, course=1 |
| `Student.legacyStudentCodes` | Schema + backfill |
| `Teacher.teacherCode` / `Employee.employeeCode` / `Course.courseCode` | Schema + create + local backfill |
| Create paths | student / import / auth google+zalo / teacher / staff / teacher register / employee / course |
| SePay fallback | legacy OR studentCode; **multi-match FAIL CLOSED** (live + CQRS twin) |
| FE generators | TTH/`Date.now` removed from AddStudent / AddEnrollment / TuitionPayment |
| Reserve code API | `POST /api/students/reserve-code` |
| Unique indexes | **Not created** |

---

## Local migration evidence

See [`PHASE_C2_MIGRATION_EVIDENCE.md`](./PHASE_C2_MIGRATION_EVIDENCE.md).

| Entity | Result |
|--------|--------|
| Students | HV45836680→HV000001 … HV15865369→HV000004 + legacy arrays |
| Teachers | GV000001–004 |
| Courses | KH000001 (slug `thvp` unchanged) |
| Employees | n/a (0 rows) |

---

## Production gate

```text
PRODUCTION AUDIT = BLOCKED
Do not run: node scripts/migrate_business_codes_c2.cjs --execute
  without PRODUCTION_MIGRATION_CONFIRMED=YES after a fresh prod read-only audit.
```

Local execute used: `--execute --allow-non-prod` only.

---

## Remaining risks

1. Production data not audited — duplicates unknown.  
2. Unique indexes still deferred.  
3. Reserved codes abandoned if user cancels QR → sequence gaps (acceptable).  
4. Open PaymentSession.ref values left unchanged (by design).  
5. RegistrationForm still uses name-based session content (session-first; not a business code).

---

## Next

```text
STOP — await owner approval for next phase
(prod audit → prod migration → unique indexes)
```
