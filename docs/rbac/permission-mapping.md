# Legacy to RBAC Permission Mapping

**Superseded in detail by:** [enterprise-rbac-contract.md](./enterprise-rbac-contract.md) (Phase 8.8)  
**Design matrix:** [role-crud-scope-matrix.md](./role-crud-scope-matrix.md)

**LIVE authority unchanged.** This mapping is FUTURE compatibility only (`shared/constants/legacyPermissionMapping.js`).

| Legacy Permission | Mapped Enterprise | Status |
|---|---|---|
| `manage_students` | `student:view`, `student:create`, `student:update`, `student:delete` | PARTIAL |
| `manage_finance` | `finance:view`, `finance:payment:create`, `finance:refund:approve` | PARTIAL |
| `view_branch_revenue` | `finance:branch_revenue:view` | MATCH (NOT `finance:view`) |
| `manage_hr` | `hr:manage` | MATCH |
| `manage_teachers` | `teacher:manage` | MATCH |
| `view_teachers` | `teacher:view` | MATCH |
| `system_settings` | `settings:view`, `settings:update` | PARTIAL |
| `manage_blog` | `cms:publish` | PARTIAL |
| `manage_student_training` | `student_training:manage` | MATCH (Phase 8.10; NOT `course:update`) |
| `manage_training` | `course:update`, `exam:manage` | PARTIAL (distinct from student_training) |
| `manage_staff` | `user:manage`, `staff:view/create/update/delete` | PARTIAL |
| `manage_schedule` | `schedule:*`, `class:view`, `class:update` | PARTIAL (RBAC-S1) |
| `manage_messages` | `message:*`, `ticket:view/create/update/close/archive/escalate` | PARTIAL (RBAC-S1; no `ticket:delete` for SUPPORT) |
| `view_logs` | `audit:view` | PARTIAL (RBAC-S1) |
| `view_evaluations` | — | LEGACY_ONLY |

**Rule:** Never map legacy permissions to `PERMISSIONS.ALL`. Never use Cutover `*`.

**SUPPORT note:** Shadow catalog includes `ticket:close` / `ticket:archive`. Hard `ticket:delete` exists for SUPER/HIGH design only — SUPPORT must not receive it via role defaults.
