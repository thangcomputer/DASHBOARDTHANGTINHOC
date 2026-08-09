# SECURITY CONTRACT FREEZE — Wave 5.5

**Status:** FROZEN (read-only documentation)  
**Date:** 2026-08-09  
**Authority:** Live path `server.js → routes/* → middleware/auth.js → constants/permissions.js`  
**Policy engine:** NOT mounted  
**CQRS production flags:** MUST remain OFF  

This document freezes the authorization/security contract that any future Policy Strangler must reproduce **exactly** before replacing legacy middleware.

---

## A. Role Contract

### Messaging / JWT `role` (live)

| Role | Source | Global Scope | Branch Scope | Tenant Scope | Special Ownership |
|------|--------|--------------|--------------|--------------|-------------------|
| `admin` | JWT / Teacher.role or hardcoded `id=admin` | Platform (with Super semantics when adminRole/id allows) | Via `adminRole` + `branchFilter` | Optional `X-Tenant-Id` for Super/High | Full admin APIs when permissions allow |
| `staff` | Teacher.role | No | Bound when `adminRole` is STAFF/SUPPORT/HIGH with branch | Partial (Super header only) | Branch resources + permissions[] |
| `teacher` | Teacher.role | No | Own branch on teacher record (not forced via branchFilter for non-staff) | Not used | Assigned students; self teacher record |
| `student` | JWT role (Student model) | No | Own branch on student record | Not used | Self only |

### Staff elevation `adminRole` (Teacher schema enum)

| adminRole | Global Scope | Branch Scope | Notes |
|-----------|--------------|--------------|-------|
| `SUPER_ADMIN` | Yes (empty `branchFilter`) | Optional `?branch_id` narrow | Permission bypass in `checkPermission` |
| `HIGH_ADMIN` | No default all-branch | Must use `?branch_id` or account branch | Permissions checked (no bypass) |
| `STAFF` | No | Forced `req.userBranchId` | permissions[] |
| `SUPPORT` | No | Forced like STAFF | Default `manage_messages` |

### Special identities

| Identity | Scope |
|----------|--------|
| Hardcoded `id === 'admin'` | Super-equivalent for permission checks |

---

## B. Permission Contract

**Live taxonomy:** `constants/permissions.js` (mirrored in `client/src/constants/permissions.js`).

| Permission | Description | Read | Write | Delete | Branch Scoped | Tenant Scoped |
|------------|-------------|------|-------|--------|---------------|---------------|
| `manage_students` | Student CRUD / assign / exam unlock | Yes | Yes | Yes | Yes (via branchFilter) | No |
| `manage_schedule` | Schedule management | Yes | Yes | Yes | Yes | No |
| `manage_finance` | Pay / refund / invoices / teacher pay | Yes | Yes | Limited | Yes | No |
| `manage_messages` | Messaging / support | Yes | Yes | — | Partial | No |
| `manage_training` | Teacher training / quiz admin / teacher exam | Yes | Yes | — | Yes | No |
| `manage_student_training` | Student exam bank / training | Yes | Yes | — | Yes | No |
| `manage_staff` | Staff accounts | Yes | Yes | — | Super-heavy | No |
| `manage_hr` | Employees / payroll HR | Yes | Yes | Yes | Yes | No |
| `manage_blog` | Blog CMS | Yes | Yes | Yes | Global CMS | No |
| `system_settings` | System settings / reset | Yes | Yes | Destructive | System-wide | No |
| `view_logs` | System logs | Yes | No | No | — | No |
| `view_evaluations` | Evaluations view | Yes | No | No | — | No |
| `view_branch_revenue` | Analytics revenue | Yes | No | No | Branch | No |
| `view_teachers` | Teacher list/view | Yes | **No** | No | Yes | No |
| `manage_teachers` | Teacher score/approve/reject | — | Yes | — | Yes | No |

**Invariant:** `view_teachers` does **not** grant `manage_teachers` (proven by Wave 5.1 tests).

**Not present in live taxonomy:** `CREATE_*`, `UPDATE_*`, `DELETE_*`, `APPROVE_*`, `SCORE_*` as separate keys — writes are folded into `MANAGE_*`.

**Unmounted RBAC taxonomy** (`shared/constants/permissions.js` / `modules/rbac/rolePermissions.js`) uses a **different** vocabulary (`COURSE_VIEW`, `STUDENT_CREATE`, …). It is **not** the live contract.

---

## C. Route Authorization Matrix (security-sensitive, mounted)

Abbreviated; middleware names refer to live Express stack.

| Family | Method | Path (prefix `/api`) | Permission / Gate | Role exception | Branch | Ownership | Realtime | Finance |
|--------|--------|----------------------|-------------------|----------------|--------|-----------|----------|---------|
| Students | GET | `/students` | `manage_students` unless teacher | Teacher ownership filter | `branchFilter` | Teacher→assigned | scoped | — |
| Students | POST | `/students` | `manage_students` | — | `branchFilter` | — | scoped | settle on create if paid |
| Students | PUT | `/students/:id` | staff→`manage_students` | Teacher allowlist / self | assertStudentBranch | Yes | scoped | paid fields stripped |
| Students | PUT | `.../pay` `.../refund` | `manage_finance` | — | assertStudentBranch | — | scoped | ledger |
| Teachers | PUT | `.../score\|approve\|reject` | `manage_teachers` | — | assertTeacherBranch | — | emitTeacherEvent | — |
| Teachers | POST | `/teachers` | Super only | — | branchFilter | — | emitTeacherEvent | — |
| Teachers | finance pay | `.../finance/pay-*` | `manage_finance` + Super | — | Super | — | emitFinanceEvent | postSalary |
| Schedules | * | `/schedules` | auth + role | Teacher/student self | branchFilter | teacher/student | emitScheduleEvent | — |
| Quiz | GET | `/quizzes/admin/all` | `manage_training` | — | teacher branch filter | — | — | — |
| ExamResult | * | `/exam-results` | type-based manage_* / teacher relation | Student GET self | subject branch | Yes | emitDataRefresh | — |
| Assignment | POST/PUT | `/assignments` | staff→`manage_students` | Teacher assigned | student branch | Yes | course_/student_ | — |
| Evaluation | POST | `/evaluations` | student self | — | teacher branch on refresh | student→teacher | scoped refresh | — |
| Transactions | * | `/transactions` | `manage_finance` | — | branchFilter | — | emitFinanceEvent | ledger |
| Webhooks | POST | `/webhooks/sepay` | HMAC/API key | system | from claimed student/session | — | emitFinanceEvent | settlePayment |
| Settings | PUT | `/settings/*` | SYSTEM_SETTINGS / training perms | — | system-wide | — | emitSystemWide | — |
| Settings | POST | `/settings/reset-data` | SYSTEM_SETTINGS + Super password | — | system | — | SYSTEM_RESET | wipe |
| Employees | * | `/employees` | `manage_hr` | — | branchFilter | — | emitBranch | — |
| Auth | POST | `/auth/logout` | — | — | — | — | — | blacklist refresh |
| Messages | * | `/messages` | auth + chat access | — | conversation | participants | io.to(user) | — |

---

## D. Branch Contract

| Source | Classification | Behavior |
|--------|----------------|----------|
| JWT `branchId` | **TRUSTED** (at issue time) | Written at login from DB |
| DB Teacher.branchId during `branchFilter` | **TRUSTED** | Sets `req.userBranchId` |
| `req.userBranchId` | **DERIVED / TRUSTED** | Used by assert*BranchAccess + emits |
| Resource Student/Teacher.branchId | **TRUSTED** | Compared to `req.userBranchId` |
| Socket register client `branchId` | **UNTRUSTED / IGNORED** | JWT only |
| Query `?branch_id` | **UNTRUSTED for STAFF**; Super may narrow | STAFF cannot expand |
| Body `branchId` | **UNTRUSTED** for branch-bound; Super create may set | Staff forced to own branch |

**Missing branch on resource (exam mutations):** DENY for branch-bound actors (fail-closed).

---

## E. Tenant Contract

**Status: PARTIAL / soft**

| Input | Behavior |
|-------|----------|
| `X-Tenant-Id` / `tenant_id` | Only platform Super/High via `applyTenantScopeIfAny` |
| Invalid / missing / suspended | Soft-ignore (no hard 403) |
| JWT tenant | Not primary live field |
| Resource tenantId | Ledger may store; STAFF isolation is **branch-first** |

**INV-03** applies only where tenant scoping is actually applied (Super filter), not for all STAFF requests.

---

## F. Ownership Contract (legacy rules Policy must reproduce)

1. **Teacher → students:** `studentMatchesTeacher` (root `teacherId` or enrollment.teacherId) or `assignedStudents`.
2. **Student → self:** JWT id === studentId for reads/updates/submit.
3. **Teacher → self:** score own teacher exam; edit own profile; cannot manage other teachers without manage_teachers + branch.
4. **Staff → branch resources:** permission + `userBranchId` match.
5. **Finance:** `manage_finance` + branch assert (or Super for teacher salary pay-*).
6. **Assignment:** teacher only for own students; staff needs `manage_students`.
7. **ExamResult:** teacher student results only for assigned; teacher-type results for self or manage_training.

---

## G. Socket Contract

| Room / Target | Audience | Join auth | Emitter | Class |
|---------------|----------|-----------|---------|-------|
| `branch_<id>` | Branch members | register from JWT | emitBranch | BRANCH |
| userId room | That user | register | emitUser / messages | USER |
| `teacher_<id>` | Teacher (+ limited admin) | teacher:join verified | emitTeacherEvent | USER |
| `student_<id>` | Student (+ limited admin) | student:join verified | assignment/exam | USER |
| `course_<id>` | Unknown clients | **No join handler** | assignment emit | UNKNOWN |
| `ALL_ADMIN` / `ALL_STAFF` / `ALL_SUPPORT` / `ALL_TEACHER` / `ALL_STUDENT` | Role | register | emitSystemWide / notify | ROLE |
| `ALL_USERS` message | Everyone | admin broadcast | io.emit message | SAFE GLOBAL (admin-gated) |
| `feed_room` | Authenticated | feed:join | feed | PUBLIC-ish |
| `GLOBAL` | — | **Denied** | — | DENY |
| SYSTEM_RESET | Authenticated roles | — | emitSystemWide | SYSTEM |

Payload sensitivity: finance/exam/teacher events must stay BRANCH/USER; settings refresh payload is type-only (no secrets).

---

## H. CQRS Contract

| Flag | Default | Production Allowed? | Security Gate | Realtime Path |
|------|---------|---------------------|---------------|---------------|
| `ENABLE_CQRS_TEACHER` | off | **NO** until notification module aligned | validateEnv + Super create gate | `emitTeacherEvent` in TeacherApplicationService |
| `ENABLE_CQRS_STUDENT_CREATE` | off | **NO** until path audit | validateEnv | Must match student scoped emits |
| `ENABLE_CQRS_INVOICE` | off | **NO** until path audit | validateEnv | Must not global-emit finance |

**Rule:** flags remain OFF in production until activated paths use hardened contracts end-to-end (including `modules/notification` if used).

---

## I. Legacy → Policy Mapping

Live Policy files: `modules/rbac/policy.service.js` + tenant/branch/ownership/condition — **unmounted**.

| Legacy Rule | Policy Equivalent | Match | Gap |
|-------------|-------------------|-------|-----|
| `checkPermission(manage_*)` | PermissionService + shared taxonomy | **MISSING** | Different permission strings vs live `constants/permissions.js` |
| `branchFilter` + assert*Branch (fail-closed if no branch) | branch.policy | **PARTIAL** | Policy allows when resource has no branch; live exam DENY |
| Super bypass | Super Admin bypass in policies | **EXACT** (concept) | — |
| HIGH_ADMIN must have grants | — | **MISSING** | Not modeled as distinct from Super bypass carefully |
| Teacher ownership via enrollments | ownership.policy field match | **PARTIAL** | No `studentMatchesTeacher` / enrollment walk |
| Staff manage others' students | ownership would DENY | **MISSING** | Needs staff+permission bypass context |
| Soft tenant ignore | tenant.policy missing→allow | **PARTIAL** | Aligns loosely; no soft-ignore logging semantics |
| VIEW ≠ WRITE | live tests | **AMBIGUOUS** in Policy | Policy rolePermissions use different verbs |
| Mass-assignment DTOs | — | **MISSING** | Not a Policy concern; remain in controllers |
| Socket room auth | — | **MISSING** | Out of Policy HTTP chain |

---

## J. Security Invariants

| ID | Invariant |
|----|-----------|
| INV-01 | Client `branchId` cannot override trusted branch (`userBranchId` / JWT / DB). |
| INV-02 | Cross-branch mutation is denied (403). |
| INV-03 | Cross-tenant mutation denied **where tenant isolation applies** (currently Super filter only). |
| INV-04 | `VIEW_*` does not grant write (`view_teachers` ≠ `manage_teachers`). |
| INV-05 | Protected fields cannot be mass-assigned (exam/assignment DTOs). |
| INV-06 | Financial mutation is idempotent (ledger / payment keys). |
| INV-07 | Refund cannot exceed eligible `paidAmount` (atomic claim). |
| INV-08 | Teacher payout cannot execute twice (Transaction unique idempotencyKey + postSalary). |
| INV-09 | Sensitive socket events are not globally broadcast. |
| INV-10 | Socket room membership cannot be spoofed (JWT register; GLOBAL denied). |
| INV-11 | CQRS activation cannot reintroduce global sensitive emitters (`teacher:new` fixed; notification module pending). |
| INV-12 | Frontend guards are never backend authorization. |

---

## K. Golden Test Baseline

**Suite label:** `GOLDEN SECURITY TESTS`  
**Command:**

```bash
node --test \
  tests/integration/wave51_authz_branch.test.js \
  tests/integration/wave52_realtime_isolation.test.js \
  tests/integration/wave53_realtime_cleanup.test.js \
  tests/integration/wave54_exam_assignment_cqrs.test.js \
  tests/integration/wave_repair_authz.test.js \
  tests/integration/checkPermission.test.js \
  tests/integration/auth.test.js
```

**Frozen count:** **58/58 PASS** (verified Wave 5.5).

Critical scenarios covered:

| Scenario | File |
|----------|------|
| Cross-branch teacher / student | wave51 |
| Cross-branch exam / assignment DTO | wave54 |
| Mass assignment stripping | wave54 |
| Socket branch spoof / GLOBAL | wave52 |
| User room isolation | wave52 |
| amountsMatch fail-closed | wave_repair |
| CQRS teacher emitter | wave54 |
| VIEW ≠ WRITE teachers | wave51 / wave_repair |
| Settings / SYSTEM_RESET role rooms | wave53 |

Finance duplicate refund/payout: **enforced in code**; dedicated race suite still **NEEDS VERIFICATION** (not blocking freeze, but required before claiming INV-07/08 under load).

---

## L. Policy Migration Rules

1. Policy must reproduce legacy authorization before replacing it.  
2. No behavior changes during the first strangler phase.  
3. One route family at a time.  
4. Legacy authorization remains fallback during migration.  
5. Compare legacy decision vs Policy decision.  
6. Any mismatch = STOP.  
7. Financial routes migrate last.  
8. Authentication routes migrate last.  
9. Socket authorization must not change simultaneously with HTTP Policy migration.  
10. No big-bang Policy mount.

---

## M. Remaining Security Risks (accepted at freeze)

- P2: `modules/notification` global emitters if CQRS uses that copy  
- P2: `course_*` rooms without join authorization  
- P2: Tenant soft-ignore  
- P2: GET student detail without `manage_students`  
- Policy taxonomy mismatch with live permissions  
- Ownership policy incompatible with staff management without redesign  

---

## N. Readiness Gate

**READY WITH CONDITIONS**

Conditions:

1. Align or adapter-map Policy permission taxonomy to live `constants/permissions.js` before strangler.  
2. Extend branch/ownership policies to match fail-closed + staff+permission + teacher enrollment rules.  
3. Keep CQRS flags OFF; finish notification module emit parity before teacher CQRS ON.  
4. Keep GOLDEN 58/58 green on every Policy PR.  
5. Do not change socket contracts in the same PR as first HTTP Policy strangler.

---

## O. Recommended First Policy Route Family

**`GET/PUT teacher score|approve|reject` + teacher branch assert**  
(or **quiz `GET /admin/all`**) — narrow surface, already permission + branch clean, non-financial, strong golden coverage.

**Do not start with:** finance, webhooks, auth, messages, SYSTEM_RESET.

---

*End of freeze. Do not mount Policy. Do not enable CQRS production flags.*
