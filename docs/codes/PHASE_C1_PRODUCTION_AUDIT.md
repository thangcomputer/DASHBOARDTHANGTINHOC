# PHASE C1 — PRODUCTION AUDIT

**Phase:** C1  
**Date:** 2026-08-11  
**Mode:** READ-ONLY — no application change, no DB write, no index/counter/migration  
**Audit script:** [`scripts/_tmp_phase_c1_audit_readonly.cjs`](../../scripts/_tmp_phase_c1_audit_readonly.cjs)  
**Raw JSON:** [`_phase_c1_audit_raw.json`](./_phase_c1_audit_raw.json) (`NOT EXECUTED` dry-run embedded)  
**Baseline:** Phase A + Phase B docs under `docs/codes/`

---

## 1. Environment banner

| Field | Value |
|-------|-------|
| Audited at | `2026-08-11T02:53:35.456Z` |
| NODE_ENV | `development` |
| Connection host | `127.0.0.1:27018` |
| Database | `dashboardthangtinhoc` |
| Scheme | `mongodb` |
| Production confirmed | **NO** |
| Production audit | **BLOCKED** |

```text
Environment audited: LOCAL/DEV (workspace Mongo)
Database: dashboardthangtinhoc @ 127.0.0.1:27018
Connection: MONGODB_URI from .env (credentials not logged)
Production confirmed: NO
PRODUCTION AUDIT = BLOCKED
```

**Do not conclude** “production has no duplicates” from this run. PHASE C2 remains **BLOCKED** until owner supplies a production read-only URI and this audit is re-run with `PHASE_C1_PRODUCTION_CONFIRMED=YES` (owner attestation).

---

## 2. Collection inventory (relevant)

| Logical entity | Collection | Count (this env) | Business code field |
|----------------|------------|------------------|---------------------|
| Student | `students` | 4 | `studentCode` (String) |
| Teacher | `teachers` | 4 | **absent** |
| Employee | `employees` | 0 | **absent** |
| Course | `courses` | 1 | **absent** (`slug` exists) |
| Enrollment | embedded `students.enrollments[]` | — | uses `courseId`, `teacherId` ObjectIds |
| Invoice | `invoices` | 4 | **no** `studentCode`; `hocVien` ObjectId; `maHoaDon` |
| Ledger | `ledgerentries` | 4 | **no** `studentCode`; `studentId` ObjectId; `sourceRef` often invoice # |
| PaymentSession | `paymentsessions` | 0 | `ref` (string); TTL 24h |
| PayrollLog | `payrolllogs` | 0 | `employeeId` ObjectId (model) |
| Transaction | `transactions` | 0 | teacher finance |
| Counters | — | **missing** | N/A |

Also present (out of business-code scope): `messages`, `teacherassignmentsegments`, `sepaywebhookevents`, etc. — not modified; messaging not audited for writes.

### Model / index summary

| Model | Field | Required | Unique | Sparse | Notes |
|-------|-------|----------|--------|--------|-------|
| Student | `studentCode` | no (default `''`) | **no** | **yes** | [`models/Student.js`](../../models/Student.js) index `studentCode_1` |
| Teacher | `teacherCode` | — | — | — | field does not exist |
| Employee | `employeeCode` | — | — | — | field does not exist |
| Course | `courseCode` | — | — | — | field does not exist; `slug` unique |
| Course | `slug` | yes (practically) | **yes** | no | URL identity — keep |
| PaymentSession | `sessionId` | yes | **yes** | — | primary session key |
| PaymentSession | `ref` | yes | no | — | compound with status |
| Invoice | `maHoaDon` | yes | **yes** | — | independent of studentCode |
| Invoice | `hocVien` | yes | no | — | ObjectId FK |

**Index readiness for unique business codes:** **NOT YET SAFE** (legacy non-canonical codes; no prod duplicate proof; teacher/employee/course fields missing).

---

## 3. Student code audit (this env)

| Metric | Value |
|--------|------:|
| total | 4 |
| missing / empty | 0 |
| whitespace-only | 0 |
| TTH | 0 |
| HV pad-6 canonical (`HV######`) | 0 |
| HV timestamp-like (`HV` + ≥8 digits) | **4** |
| HV other | 0 |
| other | 0 |
| duplicates exact | **0** |
| duplicates case-insensitive | **0** |
| duplicates trim+CI | **0** |
| unpaid with code | 1 (`HV15865369`) |

**Sample codes:** `HV45836680`, `HV81146854`, `HV85357155`, `HV15865369`

**Classification:** all **LEGACY_FORMAT** (timestamp generator). None **VALID** canonical.

### Generator findings (report only — not fixed)

| Finding | Evidence | Risk | Path | Recommended fix (later) | Migration impact |
|---------|----------|------|------|-------------------------|------------------|
| Server uses `Date.now()` | `HV${Date.now().slice(-8)}` | Race / non-monotonic | [`routes/studentRoutes.js`](../../routes/studentRoutes.js) ~768–770 | Atomic counter | Replace on create path (C2+) |
| FE generates `TTH`+timestamp | `useState(() => TTH…)` | QR ≠ DB if cash path; can persist TTH if sent | [`AddStudentModal.jsx`](../../client/src/components/admin/shared/AddStudentModal.jsx) | Server-only code; FE display from response | Must strip client code |
| Enrollment CK uses TTH | `TTH`+id slice | Session ref may hold TTH not studentCode | [`AddEnrollmentModal.jsx`](../../client/src/components/admin/shared/AddEnrollmentModal.jsx) | Use returned/server studentCode | Legacy refs in sessions (TTL) |
| Tuition fallback `_id` slice / `HV001` | display/QR | Wrong identity | [`TuitionPaymentModal.jsx`](../../client/src/components/TuitionPaymentModal.jsx) | Always DB studentCode | Compatibility |
| Branch hint documents TTH | UI copy | Process drift | [`BranchManagementTab.jsx`](../../client/src/components/BranchManagementTab.jsx) | Update docs/UI later | Low |

---

## 4. Teacher / Employee / Course code audit

| Entity | Field exists | With code | Missing | Duplicate |
|--------|--------------|-----------|---------|-------------|
| Teacher | **NO** | 0 / 4 | 4 | N/A |
| Employee | **NO** | 0 / 0 | 0 docs | N/A |
| Course | **NO** | 0 / 1 | 1 | N/A |

**Report only:** fields not present — do not add in C1.

---

## 5. Multi-course & teacher assignment

| Check | Result (this env) | Code/schema |
|-------|-------------------|-------------|
| Schema allows N enrollments / student | **PASS** | `Student.enrollments[]` with `courseId`, `teacherId` |
| Students with ≥2 enrollments | **0** (data) | Schema still allows |
| Students with ≥2 distinct teachers | **0** (data) | Schema still allows |
| Assignment API uses ObjectIds | **PASS** | `assignTeacher(studentId, teacherId, enrollmentId)` |
| HV number must equal GV number | **PASS** — no such rule | — |

**Verdict:** Multi-course **PASS** (schema). Teacher assignment independence **PASS**. Migration must **not** create one Student per Course.

---

## 6. Messaging isolation

| Check | Result |
|-------|--------|
| `studentCode` / `teacherCode` in `services/messaging*` | **NONE** |
| Messaging docs under `docs/messaging` | **NONE** for business codes |
| conversationId uses business codes | **NO** (ObjectId / role pairs) |

**Messaging isolation: PASS**  
If any dependency appears later: **STOP / REPORT ONLY** — do not edit messaging to unblock migration.

---

## 7. Counter audit

| Check | Result |
|-------|--------|
| `counters` collection | **does not exist** |
| Atomic `$inc` business sequence | **absent** |
| Current create path | `Date.now()` — **not** race-safe / not monotonic under concurrency |

**Counter readiness:** **NOT READY** (design exists in Phase B; not implemented). C1 did **not** create counters.

---

## 8. Duplicate audit

| Entity | Exact | Case-insensitive | Trim+CI |
|--------|-------|------------------|---------|
| Student.studentCode | none | none | none |
| Teacher.teacherCode | N/A | N/A | N/A |
| Employee.employeeCode | N/A | N/A | N/A |
| Course.courseCode | N/A | N/A | N/A |

**This env:** clear. **Production:** unknown → still a **blocker**.

---

## 9. Payment / finance audit (summary)

See [`PHASE_C1_PAYMENT_COMPATIBILITY.md`](./PHASE_C1_PAYMENT_COMPATIBILITY.md).

| Path | Uses studentCode? | Uses _id? | Uses invoice? | Uses PaymentSession.ref? |
|------|-------------------|-----------|---------------|--------------------------|
| SePay session match | No (primary) | optional studentId on session (schema lacks field) | via settle | **Yes — primary** |
| SePay student fallback | **Yes** | update by `_id` after match | creates Invoice | No |
| Invoice history | No | `hocVien` | `maHoaDon` | No |
| Ledger | No | `studentId` | `sourceRef` often HD… | No |

**Risk note (report only):** unpaid fallback loops candidates and **`break`s on first** successful match — not “count matches → fail closed if >1”. With non-unique `studentCode`, Scenario D is **PICK-FIRST** today (severity P1). Target policy wants FAIL CLOSED — future change only after owner approve; **not in C1**.

---

## 10. Migration blockers

| Blocker | Status |
|---------|--------|
| Production audit unavailable | **ACTIVE → C2 BLOCKED** |
| Duplicate codes (this env) | Clear |
| Ambiguous payment multi-match | **Code behavior PICK-FIRST** (policy wants fail-closed) — **REVIEW** |
| Non-atomic sequence | **ACTIVE** (Date.now) |
| Unique index premature | Must not create until prod clean + backfill |
| Frontend-generated TTH | **ACTIVE** (report only) |
| Timestamp-generated HV | **ACTIVE** |
| Messaging dependency | **NONE** |
| Teacher assignment on business code | **NONE** |
| Invoice/Ledger unclear | **CLEAR** — ObjectId based |

---

## 11. Owner decisions required

1. Provide **production** Mongo read-only access / attestation and re-run C1.  
2. Approve `legacyStudentCodes[]` on Student (vs alias collection) before any backfill.  
3. Decide whether webhook multi-match must become fail-closed **before** unique index (recommended).  
4. Approve global sequence (already Phase B default).  
5. Approve PHASE C2 scope: generator-only vs generator+compatibility schema (still no unique index until later).

---

## 12. Recommended PHASE C2 (not started)

```text
PHASE C2 = BLOCKED until production re-audit PASS (or owner explicit waiver — not recommended).

When unblocked (doc only for now):
  C2a: CodeGeneratorService + counters (create path only)
  C2b: Strip FE generators; ignore client-supplied codes
  C2c: legacyStudentCodes schema (no backfill yet or dry-run only)
  Still forbidden until later gates: unique index, prod backfill write
```

---

## PHASE C1 STATUS

```text
Application code changed: NO
Database changed: NO
Messaging changed: NO
Payment runtime changed: NO

Production audit: BLOCKED

Student code audit:
  4 legacy HV+timestamp; 0 canonical; 0 missing; 0 dup (this env)

Teacher code audit:
  field missing; 4 teachers → all MISSING

Employee code audit:
  field missing; 0 employees

Course code audit:
  field missing; 1 course; slug intact

Duplicate audit:
  none on this env; prod UNKNOWN

Payment compatibility: REVIEW
  (session-first OK; legacy rename needs alias; FE TTH risk; multi-match pick-first)

Multi-course: PASS (schema)

Teacher assignment independence: PASS

Messaging isolation: PASS

Index readiness: NOT YET SAFE

Counter readiness: NOT READY (collection missing)

Dry-run: PASS (in-memory only; see MIGRATION_PREVIEW)

Migration blockers:
  - PRODUCTION AUDIT BLOCKED
  - Non-atomic Date.now generators
  - FE TTH generators
  - studentCode index non-unique + webhook pick-first

Owner decisions required:
  - Prod URI + re-audit
  - legacyStudentCodes approval
  - Fail-closed multi-match policy timing
  - C2 start approval

Recommended PHASE C2: BLOCKED
```

---

```text
STOP — await owner review. Do not migrate. Do not modify DB.
```
