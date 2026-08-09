# S3 — LIVE module alignment runbook

**Status:** GATED — do not flip Enterprise PRIMARY  
**LIVE authority remains:** `constants/permissions.js` + `middleware/auth.js` + CutoverGate  
**Prerequisite:** S0 matrix · S1 shadow catalog · S2 `dataScope` observe

This runbook defines **how** to align LIVE one module at a time. Each module PR must keep deny behavior reviewable and reversible.

---

## Order (mandatory)

1. **student** — profiles, list/get, branch/teacher scope  
2. **teacher** — view/manage, assign  
3. **ticket** — support track (today proxied by `manage_messages` / inbox until dedicated ticket routes exist)  
4. **class / enrollment** — schedule overlap  
5. **finance** — keep `view_branch_revenue` ≠ `finance:view`  
6. **settings / audit** — SUPER/HIGH forbidden lists  

Do not start module N+1 until module N has: scope filter server-side, tests, and no Enterprise promote.

---

## Per-module checklist

- [ ] Map LIVE coarse keys → enterprise CRUD used on this module only  
- [ ] Server filter by `resolveDataScope` / `assertInScope` (enforce only after dual-check soak)  
- [ ] UI hide buttons for forbidden ops (UX only; server still enforces)  
- [ ] Forbidden rules from matrix (HIGH/STAFF/SUPPORT/SUPER self-delete) covered  
- [ ] Policy shadow still mounted; CutoverGate unchanged unless explicitly gated  
- [ ] Tests: allow in-scope + deny out-of-scope + SUPPORT not Staff  
- [ ] `ENTERPRISE_PRIMARY_READY` stays **NO**

---

## Module 1 — student (started)

### LIVE keys

| Action | LIVE today | Target |
|---|---|---|
| List / manage | `manage_students` | `student:view|create|update|delete` |
| Teacher list own | role `teacher` bypass on list | scope `OWN_AND_ASSIGNED_CLASS` |

### Wired (observe — no deny change)

- `GET /api/students` → `dataScopeObserve('student')` after `policyShadowStudentRead('list')`  
- Helpers: `shared/security/authorization/dataScope.js`  
- Shadow map includes `student:view` under `manage_students`

### Next enforce steps (separate PR)

1. Dual-check soak: design scope vs legacy branchFilter on list/get_one  
2. Enforce branch filter for STAFF using trusted `branchCode` only  
3. Enforce teacher assigned-student on get_one/update  
4. Student self routes: own-id only  
5. Do **not** grant SUPPORT `manage_students` CRUD

---

## Module 2 — teacher (pending)

- LIVE: `view_teachers`, `manage_teachers`  
- Keep manage ≠ view  
- HIGH/SUPER may CRUD; STAFF CRU related; SUPPORT R only  

---

## Module 3 — ticket (pending)

- No dedicated ticket HTTP module yet — messaging + `manage_messages`  
- Target: `ticket:close|archive` for SUPPORT; no `ticket:delete`  
- Observe today: `GET /api/messages/contacts` + `dataScopeObserve('message')`  
- When ticket routes land: mount observe then gated enforce  

---

## Module 4 — class / enrollment (pending)

- Split from `manage_schedule` / `manage_students` enrollments  
- STAFF branch/assigned; TEACHER assigned class only  

---

## Module 5 — finance (pending)

- Never collapse `view_branch_revenue` into `finance:view`  
- Destructive refund/delete: SUPER/HIGH preference; STAFF scoped  

---

## Module 6 — settings / audit (pending)

- HIGH: no high system config CRUD; no audit delete  
- STAFF/SUPPORT: no settings, no full audit  
- SUPER: no self-delete of logged-in SUPER account  

---

## Acceptance for S3 kickoff

- [x] Runbook exists  
- [x] Student observe path mounted  
- [x] Ticket/message observe path mounted (proxy)  
- [ ] Student enforce PR (not in this phase)  
- [ ] Remaining modules (not started)

**ENTERPRISE_PRIMARY_READY remains NO.**
