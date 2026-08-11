# BUSINESS CODE DB AUDIT

**Phase:** B — Design  
**Date:** 2026-08-11  
**Mode:** READ-ONLY (no writes, no indexes, no schema changes)  
**Script:** `scripts/_tmp_audit_business_codes_readonly.cjs`  

---

## 1. Scope

Collections / fields audited:

| Collection | Field |
|------------|-------|
| students | `studentCode` |
| teachers | `teacherCode` (presence) |
| employees | `employeeCode` (presence) |
| courses | `courseCode` (presence) |
| counters | collection existence |

Classification buckets for Student codes:

| Bucket | Rule |
|--------|------|
| MISSING / EMPTY / NULL | absent, `""`, null |
| TTH | `/^TTH/i` |
| HV_TIMESTAMP_LIKE | `/^HV\d{8,}$/` (legacy server `Date.now` style) |
| HV_PAD6_CANONICAL | `/^HV\d{6}$/` |
| HV_OTHER | other `HV*` |
| OTHER | neither HV nor TTH |
| DUPLICATE | same non-empty code on ≥2 docs |
| VALID (target) | only after migration: `/^HV\d{6}$/` unique |

---

## 2. Live environment snapshot

**Audited at:** `2026-08-11T02:42:29.070Z`  
**Source:** local/workspace Mongo via `MONGODB_URI` (dotenv)  
**Warning:** Đây **không** thay thế audit production. PHASE C bắt buộc re-run trên prod trước backfill / unique index.

### Students

| Metric | Value |
|--------|------:|
| total | 4 |
| missingOrEmpty | 0 |
| withCode | 4 |
| TTH | 0 |
| HV timestamp-like (≥8 digits) | **4** |
| HV pad-6 canonical | 0 |
| HV other | 0 |
| other non-HV/TTH | 0 |
| duplicate groups | **0** |
| duplicates | [] |

**Sample codes:**

```text
HV45836680
HV81146854
HV85357155
HV15865369
```

**Interpretation:**

- All current Student codes are **LEGACY_FORMAT** (`HV` + long numeric), **not** canonical `HV######`.
- No EMPTY/NULL on this DB.
- No DUPLICATE on this DB → no STOP on duplicates **for this environment**.
- Backfill must **not** do `HV45836680 → HV45836680` truncate; assign **new** `HV000001…` and keep old in `legacyStudentCodes`.

### Teachers

| Metric | Value |
|--------|------:|
| total | 4 |
| withTeacherCode | **0** |

→ All MISSING `teacherCode` (field not used yet).

### Employees

| Metric | Value |
|--------|------:|
| total | 0 |
| withEmployeeCode | 0 |

→ Empty collection on this DB; field still to be introduced.

### Courses

| Metric | Value |
|--------|------:|
| total | 1 |
| withCourseCode | **0** |

→ All MISSING `courseCode`; `slug` / `_id` unchanged by design.

### Counters

| Metric | Value |
|--------|-------|
| `counters` collection exists | **false** |

---

## 3. Classification summary (this DB)

```text
Student.studentCode
  VALID (canonical HV######) : 0
  LEGACY_FORMAT (HV+ts)      : 4
  TTH                        : 0
  MISSING/EMPTY/NULL         : 0
  DUPLICATE                  : 0
  INVALID_FORMAT             : 0 (all parse as HV + digits)

Teacher.teacherCode          : 4 MISSING
Employee.employeeCode        : N/A (0 docs)
Course.courseCode            : 1 MISSING
counters                     : MISSING collection
```

---

## 4. Absolute STOP checks (this run)

| Condition | Result |
|-----------|--------|
| duplicate studentCode | **CLEAR** (this env) |
| payment ambiguity from audit alone | Not measurable without live unpaid+code collisions — see COMPATIBILITY |
| Messaging references business codes | Per PHASE A: **NONE** (code review; not re-scanned here) |
| Would migration need `_id` change? | **NO** (design forbids) |

**Production:** Unknown until identical audit is run. Treat prod as **unverified**.

---

## 5. Re-audit checklist (before PHASE C writes)

```text
1. Point MONGODB_URI at production (read-only user preferred)
2. node scripts/_tmp_audit_business_codes_readonly.cjs
3. Export JSON to docs/codes/audit-runs/YYYY-MM-DD-env.json
4. If duplicateGroups > 0 → STOP + owner decision
5. Count unpaid invoices / payment sessions keyed by legacy codes
6. Confirm no teacherCode/employeeCode/courseCode already partially deployed elsewhere
```

---

## 6. What this audit did NOT do

- No writes / merges / `_id` changes  
- No enrollment / invoice / ledger / payroll / message mutation  
- No unique index creation  
- No payment runtime change  

---

## 7. Next

Use results in [`BUSINESS_CODE_MIGRATION_PLAN.md`](./BUSINESS_CODE_MIGRATION_PLAN.md) and [`BUSINESS_CODE_COMPATIBILITY.md`](./BUSINESS_CODE_COMPATIBILITY.md).

```
STOP — await owner approval for PHASE C
```
