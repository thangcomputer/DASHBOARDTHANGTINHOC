# PHASE C2 — MIGRATION EVIDENCE

**Environment:** LOCAL/DEV `mongodb://127.0.0.1:27018/dashboardthangtinhoc`  
**Production confirmed:** NO  
**Script:** [`scripts/migrate_business_codes_c2.cjs`](../../scripts/migrate_business_codes_c2.cjs)

```text
Mode used: --execute --allow-non-prod
Financial history rewrite: NO
_id changes: NO
Enrollment / assignment changes: NO
Messaging changes: NO
```

---

## Before → After (local)

### Students

| OLD | NEW | legacyStudentCodes |
|-----|-----|--------------------|
| HV45836680 | HV000001 | [HV45836680] |
| HV81146854 | HV000002 | [HV81146854] |
| HV85357155 | HV000003 | [HV85357155] |
| HV15865369 | HV000004 | [HV15865369] |

### Teachers

| OLD | NEW |
|-----|-----|
| (missing) | GV000001 … GV000004 |

### Courses

| OLD | NEW | slug |
|-----|-----|------|
| (missing) | KH000001 | thvp (unchanged) |

### Counters after seed

```json
[
  { "_id": "student", "seq": 4 },
  { "_id": "teacher", "seq": 4 },
  { "_id": "employee", "seq": 0 },
  { "_id": "course", "seq": 1 }
]
```

---

## Idempotency

Re-running dry-run after execute: already_canonical students skipped; no re-alias of current HV###### into legacy.

---

## Production

```text
Migration: BLOCKED until production read-only audit PASS
+ backup confirmed
+ PRODUCTION_MIGRATION_CONFIRMED=YES
```
