# PHASE C2 — ROLLBACK

## Principles

- Never delete Students / Teachers / Employees / Courses to “roll back”.  
- Never rewrite Invoice / Ledger / Payroll / Message history.  
- Prefer restoring `studentCode` from `legacyStudentCodes[0]` when rolling back student codes only.

## Student code rollback (conceptual)

For each migrated student:

```text
canonical = student.studentCode          // e.g. HV000001
legacy0   = student.legacyStudentCodes[0] // e.g. HV45836680
→ set studentCode = legacy0
→ remove legacy0 from legacyStudentCodes (or clear array if owner prefers)
```

Must be owner-approved script; not auto-run.

## Teacher / Employee / Course

Unset or clear `teacherCode` / `employeeCode` / `courseCode` if required — `_id` and relations stay.

`Course.slug` was never changed — no slug rollback needed.

## Counters

If rolling back creates, set counter `seq` down only with extreme care (risk of reuse). Prefer leave counters high (gaps OK) rather than reuse codes.

## Unique indexes

Not created in C2 — nothing to drop for indexes.

## Application rollback

Redeploy previous release to restore Date.now / TTH generators if needed (not recommended). Prefer forward-fix.

## Verification status

```text
Rollback procedure: DOCUMENTED
Rollback executed on production: NO
Rollback verified on local: NOT EXECUTED (local left on canonical codes)
```
