# Dead Code Analysis

## 1. Overview
This report identifies legacy authorization code and related utilities that are no longer referenced or executed anywhere in the backend application architecture, rendering them "dead code."

## 2. Dead Code Inventory

### 2.1 Unused Authorization Wrappers (`shared/middleware/authMiddleware.js`)
The following middleware exports are dead code. They are not imported by any file in the `routes/` directory.
- `isAdmin`
- `isSuperAdmin`
- `isTeacher`
- `isStaff`
- `checkPermission`
- `checkAnyPermission`
- `requireRole` (Internal helper)
- `requirePermission` (Internal helper)

### 2.2 Unused Constants & Permission Aliases
While `shared/constants/permissions.js` has been updated to house the new Enterprise RBAC catalog (e.g., `STUDENT_CREATE`, `SETTINGS_UPDATE`), older alias variables (if any remain) are dead.
- **Legacy String Constants**: The frontend UI might still expect strings like `manage_students` in the API payload, but the backend routing engine no longer uses these strings for validation.

### 2.3 Unused Imports
A widespread audit via `npm run lint` during Phase 6 regression testing confirmed that the `routes/` layer is clean. There are no dangling or unused imports of `isAdmin` or `checkPermission` in the routing files following the Batch 4 automated migration script.

## 3. Impact Assessment
- Keeping this dead code introduces no runtime performance penalty, as it is never executed.
- Keeping this dead code introduces technical debt, cognitive load for developers, and potential security risks if a developer inadvertently uses an old guard instead of the `authorize()` RBAC engine on a new route.

## 4. Recommendation
The identified unused authorization wrappers and internal helpers inside `authMiddleware.js` must be purged in the upcoming Sprint 3.7 removal phase.
