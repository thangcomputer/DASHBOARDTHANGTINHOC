# Technical Debt Report

## Issues Identified

| Classification | Issue | File/Module | Description |
|---|---|---|---|
| **Critical** | None | N/A | No critical debt identified blocking production. |
| **Should Fix** | Legacy Middleware | `routes/*` | 39 routes still use the legacy `guard` middleware instead of `authMiddleware` + `authorize()`. |
| **Should Fix** | Hardcoded Admin Checks | Controllers | Found scattered `req.currentUser.role === 'admin'` checks in legacy controllers that should be refactored to permissions. |
| **Can Improve** | Large Route Files | `routes/studentRoutes.js` | Over 120kb; could be split by sub-domain. |
| **Can Improve** | Unused Middleware | `shared/middleware/legacyAuth.js` | Found some legacy auth modules that can be deprecated after Sprint 4. |

## Action Items for Sprint 4
1. Migrate all `39` legacy endpoints to the new RBAC middleware.
2. Remove legacy `guard` usage.
3. Clean up old permission array schemas.
