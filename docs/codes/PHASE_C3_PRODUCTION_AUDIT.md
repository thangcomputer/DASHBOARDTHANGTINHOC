# PHASE C3 — PRODUCTION BUSINESS CODE AUDIT

**Date:** 2026-08-11  
**Environment:** Workspace / agent session (no production credentials)  
**Production database:** **NOT IDENTIFIED**  
**Read-only:** YES (no production connection attempted with write capability; no local data re-labeled as production)  
**Application code changed:** NO  
**Database changed:** NO  
**Messaging changed:** NO  
**Payment runtime changed:** NO  

---

## Executive Verdict

```text
PRODUCTION MIGRATION = BLOCKED
PRODUCTION AUDIT = BLOCKED
```

**Reason:** No MongoDB URI in this workspace can be unambiguously identified as production. The only configured connection is local/dev:

```text
127.0.0.1:27018 / dashboardthangtinhoc
```

C3 forbids treating that host as production. Without a confirmed production target, student/teacher/employee/course/counter counts, duplicates, and collision analysis on production **cannot** be executed. Faking a production audit from local data is explicitly prohibited.

---

## Production Target Verification

```text
PRODUCTION_TARGET:
host: (unavailable)
database: (unavailable)
environment: UNKNOWN
confidence: NONE
```

| Candidate source | Value observed | Verdict |
|------------------|----------------|---------|
| [`.env`](../../.env) `MONGODB_URI` | `mongodb://127.0.0.1:27018/dashboardthangtinhoc?replicaSet=rs0` | **LOCAL/DEV — NOT production** |
| [`.env.example`](../../.env.example) | localhost examples | Not production |
| [`.env.deploy.example`](../../.env.deploy.example) | VPS deploy path only; **no Mongo URI** | Insufficient |
| [`client/.env.production`](../../client/.env.production) | Same-origin API comment only | No Mongo URI |
| Docker / CI | `mongo:27017` / CI DB names | Not production app data |

```text
STOP
PRODUCTION AUDIT = BLOCKED
```

No production query was run. Local Mongo was **not** audited under a production label in this phase.

---

## Student Audit

```text
Status: BLOCKED (no production data)
total students: UNKNOWN
missing studentCode: UNKNOWN
empty studentCode: UNKNOWN
canonical HV######: UNKNOWN
legacy HV+timestamp: UNKNOWN
TTH count: UNKNOWN
unexpected formats: UNKNOWN
duplicate studentCode groups: UNKNOWN
duplicate legacyStudentCodes: UNKNOWN
students with legacyStudentCodes: UNKNOWN
students with both canonical + legacy: UNKNOWN
students without legacy alias: UNKNOWN
```

**Code readiness (implementation, not prod data):** [`models/Student.js`](../../models/Student.js) has `studentCode` + `legacyStudentCodes`; create paths use [`services/businessCodeService.js`](../../services/businessCodeService.js).

---

## Teacher Audit

```text
Status: BLOCKED (no production data)
total teachers: UNKNOWN
missing teacherCode: UNKNOWN
empty teacherCode: UNKNOWN
canonical GV######: UNKNOWN
unexpected formats: UNKNOWN
duplicate teacherCode groups: UNKNOWN
```

**Code readiness:** `teacherCode` on Teacher model; minted on teacher create, staff create, public teacher register.

Teacher codes are **independent** of student codes (separate counter `_id: "teacher"`). No HV↔GV assignment coupling in code.

---

## Employee Audit

```text
Status: BLOCKED (no production data)
total employees: UNKNOWN
missing employeeCode: UNKNOWN
empty employeeCode: UNKNOWN
canonical NV######: UNKNOWN
unexpected formats: UNKNOWN
duplicate employeeCode groups: UNKNOWN
```

**Code readiness:** `employeeCode` on Employee model; minted on `POST /api/employees`. Payroll still uses `employeeId` ObjectId (unchanged by design).

---

## Course Audit

```text
Status: BLOCKED (no production data)
total courses: UNKNOWN
missing courseCode: UNKNOWN
empty courseCode: UNKNOWN
canonical KH######: UNKNOWN
unexpected formats: UNKNOWN
duplicate courseCode groups: UNKNOWN
```

**Code readiness:** `courseCode` on Course model; `slug` remains separate URL identity. Create strips client `courseCode` and assigns via generator.

---

## Counter Audit

```text
Status: BLOCKED (no production data)
counters collection on production: UNKNOWN
student / teacher / employee / course seq: UNKNOWN
counter.seq >= max canonical suffix: UNKNOWN
COUNTER_SAFE: BLOCKED
```

Local counters exist from C2 local migration only — **not** evidence of production counter state.

---

## Duplicate / Collision Audit

```text
Status: BLOCKED (no production data)
Duplicate audit: BLOCKED
Cross-field studentCode ↔ legacyStudentCodes collisions: UNKNOWN
```

Cannot approve uniqueness or SePay ambiguity clearance without production scan.

---

## Payment Compatibility Audit

**Runtime not changed in C3.** Live **code** inspection (workspace):

| Rule | Evidence | Status |
|------|----------|--------|
| Session-first | [`routes/webhookRoutes.js`](../../routes/webhookRoutes.js) matches `PaymentSession.ref` before student fallback | PASS (code) |
| Fallback `studentCode` OR `legacyStudentCodes` | `$or` query + [`selectUnpaidStudentCandidates`](../../utils/sepayMatch.js) | PASS (code) |
| Fail-closed ≥2 | `selection.status === 'ambiguous'` → log + no settle (webhook + CQRS twin) | PASS (code) |
| Invoice/Ledger ObjectId | Models use `hocVien` / `studentId`; no studentCode FK | PASS (code) |
| PaymentSession.ref rewrite | No migration/write in C3; C2 did not rewrite refs | PASS (design) |
| Live SePay on production | Not exercised | **NOT LIVE-TESTED** |

```text
Payment compatibility: REVIEW
(code fail-closed verified; production live payment NOT LIVE-TESTED)
```

---

## Frontend Generator Audit

| Surface | Finding | Severity |
|---------|---------|----------|
| `AddStudentModal` | Uses `POST /api/students/reserve-code`; no `TTH`+`Date.now` | PASS |
| `AddEnrollmentModal` | Uses `student.studentCode` only | PASS |
| `TuitionPaymentModal` | Blocks if missing server code; no `_id` slice fallback | PASS |
| `RegistrationForm` | CK content = branch + **name slug** + “Nop hoc phi” — **not** a persisted business code | NON-BLOCKING note |
| `useDataAdminCrud.addStudent` | Forwards `reservedStudentCode` | PASS |
| Server create (student/teacher/employee/course/auth) | `businessCodeService` | PASS |

Residual note: debug ingest `fetch` instrumentation from a prior debug session remains in some files — **out of C3 scope** (C3 does not modify application code). Does not invent business codes.

```text
Frontend generator audit: PASS (repo scan)
```

---

## Multi-Course Verification

**Schema/code:** One `Student` document → one `studentCode` → `enrollments[]` with `courseId` / `teacherId`. No per-enrollment studentCode generator found.

```text
Multi-course: PASS (code/schema)
Production multi-enrollment samples: UNKNOWN (no prod data)
```

---

## Teacher Assignment Verification

Assignment APIs use ObjectIds (`studentId`, `teacherId`, `enrollmentId`). No comparison of `studentCode` to `teacherCode` for assignment.

```text
Teacher assignment independence: PASS (code)
```

---

## Unique Index Readiness

```text
UNIQUE INDEX = BLOCKED
```

Conditions unmet:

1. Production duplicate scan unknown  
2. Production missing-code counts unknown  
3. Production migration not executed  
4. Production counter safety unknown  
5. Live payment soak not run  

Do not create unique indexes.

---

## Migration Readiness

| Gate | Verdict |
|------|---------|
| STUDENT_MIGRATION_SAFE | **BLOCKED** |
| TEACHER_MIGRATION_SAFE | **BLOCKED** |
| EMPLOYEE_MIGRATION_SAFE | **BLOCKED** |
| COURSE_MIGRATION_SAFE | **BLOCKED** |
| COUNTER_SAFE | **BLOCKED** |
| PAYMENT_COMPATIBILITY_SAFE | **REVIEW** (code PASS; prod NOT LIVE-TESTED) |
| UNIQUE_INDEX_SAFE | **BLOCKED** |

```text
PRODUCTION MIGRATION = BLOCKED
```

---

## Blocking Findings

1. **Production Mongo URI not available / not confirmable** in workspace secrets or `.env`.  
2. Cannot quantify production duplicates, legacy formats, or missing codes.  
3. Cannot verify production `counters.seq` vs max canonical suffix.  
4. Unique indexes and `--execute` migration remain forbidden.  

---

## Non-Blocking Findings

1. C2 foundation (generator, fail-closed SePay matcher, FE reserve-code) is present in application source.  
2. Local/dev was previously migrated in C2 — irrelevant as production evidence.  
3. `RegistrationForm` still builds transfer text from name (session-first), not a client-minted HV/TTH canonical identity.  
4. Prior debug-session instrumentation (`fetch` to local ingest) still present in a few files — cleanup is a hygiene task for a later approved phase, not C3.

---

## Required Owner Decisions

1. Provide a **production** Mongo connection string (preferably read-only user) and explicitly attest:  
   `PHASE_C3_PRODUCTION_CONFIRMED=YES` + URI host/db name.  
2. Confirm backup timestamp before any future C4 write.  
3. Confirm whether production already has any C2 schema fields (`legacyStudentCodes`, `teacherCode`, etc.) from a partial deploy.  
4. Approve whether C4 may run migration dry-run then `--execute` only after a clean re-audit.

---

## Recommended Phase C4

Only after owner supplies confirmed production read access:

1. Re-run C3 audit script **against production** (read-only).  
2. If duplicates/collisions/counter gaps → STOP with report; no auto-fix.  
3. If clean → dry-run migration preview.  
4. Owner approve → execute migration with `PRODUCTION_MIGRATION_CONFIRMED=YES`.  
5. Re-verify counters + zero duplicates.  
6. Only then consider unique indexes.  
7. Optional: production payment soak (non-destructive / sandbox) for fail-closed confirmation.

```text
Do not start C4 automatically.
```

---

## Rollback Considerations

No production writes occurred in C3 — **nothing to roll back**.

Future C4 must retain C2 rollback design: restore `studentCode` from `legacyStudentCodes`; never delete entities; never rewrite Invoice/Ledger/Message history. See [`PHASE_C2_ROLLBACK.md`](./PHASE_C2_ROLLBACK.md).

---

## PHASE C3 STATUS BLOCK

```text
PHASE C3 COMPLETE

Application code changed: NO
Database changed: NO
Messaging changed: NO
Payment runtime changed: NO

Production audit: BLOCKED
Student audit: BLOCKED
Teacher audit: BLOCKED
Employee audit: BLOCKED
Course audit: BLOCKED
Counter readiness: BLOCKED
Duplicate audit: BLOCKED
Payment compatibility: REVIEW
Unique index readiness: BLOCKED
Migration readiness: BLOCKED

Critical findings:
- Production Mongo target not identified (only 127.0.0.1:27018 local)
- Cannot approve migration or unique indexes

Non-critical findings:
- Application source already has C2 generator + fail-closed SePay
- RegistrationForm name-based CK is session content, not business-code mint

Owner decisions required:
- Supply attested production read-only MONGODB_URI
- Confirm backup + field-deploy state before C4

Recommended Phase C4:
- Prod re-audit → dry-run → owner-approved execute → indexes

STOP.
Do not start C4 automatically.
```
