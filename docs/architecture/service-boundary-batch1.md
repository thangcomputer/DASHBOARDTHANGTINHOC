# Service Boundary — Batch 1

## Architecture After Batch 1

```
Express Route
     ↓
 Middleware (authMiddleware, authorize, rateLimiter)
     ↓
 Controller (orchestration only)
     ↓
 Application Service (business logic only)
     ↓
 Repository (persistence only)
     ↓
 MongoDB
```

## Domain Boundary Summary

| Domain | Routes File | Controller | Application Service | Repository |
|--------|-------------|-----------|---------------------|-----------|
| auth | authRoutes.js | AuthController | AuthApplicationService | authRepository (Teacher/Student) |
| notification | notificationRoutes.js | NotificationController | NotificationApplicationService | notificationRepository |
| tenant | tenantRoutes.js | TenantController | TenantApplicationService | tenantRepository |
| branch | branchRoutes.js | BranchController | BranchApplicationService | branchRepository |
| system | settingsRoutes.js | SystemController | SystemApplicationService | systemRepository |

## Cross-Domain Dependencies After Batch 1

| Service | Calls |
|---------|-------|
| BranchApplicationService | studentRepository, teacherRepository, tenantService |
| TenantApplicationService | branchRepository |
| AuthApplicationService | teacherRepository, studentRepository, systemRepository |

> **Note**: Cross-domain service calls (Service → Repository of another domain) are still present as a **temporary** accommodation per ARB Sprint 4.3 conditions. These will be resolved in Sprint 4.4 via proper Service-to-Service calls.

## Boundary Violations (Remaining, Tracked)
- `BranchApplicationService` calls `studentRepository` and `teacherRepository` directly for cascade deletes. This is a known cross-domain coupling to be resolved in Batch 2 or Sprint 4.4 via a Domain Event.
- `AuthApplicationService` calls `teacherRepository` and `studentRepository`. This is the Auth domain's identity resolution concern and is acceptable until a dedicated `IdentityService` is introduced.
