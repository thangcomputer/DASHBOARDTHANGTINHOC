# Role × CRUD × Data Scope Matrix

**Status:** DESIGN CONTRACT — NON-AUTHORITATIVE on LIVE  
**Date:** 2026-08-10  
**LIVE authority (unchanged):** `constants/permissions.js` + `middleware/auth.js` + Policy adapter + CutoverGate  
**Enterprise:** SHADOW ONLY — do not promote `ENTERPRISE_PRIMARY_READY`

This document normalizes the product RBAC design (6 roles, CRUD, data scope) onto the existing codebase vocabulary. It does **not** change runtime authorization by itself.

Related: [permission-mapping.md](./permission-mapping.md) · [enterprise-rbac-contract.md](./enterprise-rbac-contract.md) · [s3-live-module-alignment.md](./s3-live-module-alignment.md)

---

## 1. Principles

1. Access decision = **Permission (Resource × CRUD)** AND **Data Scope**.
2. Organizational **hierarchy** ≠ business **interaction** ≠ messaging ACL.
3. JWT `role=admin` is **not** a role — resolve via `adminRole`.
4. Transport messaging roles (`admin` | `staff` | `teacher` | `student`) are **not** RBAC identity.
5. No permission inheritance like Admin ← Support ← Teacher for the target model.
6. UI hide/show is UX only; server must enforce Permission + Scope.
7. SUPPORT focuses on tickets/support — must **not** become a second Staff.

---

## 2. Role name map (product → system)

| Product name | LIVE `adminRole` / `role` | Enterprise catalog | Default Data Scope |
|---|---|---|---|
| ADMIN SUPER | `SUPER_ADMIN` (+ `id=admin` → LEGACY_ROOT) | `SUPER_ADMIN` | `ALL` |
| ADMIN CẤP CAO | `HIGH_ADMIN` | `HIGH_ADMIN` | `ALL_OPERATIONAL` |
| ADMIN STAFF | `STAFF` | `ADMIN_STAFF` | `BRANCH_ASSIGNED` |
| SUPPORT SUPER | `SUPPORT` | `SUPPORT_AGENT` (alias `SUPPORT`) | `SUPPORT_RELATED` |
| TEACHER | `teacher` | `TEACHER` | `OWN_AND_ASSIGNED_CLASS` |
| STUDENT | `student` | `STUDENT` | `OWN_AND_AUTHORIZED` |

**Note:** Product label “SUPPORT SUPER” maps to existing LIVE `SUPPORT`. Do **not** invent a new JWT role `SUPPORT_SUPER`.

---

## 3. Three layers (must not mix)

### 3.1 Hierarchy (admin chain only — who manages whom)

```text
SUPER_ADMIN
    ↓
HIGH_ADMIN
    ↓
STAFF (ADMIN_STAFF)
```

SUPPORT, TEACHER, STUDENT are **not** children of this chain for permission inheritance.

### 3.2 Support track (parallel — not under admin ops)

```text
SUPPORT (SUPPORT SUPER)
    ├── Support Ticket
    ├── Student Support
    ├── Teacher Support
    └── Escalation
            ├── → STUDENT (message)
            └── → TEACHER (message)
```

### 3.3 Training operations (business interaction)

```text
TEACHER  ↔  STUDENT
```

Also (ops / support interaction, not hierarchy):

```text
STAFF     ↔ STUDENT
STAFF     ↔ TEACHER
SUPPORT   ↔ STUDENT
SUPPORT   ↔ TEACHER
```

Messaging participant ACL remains separate (Phases 8.21–8.23B).

---

## 4. Data Scope enum

| Code | Who | Meaning | Resolver inputs (server-trusted) |
|---|---|---|---|
| `ALL` | SUPER_ADMIN | Entire system | none |
| `ALL_OPERATIONAL` | HIGH_ADMIN | All operational data; **no** high system config / SUPER management | none (minus forbidden resources) |
| `BRANCH_ASSIGNED` | STAFF | Branch + assigned operational records | `branchId` / `branchCode` from JWT/DB |
| `SUPPORT_RELATED` | SUPPORT | Tickets + minimal profiles needed for support | ticket assignee/participant; not full CRUD student/course |
| `OWN_AND_ASSIGNED_CLASS` | TEACHER | Self + assigned classes + students in those classes | `teacherId`, enrollments, `assignedStudents` |
| `OWN_AND_AUTHORIZED` | STUDENT | Self + content explicitly granted | `student_id = me`, enrollment, published content ACL |

**Hard rules**

- Scope never comes from client `body` / `query` as authority.
- Teacher `student:view` ⇒ `WHERE class/enrollment assigned to teacher` — never all students.
- Student `result:view` ⇒ `WHERE student_id = current_user`.

Runtime helpers (observe / dual-check only until S3 gates):  
`shared/security/authorization/dataScope.js` + `middleware/dataScopeObserve.js`.

---

## 5. Permission shape (target)

```text
{resource}:{action}
action ∈ create | view | update | delete | close | archive
```

Optional composite `manage` may exist in LIVE today but design audits must expand to C/R/U/D when documenting gaps.

### Resource groups

| Resource | Examples |
|---|---|
| `user` / `staff` / `high_admin` / `support_agent` | Account & role admin |
| `student` | Student profiles |
| `teacher` | Teacher profiles / approval |
| `course` / `class` / `enrollment` / `schedule` | Training ops |
| `lesson` / `exam` / `result` | Content & assessment |
| `ticket` | Support tickets (`ticket:close` / `ticket:archive` — not hard-delete for SUPPORT) |
| `message` | Direct/support messaging |
| `finance` / `payment` | Payments, payroll-adjacent |
| `report` | Analytics/revenue views |
| `settings` | System configuration |
| `audit` | Logs / audit trail |

---

## 6. Role × Resource × CRUD matrix (design target)

Legend: `CRUD` = all four · `R` · `RU` · `CRU` · `—` = none · `*` = scoped only

### 6.1 SUPER_ADMIN — scope `ALL`

| Resource | C | R | U | D | Notes |
|---|---|---|---|---|---|
| user / all roles | ✓ | ✓ | ✓ | ✓* | **No Delete button for the SUPER account currently logged in** |
| high_admin | ✓ | ✓ | ✓ | ✓ | |
| staff | ✓ | ✓ | ✓ | ✓ | |
| support_agent | ✓ | ✓ | ✓ | ✓ | |
| student / teacher | ✓ | ✓ | ✓ | ✓ | |
| course / class / enrollment | ✓ | ✓ | ✓ | ✓ | |
| lesson / exam | ✓ | ✓ | ✓ | ✓ | |
| result / payment | ✓ | ✓ | ✓ | ✓* | Prefer soft constraints on destructive ops |
| ticket / message | ✓ | ✓ | ✓ | ✓ | |
| report | — | ✓ | — | — | |
| settings | ✓ | ✓ | ✓ | ✓ | |
| audit | — | ✓ | — | — | No delete |

### 6.2 HIGH_ADMIN — scope `ALL_OPERATIONAL`

**Allowed:** manage Staff, Student, Teacher, Course, Class, Enrollment; track ops; view reports; handle issues in scope.

| Resource | C | R | U | D |
|---|---|---|---|---|
| staff | ✓ | ✓ | ✓ | ✓ |
| student / teacher | ✓ | ✓ | ✓ | ✓ |
| course / class / enrollment | ✓ | ✓ | ✓ | ✓/— |
| report | — | ✓ | — | — |
| settings (high) | — | —/R | — | — |
| audit | — | R* | — | — |

**Forbidden (explicit):**

- Create / edit SUPER_ADMIN role or account
- Change SUPER_ADMIN permissions
- Modify high-level system configuration
- View or change user passwords
- Delete audit logs
- Self-promote account to SUPER_ADMIN

### 6.3 STAFF (`ADMIN_STAFF`) — scope `BRANCH_ASSIGNED`

**Data tree:** STUDENT · TEACHER · COURSE · CLASS · ENROLLMENT (branch/assigned).

| Resource | C | R | U | D |
|---|---|---|---|---|
| student | ✓ | ✓ | ✓ | ✓* |
| teacher | ✓ | ✓ | ✓ | — |
| class / schedule | ✓ | ✓ | ✓ | —/✓* |
| enrollment | ✓ | ✓ | ✓ | — |
| ticket / support ops | ✓ | ✓ | ✓ | ✓* |
| high_admin / settings / full audit | — | — | — | — |

**Forbidden (explicit):**

- Manage HIGH_ADMIN
- Change system permissions
- Delete important data that already has financial/transaction history
- View full system audit logs
- Access system configuration

### 6.4 SUPPORT — scope `SUPPORT_RELATED`

Support must **not** become a second Staff (no full student/course/class/enrollment admin).

| Function | C | R | U | D |
|---|---|---|---|---|
| ticket create / view / update | ✓ | ✓ | ✓ | — |
| close / archive ticket | — | ✓ | ✓ | — |
| hard-delete ticket | — | — | — | **Denied** (Close/Archive only) |
| student profile (minimal) | — | ✓ | — | — |
| teacher profile (minimal) | — | ✓ | — | — |
| reply Student / Teacher (message) | ✓ | ✓ | ✓ | — |
| transfer / escalate to Admin | ✓ | ✓ | ✓ | — |
| course/class full CRUD | — | R* | — | — |

### 6.5 TEACHER — scope `OWN_AND_ASSIGNED_CLASS`

Instructor / content provider — not a system admin.

| Resource | C | R | U | D |
|---|---|---|---|---|
| own profile | — | ✓ | ✓ | — |
| assigned class | — | ✓ | ✓* | — |
| students in class | — | ✓ | — | — |
| lesson / homework / exam | ✓ | ✓ | ✓ | ✓* |
| results | ✓ | ✓ | ✓ | ✓* |
| message (participants) | ✓ | ✓ | ✓ | ✓* |
| own support ticket | ✓ | ✓ | ✓ | — |

### 6.6 STUDENT — scope `OWN_AND_AUTHORIZED`

Most restricted scope: **own + explicitly authorized only**.

| Resource | C | R | U | D |
|---|---|---|---|---|
| own profile | — | ✓ | ✓ | — |
| authorized course/class | — | ✓ | — | — |
| own teacher (class) | — | ✓ | — | — |
| learning content | — | ✓ | — | — |
| own exam attempt | ✓ | ✓ | ✓ | — |
| own results | — | ✓ | — | — |
| own ticket | ✓ | ✓ | ✓ | ✓* |
| message with own teacher/staff | ✓ | ✓ | ✓ | ✓* |

**Forbidden:** any other student’s profile/results/payments/tickets; other teachers’ private data; any admin-level data.

---

## 7. Summary matrix — 16 functions (parity checklist)

| Chức năng | Super Admin | Admin Cao | Staff | Support | Teacher | Student |
|---|---|---|---|---|---|---|
| Quản lý Admin | CRUD | R/U* | — | — | — | — |
| Quản lý Staff | CRUD | CRUD | — | — | — | — |
| Quản lý Support | CRUD | CRUD* | — | — | — | — |
| Quản lý Student | CRUD | CRUD | CRUD* | R/U | R* | R* |
| Quản lý Teacher | CRUD | CRUD | CRUD | R/U | R/U* | R* |
| Quản lý khóa học | CRUD | CRUD | CRUD | R | R* | R |
| Quản lý lớp | CRUD | CRUD | CRUD | R | R/U* | R |
| Đăng ký khóa học | CRUD | CRUD | CRUD | R | R* | C/R* |
| Nội dung học tập | CRUD | CRUD | CRUD* | R | CRUD* | R |
| Bài kiểm tra | CRUD | CRUD | CRUD* | R | CRUD* | C/R |
| Kết quả | CRUD | R/U | R | R* | CRUD* | R* |
| Hỗ trợ / Ticket | CRUD | CRUD | CRUD | CRUD† | CRUD* | CRUD* |
| Thanh toán | CRUD | CRUD/R | CRUD* | R* | R* | R* |
| Báo cáo | R | R | R* | R* | R* | R* |
| Cấu hình hệ thống | CRUD | R/U* | — | — | — | — |
| Audit Log | R | R* | — | — | — | — |

`*` = data-scoped only.  
`†` Support ticket = CRU + close/archive; **no hard-delete**.

---

## 8. LIVE permission map + gaps

LIVE keys today (`constants/permissions.js` / client mirror):

| LIVE key | Covers (coarse) | Target Resource×CRUD (approx) | Gap |
|---|---|---|---|
| `manage_students` | Student ops | `student:create/view/update/delete` | Not split C/R/U/D |
| `view_teachers` | Teacher read | `teacher:view` | OK-ish |
| `manage_teachers` | Teacher approve/score | `teacher:update` (+ workflow) | Create/delete unclear |
| `manage_schedule` | Schedule | `schedule:*` / `class:*` | No class/enrollment split |
| `manage_messages` | Inbox/support chat | `message:*` (+ ticket overlap) | Ticket vs message not separated |
| `manage_finance` | Finance mutate | `finance:*` | Too broad vs revenue view |
| `view_branch_revenue` | Revenue read | `report` / `finance:branch_revenue:view` | Mapped in Enterprise |
| `manage_training` | Teacher training | `course/exam` teacher-side | Overlaps student training |
| `manage_student_training` | Student training | distinct training resource | Keep separate |
| `manage_hr` | HR/payroll | `hr:*` | Enterprise `hr:manage` |
| `manage_blog` | CMS | `cms:*` | |
| `manage_staff` | Staff admin | `staff:*` / `user:manage` | SUPER-leaning |
| `system_settings` | Settings | `settings:*` | |
| `view_logs` | Audit read | `audit:view` | |
| `view_evaluations` | Internal evals | eval resource | LEGACY-ish |

### Explicit gaps vs design matrix

1. No first-class **ticket** permission separate from `manage_messages`.
2. No CRUD-split for students/teachers/classes (LIVE uses coarse `manage_*`).
3. SUPPORT defaults only `manage_messages` — ticket close/archive not explicit on LIVE.
4. STAFF scope is mostly **branch**; “assigned student/class” finer scope needs consistent enrollment checks.
5. Enterprise shadow catalog expanded in S1; LIVE remains coarse — **parity observe only** until S3 gates.

See also: [permission-mapping.md](./permission-mapping.md), [enterprise-rbac-contract.md](./enterprise-rbac-contract.md).

---

## 9. Anti-inheritance contract

**Do not** use permission inheritance chains such as:

```text
ADMIN_STAFF inherits SUPPORT + TEACHER
SUPPORT inherits STUDENT
TEACHER inherits STUDENT
```

(Reference dormant pattern in `modules/rbac/rolePermissions.js` — **not** LIVE authority, and **not** the target model.)

Target model:

- Each role gets an **explicit** permission set.
- Scope narrows the record set.
- Org hierarchy only limits **who can manage whom** (SUPER → HIGH → STAFF), not automatic permission union.

---

## 10. Evaluation algorithm (target)

```text
1. Authenticate → trusted actor { id, role, adminRole, branchId, permissions[] }
2. Resolve required permission for route/action (Resource × CRUD)
3. If permission missing → DENY
4. Resolve actor Data Scope
5. Load/filter target records under Scope
6. If record outside Scope → DENY
7. Else ALLOW
```

Special cases:

- SUPER_ADMIN / `id=admin`: permission bypass for LIVE today; design still forbids **self-delete**.
- HIGH_ADMIN: permission array gated (no full bypass) + forbidden list in §6.2.
- SUPPORT: never hard-delete tickets — close/archive only.
- Messaging: participant / `canAccessDirectConversation` / `assertCanDirectMessage` remain messaging ACL until mapped to `message:*`.

---

## 11. Roadmap (docs → shadow → align LIVE)

| Phase | Work | LIVE change? | Enterprise promote? |
|---|---|---|---|
| **S0 (this doc)** | Matrix + scope enum + gaps + forbidden lists | No | No |
| **S1** | Expand Enterprise shadow catalog CRUD codes; map LIVE↔enterprise | No (shadow) | No |
| **S2** | Scope resolver helpers + observe/dual-check on student list + message contacts | Observe only | No |
| **S3** | Align one module at a time (see [s3-live-module-alignment.md](./s3-live-module-alignment.md)) | Yes, gated | No |
| **S4** | Readiness review only | — | Manual only — never auto |

**Out of scope for S0–S2:** JWT schema change, DB migration, Enterprise PRIMARY, rewriting all routes at once.

---

## 12. Messaging note

Keep Phases 8.21–8.23B contracts, plus **Phase 8.24 pairing lock**:

- STAFF/SUPPORT transport `staff` + per-user conversationId
- SUPER/HIGH legacy `admin_admin` for student mailbox where contract allows
- Display identity by user id — never role `admin` alone → SUPER profile
- Allow-list pairing + canonical peer from DB — see [../messaging/pairing-matrix-824.md](../messaging/pairing-matrix-824.md)
- Never trust client `receiverRole` when building `conversationId`

Map later to `message:create|view|update|delete` with participant scope — without collapsing Support into Staff admin ops.

---

## 13. Acceptance for this design phase

- [x] 6 roles named and mapped to LIVE/Enterprise codes  
- [x] CRUD separated from Data Scope  
- [x] Hierarchy ≠ Support track ≠ Training DM documented  
- [x] Forbidden lists for HIGH / STAFF / SUPPORT / SUPER self-delete  
- [x] Ticket close/archive vs hard-delete  
- [x] 16-function summary matrix  
- [x] LIVE gaps listed without changing LIVE deny  
- [x] Anti-inheritance stated  
- [x] No Enterprise promotion  

**ENTERPRISE_PRIMARY_READY remains NO.**
