# Student Service Review — Sprint 4.3 Batch 2

## Domain: `student`

### Architecture Before Batch 2
- **Routes File**: `modules/student/routes/studentRoutes.js` (2,833 lines)
- Contained massive Express route handlers with direct business logic.
- Included legacy queries, `Student` and `Invoice` model orchestration.
- Mixed data mapping with validation and HTTP responses.
- Handled nested routes for enrollments (`/api/students/:id/enrollments`).

### Architecture After Batch 2
- **`modules/student/services/StudentApplicationService.js`**: Contains all core student business logic (CRUD, stats, exam progress, assignment logic, finance/payment handling).
- **`modules/student/controllers/StudentController.js`**: Pure orchestration. Maps HTTP request → payload object → Service call → HTTP response.
- **`modules/student/routes/studentRoutes.js`**: Reduced to route declarations and middleware attachment.

### Endpoint Breakdown
Extracted 22 endpoints out of the Student domain.
- `GET /`, `GET /stats`, `GET /:id`, `GET /:id/full-detail`
- `POST /import`, `POST /`
- `PUT /:id`, `PUT /:id/exam-progress`, `PATCH /:id/price`
- `PUT /:id/pay`, `PUT /:id/refund`, `PUT /:id/pay-teacher`
- `PUT /:id/unlock-exam`, `PUT /:id/lock-exam`
- `PUT /:id/assign-teacher`
- `DELETE /:id`
- `POST /:id/reset-today-attendance`, `POST /:id/reset-history`

*(Note: Enrollment endpoints were explicitly split out to the `enrollment` domain during Batch 2 phase 3).*

### Boundary Compliance
- ✅ Controllers are 100% free of business rules.
- ✅ Controllers do not orchestrate repositories.
- ✅ All existing API behaviors (Responses, HTTP Codes, Error structures) are identical.
- ✅ RBAC (`authMiddleware`, `authorizeAny`) and Branch Filtering (`branchFilter`, `assertStudentBranchAccess`) remain fully intact at the Route level.
