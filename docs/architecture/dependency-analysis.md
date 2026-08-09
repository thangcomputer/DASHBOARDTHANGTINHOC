# Dependency Analysis

## 1. Overview
This report analyzes the cross-domain coupling and shared infrastructure dependencies present in the current layered architecture. Identifying these dependencies is a prerequisite for defining clean boundaries in the Target Modular Architecture (Sprint 4).

## 2. Shared Infrastructure Dependencies
All domains heavily rely on the `shared` module for cross-cutting concerns. This is an **acceptable and expected** dependency in a modular architecture, provided the shared layer remains domain-agnostic.
- **RBAC Policy Engine**: `shared/middleware/authorize.js` and `shared/context/policy.service.js` are imported across all route definitions.
- **Logging & Audit**: `auditLogger` and `metricsCollector` are injected globally.
- **Error Handling**: `AppError` is utilized by all controllers and services.
- **Data Scoping**: `branchFilter.js` is utilized by domain controllers to enforce Multi-Branch queries.

## 3. Cross-Domain Coupling (High Risk)
The following integrations currently exhibit high coupling, often referencing Mongoose Models from other domains directly instead of communicating through Service boundaries.

### 3.1 Finance & Student / Enrollment
- **Coupling**: The `finance` module (e.g., `invoiceRoutes.js`, `ledgerService.js`) frequently queries the `Student` model directly to calculate tuition discounts or determine enrollment status.
- **Resolution Strategy**: The `finance` module should call an exposed `StudentService.getEnrollmentStatus(studentId)` method rather than importing the `Student` model directly.

### 3.2 Exam & Course / Student
- **Coupling**: `examResultRoutes.js` and `examProgressService.js` are tightly coupled to the `Course` and `Student` schemas to determine eligibility for examinations and to update global progress.
- **Resolution Strategy**: Introduce Domain Events (e.g., `ExamPassedEvent`) or use a Service-to-Service contract where `exam` notifies `course` of completion.

### 3.3 Scheduling & Teacher / Branch
- **Coupling**: `scheduleRoutes.js` references `Teacher`, `Course`, and `Branch` models directly for validation and collision detection.
- **Resolution Strategy**: The `attendance` (Scheduling) module must query `TeacherService` for availability, rather than executing raw MongoDB queries against the `Teacher` collection.

### 3.4 Notifications & Core Business Domains
- **Coupling**: Almost every module (e.g., `finance` upon payment, `course` upon assignment, `student` upon registration) imports `NotificationService` or `accountWelcome.js` directly.
- **Resolution Strategy**: Adopt an Event-Driven architecture (Pub/Sub via Redis/BullMQ or internal Node EventEmitter). Domain modules should emit events (e.g., `InvoicePaid`), and the `notification` module should listen and react independently.

## 4. Circular Dependencies
Currently, Node.js module caching mitigates runtime crashes, but logical circular dependencies exist:
- **`Course` <-> `Enrollment`**: A Course needs to know its Enrollments to calculate capacity, while an Enrollment needs to know Course details to calculate fees.
- **`Teacher` <-> `Schedule`**: Teachers hold schedules, schedules define teacher availability. 

## 5. Conclusion
To transition to a true Domain Modular Architecture, cross-domain direct Model imports must be strictly prohibited. Inter-domain communication must happen exclusively via:
1. Public Service Methods (Synchronous).
2. Domain Events / Message Queues (Asynchronous).
