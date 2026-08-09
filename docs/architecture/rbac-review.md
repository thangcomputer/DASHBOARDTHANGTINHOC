# RBAC Review
## Current Roles
- Admin: Unrestricted (or specifically scoped via permissions)
- Staff: Support roles, managing students
- Teacher: Managing assignments, grading
- Student: Consuming content, submitting work
- Support: Customer interaction

## Permission Matrix
- Strictly defined in `shared/enums/PermissionCode.js`.

## Privilege Escalation Risks
- Mitigated by strict schema validations preventing role injection.

## Missing Guards
- Cross-tenant validation needs stricter boundaries (Branch/Tenant isolation).

## Ownership Validation
- Mostly implemented.

## Tenant & Branch Isolation
- Planned for explicit tenant ID enforcement.
