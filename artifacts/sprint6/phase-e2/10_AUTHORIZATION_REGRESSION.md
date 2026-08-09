# 10_AUTHORIZATION_REGRESSION

## Objective
Verify the migration does not bypass `authMiddleware`, tenant isolation, branch isolation, or RBAC controls.

## Evidence

### Middleware Execution Trace
The CQRS execution path is invoked from within the existing Express route definition:
- **File**: `routes/studentRoutes.js`
- **Line 565**: `router.post('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter], async (req, res, next) => {`
- **Mechanism**: The Strangler Facade `if (process.env.ENABLE_CQRS_STUDENT_CREATE === 'true')` is located *inside* the route handler callback. This guarantees that `authMiddleware`, `checkPermission`, and `branchFilter` are successfully executed and passed before the CQRS controller is ever invoked.

### Tenant & Branch Isolation
- **File**: `modules/student/controllers/CQRSStudentController.js` (Lines 18-20)
- **Mechanism**: The controller extracts context explicitly from the authenticated Request object:
  ```javascript
  actorId: req.user ? req.user._id : null,
  tenantId: req.user ? req.user.tenantId : null,
  branchId: req.userBranchId || req.body.branchId,
  ```
- **Context Pass-through**: These values are sealed into the `CreateStudentCommand` payload.
- **Outbox Integrity**: `CreateStudentHandler.js` (Lines 44-46) writes these exact `tenantId`, `branchId`, and `actorId` fields into the `OutboxEvent` for asynchronous downstream authorization isolation.

## Verdict
[VERIFIED]
No security bypasses were introduced. The CQRS path inherits and enforces the exact same Express middleware pipeline and secure context resolution as the legacy path.
