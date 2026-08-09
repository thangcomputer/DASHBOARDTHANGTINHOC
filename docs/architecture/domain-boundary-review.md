# Domain Boundary Review (Batch 2)

## 1. Overview
Sprint 4.1 Batch 2 relocated the core business domains (`student`, `teacher`, `course`, `enrollment`, `attendance`). As a strictly structural sprint, no logic was refactored. This document analyzes the cross-domain dependencies surfaced by the relocation, highlighting boundaries that currently violate modular isolation and must be addressed in future refactoring sprints (Sprint 4.2+).

## 2. Cross-Domain Dependencies Detected

### 2.1 Student ↔ Teacher
- **Dependency Type**: Direct Model Access (High Risk).
- **Locations**: `modules/teacher/routes/teacherRoutes.js` queries `Student` model directly for assignment interactions. `modules/student/routes/studentRoutes.js` queries `Teacher` model directly.
- **Remediation Target**: Introduce `TeacherService.getAssignedTeachers(studentId)` and `StudentService.getStudentsByTeacher(teacherId)`. Models must not cross domain boundaries.

### 2.2 Course ↔ Student / Teacher
- **Dependency Type**: Direct Model Access & Shared Orchestration.
- **Locations**: `modules/course/routes/courseRoutes.js` imports both `Student` and `Teacher` models to populate course participants and instructors.
- **Remediation Target**: `CourseService` should maintain reference IDs (e.g., `teacherId`, `studentIds`). When hydration is required, it should invoke `TeacherService.getProfiles(teacherIds)` synchronously.

### 2.3 Enrollment ↔ Finance (Future Batch)
- **Dependency Type**: Circular Orchestration.
- **Locations**: `modules/enrollment/services/enrollmentService.js` directly requires `Invoice` (from legacy `finance`) to generate bills upon enrollment. The legacy `finance` module requires `Student` to verify enrollment status.
- **Remediation Target**: Transition to Domain Events. `EnrollmentService` should emit `StudentEnrolledEvent`. The `Finance` module (via `events/studentEnrolled.listener.js`) will listen to this event and asynchronously generate the invoice.

### 2.4 Attendance ↔ Course / Teacher
- **Dependency Type**: Direct Model Access.
- **Locations**: `modules/attendance/routes/scheduleRoutes.js` directly imports `Course` and `Teacher` models to validate existence before creating a schedule.
- **Remediation Target**: `AttendanceService` must call `CourseService.validateCourse(courseId)` and `TeacherService.checkAvailability(teacherId, timeSlot)` prior to writing to the `Schedule` repository.

## 3. Circular Dependencies
While no unresolvable Node.js `require()` cycle crashes the application (due to deferred execution in route handlers), logical circular dependencies exist:
- **`Teacher` ↔ `Course`**: Teachers need to know their courses, courses need to know their teachers.
- **Resolution Strategy**: Establish one entity as the Root Aggregate, or rely strictly on junction tables (e.g., `TeacherAssignmentSegment`) querying via Service interfaces rather than bidirectional Mongoose `populate()`.

## 4. Architectural Directives for Future Sprints
1. **Implement Repository Pattern**: Extract all `mongoose.model()` calls out of Controllers and Services into the `repositories/` folder for each domain.
2. **Implement DTOs (Data Transfer Objects)**: Standardize cross-domain payloads. When `StudentService` returns a user profile to `FinanceService`, it must return a standard `StudentDTO`, not a raw Mongoose Document.
3. **Event-Driven Pub/Sub**: Heavy reliance on the `events/` folder will be mandatory to break horizontal transactional dependencies (e.g., Notification triggers).
