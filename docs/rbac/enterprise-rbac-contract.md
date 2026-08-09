# Enterprise RBAC Contract (Phase 8.8)

**Status:** FUTURE TARGET — NON-AUTHORITATIVE on LIVE  
**LIVE authority:** `constants/permissions.js` + `middleware/auth.js` + Policy adapter + CutoverGate

## Design matrix (CRUD × Data Scope)

Product role matrix and scope model: **[role-crud-scope-matrix.md](./role-crud-scope-matrix.md)**  
(ADMIN SUPER / HIGH / STAFF / SUPPORT / TEACHER / STUDENT — design only; does not change LIVE.)

## New enterprise permissions (Phase 8.8)

| Code | LIVE key | Notes |
|------|----------|-------|
| `hr:manage` | `manage_hr` | 1:1 employees CRUD+pay+payroll |
| `teacher:manage` | `manage_teachers` | score/approve/reject (+ branch) |
| `finance:branch_revenue:view` | `view_branch_revenue` | Read-only; NOT `finance:view` |
| `student_training:manage` | `manage_student_training` | Distinct from teacher `manage_training` (Phase 8.10) |

## Expanded shadow catalog (RBAC-S1)

Added (non-LIVE) CRUD codes aligned to [role-crud-scope-matrix.md](./role-crud-scope-matrix.md):

- `staff:*`, `high_admin:*`, `support_agent:*`
- `class:*`, `enrollment:*`, `lesson:*`, `exam` CRUD split, `result:*`
- `message:*`, `ticket:view|create|update|close|archive|delete|escalate`
- `report:view`, `audit:view`, `settings:view`

`manage_schedule` / `manage_messages` / `view_logs` moved from LEGACY_ONLY → PARTIAL mapping.  
Still **shadow only** — do not mount `authorize()` on LIVE from these codes.

## Role aliases

| LIVE | Enterprise |
|------|------------|
| SUPER_ADMIN | SUPER_ADMIN |
| HIGH_ADMIN | HIGH_ADMIN (now in `shared/constants/roles.js`) |
| STAFF | ADMIN_STAFF |
| SUPPORT | SUPPORT_AGENT |
| teacher | TEACHER |
| student | STUDENT |
| JWT admin / staff | NOT a role — resolve via `adminRole` |
| id=admin | LEGACY root ≅ SUPER_ADMIN (comparison only) |

Contract helper (non-runtime): `shared/constants/roleAliasContract.js`

## Mapping

See `shared/constants/legacyPermissionMapping.js`.

Finance safety: revenue view ≠ payment/refund/ledger mutate.

## Deprecate

`shared/enums/PermissionCode.js` — third taxonomy; do not use for migration.

## Not in this phase

Dual-read deny, `authorize()` replacing LIVE on all routes, auth/Policy/Cutover/finance semantic changes, Enterprise PRIMARY.

## RBAC-S2 / S3 kickoff

- Scope helpers: `shared/security/authorization/dataScope.js`
- Observe middleware: `middleware/dataScopeObserve.js` (student list + message contacts)
- Module runbook: [s3-live-module-alignment.md](./s3-live-module-alignment.md)
