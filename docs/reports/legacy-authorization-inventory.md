# Legacy Authorization Inventory

## Overview
This report identifies all usages of legacy authorization mechanisms across the codebase that must be migrated to the new Enterprise RBAC architecture (using `authorize`, `authorizeAny`, or `authorizeAll`).

## 1. Global Guard Definitions
The following route files define a file-level `guard` array using legacy helper functions like `isAdmin`, `isSuperAdmin`, `checkPermission`, `checkAnyPermission`, etc.

- `routes/aiRoutes.js`: `[authMiddleware, isAdmin, sensitiveFlowLimiter]`
- `routes/analyticsRoutes.js`: `[authMiddleware, checkAnyPermission(PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE), branchFilter]`
- `routes/backupRoutes.js`: `[authMiddleware, isSuperAdmin]`
- `routes/biRoutes.js`: (Defined internally)
- `routes/financeRoutes.js`: (Defined internally)
- `routes/monitoringRoutes.js`: `[authMiddleware, isAdmin]`
- `routes/staffRoutes.js`: `[authMiddleware, checkPermission('manage_staff')]`
- `routes/tenantRoutes.js`: `[authMiddleware, isSuperAdmin]`
- `routes/workflowRoutes.js`: `[authMiddleware, isAdmin]`

## 2. Inline Middleware Usage
The following files apply legacy checks directly inline to specific endpoints:

- `routes/blogRoutes.js`: Heavy use of `checkPermission(PERMISSIONS.MANAGE_BLOG)`
- `routes/branchRoutes.js`: Use of `checkPermission(PERMISSIONS.SYSTEM_SETTINGS)`
- `routes/employeeRoutes.js`: Use of `[authMiddleware, isAdmin, branchFilter]`
- `routes/fileRoutes.js`: Use of `checkPermission(PERMISSIONS.SYSTEM_SETTINGS)`
- `routes/invoiceRoutes.js`: Use of `checkPermission(PERMISSIONS.MANAGE_FINANCE)`
- `routes/notificationRoutes.js`: Use of `isAdmin`
- `routes/proctorRoutes.js`: Use of `isAdmin`
- `routes/settingsRoutes.js`: Heavy use of `checkPermission(PERMISSIONS.SYSTEM_SETTINGS)` and `checkPermission(PERMISSIONS.MANAGE_TRAINING)`
- `routes/studentRoutes.js`: Use of `checkPermission(PERMISSIONS.MANAGE_STUDENTS)` and `checkPermission(PERMISSIONS.MANAGE_FINANCE)`
- `routes/systemLogRoutes.js`: Use of `isAdmin`
- `routes/teacherRoutes.js`: Heavy use of `isTeacher`, `isAdmin`, `superAdminOnlyTeacher`, `checkPermission(PERMISSIONS.VIEW_TEACHERS)`, and `checkPermission(PERMISSIONS.MANAGE_FINANCE)`
- `routes/transactionRoutes.js`: Use of `checkPermission(PERMISSIONS.MANAGE_FINANCE)` and `isTeacher`

## 3. Manual Role & Permission Checks in Controllers/Routes
The following files contain manual condition checks on the request object (e.g., `req.currentUser.roleCode === ...` or `req.currentUser.permissions.includes(...)`):

- `routes/assignmentRoutes.js`
- `routes/blogRoutes.js`
- `routes/evaluationRoutes.js`
- `routes/messageRoutes.js`
- `routes/scheduleRoutes.js`
- `routes/studentRoutes.js`
- `routes/teacherRoutes.js`
- `routes/trainingRoutes.js`
- `routes/webhookRoutes.js`

## Plan of Action
All the above instances will be replaced with the new `authorize(...)` middleware. The legacy helper functions (like `isAdmin`, `isTeacher`, `checkPermission`, `checkAnyPermission`) will be removed from the route definitions and eventually from `shared/middleware/authMiddleware.js` (or similar location) once the migration is complete.
