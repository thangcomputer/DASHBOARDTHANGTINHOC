# Enrollment Service Review — Sprint 4.3 Batch 2

## Domain: `enrollment`

### Architecture Before Batch 2
- **Routes Files**: No standalone routes file existed. Enrollment routes (`/api/students/:id/enrollments`) were deeply embedded into `modules/student/routes/studentRoutes.js`.
- **Logic**: A massive `put_id_enrollments_enrollmentId_settings` method handled branch validation, RBAC checking, and payload validation.

### Architecture After Batch 2
- **`modules/enrollment/services/EnrollmentApplicationService.js`**: Contains the core logic for the 4 enrollment HTTP endpoints extracted from `studentRoutes.js` (create, modify settings, pay, delete).
- **`modules/enrollment/controllers/EnrollmentController.js`**: Orchestration logic mapping `/api/students/:id/enrollments` from the student router over to the new enrollment service.
- **`modules/enrollment/services/enrollmentService.js`**: Retained as internal domain helper.

### Endpoint Breakdown
- `POST /api/students/:id/enrollments` (Add new enrollment)
- `PUT /api/students/:id/enrollments/:enrollmentId/settings` (Modify enrollment)
- `PUT /api/students/:id/enrollments/:enrollmentId/pay` (Pay specific enrollment)
- `DELETE /api/students/:id/enrollments/:enrollmentId` (Delete specific enrollment)

### Boundary Compliance
- ✅ Successfully detached from the `StudentController`.
- ✅ Follows proper encapsulation rules.
- ✅ Resolves domain leakage between Student and Enrollment at the Controller level.
