# Enterprise RBAC Contract (Phase 8.8)

**Status:** FUTURE TARGET — NON-AUTHORITATIVE on LIVE  
**LIVE authority:** `constants/permissions.js` + `middleware/auth.js` + Policy adapter + CutoverGate

## New enterprise permissions (Phase 8.8)

| Code | LIVE key | Notes |
|------|----------|-------|
| `hr:manage` | `manage_hr` | 1:1 employees CRUD+pay+payroll |
| `teacher:manage` | `manage_teachers` | score/approve/reject (+ branch) |
| `finance:branch_revenue:view` | `view_branch_revenue` | Read-only; NOT `finance:view` |
| `student_training:manage` | `manage_student_training` | Distinct from teacher `manage_training` (Phase 8.10) |

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

Dual-read, dual-check, `authorize()` on LIVE, auth/Policy/Cutover/finance changes.
