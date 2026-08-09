# Service Boundary — Batch 2

## Architecture After Batch 2

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

| Domain | Controller | Application Service |
|--------|-----------|---------------------|
| student | `StudentController` | `StudentApplicationService` |
| teacher | `TeacherController`<br>`EmployeeController`<br>`StaffController` | `TeacherApplicationService`<br>`EmployeeApplicationService`<br>`StaffApplicationService` |
| course | `CourseController`<br>`AssignmentController`<br>`TrainingController`<br>`TeachingGuideController` | `CourseApplicationService`<br>`AssignmentApplicationService`<br>`TrainingApplicationService`<br>`TeachingGuideApplicationService` |
| enrollment | `EnrollmentController` | `EnrollmentApplicationService` |
| attendance | `AttendanceController` | `AttendanceApplicationService` |

## Cross-Domain Dependencies After Batch 2
Cross-domain service calls remain as a permitted structural anomaly per Sprint 4.3 rules. The immediate priority is extracting controllers, not restructuring inter-service dependencies.
- `StudentApplicationService` calls `TeacherRepository` and `InvoiceRepository`.
- `EnrollmentApplicationService` calls `StudentRepository`.

These will be fixed in Sprint 4.4 via Domain Events.
