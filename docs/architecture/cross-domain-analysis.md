# Cross-Domain Analysis

## 1. Overview
The ARB requested a detailed analysis of cross-domain coupling following the Repository Migration of the Core Domains in Sprint 4.2 Batch 2.
Direct Mongoose Model imports have been strictly eliminated across the system, but cross-domain Repository usage remains temporarily allowed as part of the controller design.

## 2. Identified Entanglements

### 2.1 `studentRoutes.js` (Student Domain)
**Coupled to:**
- `teacherRepository` (Teacher Domain)
- `teacherAssignmentSegmentRepository` (Teacher Domain)
- `scheduleRepository` (Attendance Domain)
- `invoiceRepository` / `ledgerEntryRepository` (Finance Domain - Future Batch)
- `examResultRepository` (Exam Domain - Future Batch)
- `courseRepository` (Course Domain)

**Reasoning**: `studentRoutes.js` is acting as an orchestration layer, handling student enrollment, fee calculation, and teacher assignment directly in the route handler.

### 2.2 `scheduleRoutes.js` (Attendance Domain)
**Coupled to:**
- `studentRepository` (Student Domain)
- `teacherRepository` (Teacher Domain)

**Reasoning**: Taking attendance requires validating if a student is actually enrolled in the course and if the teacher is assigned. 

### 2.3 `courseRoutes.js` (Course Domain)
**Coupled to:**
- `studentRepository` (Student Domain)

**Reasoning**: Used to calculate current enrollment counts and prevent deletion of active courses.

### 2.4 `enrollmentService.js` (Enrollment Domain)
**Coupled to:**
- `courseRepository` (Course Domain)
- `teacherRepository` (Teacher Domain)

**Reasoning**: Normalizing enrollment records relies heavily on resolving course definitions and finding teacher identifiers.

## 3. Path to Decoupling
To achieve a true Clean Architecture / DDD state in Sprint 4.3+, these direct cross-domain repository accesses must be replaced by calls to the target domain's **Service Layer** (e.g., `studentService.getStudentEnrollments()` instead of `studentRepository.findMany()`).
