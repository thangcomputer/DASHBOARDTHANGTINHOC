# Transaction Boundary Review (Batch 3)

## 1. Overview
Sprint 4.1 Batch 3 structurally relocated the Transactional and Event-driven domains (`finance`, `payment`, `invoice`, `transaction`, `exam`, `certificate`, `analytics`, `report`). As per ARB directives, no logic was refactored. This document details the cross-domain coupling currently present within these operational modules that must be rectified via Domain Events and Repositories in future Sprints.

## 2. Transaction Boundary Analysis

### 2.1 Finance / Invoice ↔ Student / Enrollment
- **Dependency Type**: Direct Object Manipulation & Circular Orchestration.
- **Locations**: `modules/invoice/routes/invoiceRoutes.js` and `modules/finance/services/ledgerService.js` directly query the `Student` Mongoose model to verify enrollment status before generating billing ledgers.
- **Remediation Target**: Implement Domain Events (e.g., `EnrollmentCompletedEvent`). The Finance domain must subscribe to these events rather than querying the Student CRM synchronously.

### 2.2 Payment ↔ Invoice / Transaction
- **Dependency Type**: Tight Coupling (Internal).
- **Locations**: `modules/payment/routes/webhookRoutes.js` imports both `Invoice` and `Transaction` models natively.
- **Remediation Target**: Since these all belong to the broader financial aggregate, the `PaymentSession` webhook processor should invoke `InvoiceService.markAsPaid(invoiceId)` and `TransactionService.record(payload)`, rather than directly inserting into the `Transaction` collection.

### 2.3 Exam ↔ Course
- **Dependency Type**: Corequisite Data Access.
- **Locations**: `modules/exam/services/examProgressService.js` imports the `Course` model to validate that an examination belongs to a valid curriculum structure before grading it.
- **Remediation Target**: The `ExamService` should call `CourseService.getCourseDetails(courseId)` via a synchronous API contract, establishing `Course` as a distinct bounded context that owns its own data.

### 2.4 Analytics ↔ Global Domains
- **Dependency Type**: Massive Cross-Domain Mongoose Aggregations.
- **Locations**: `modules/analytics/routes/analyticsRoutes.js` performs heavy `$lookup` pipelines across `Student`, `Teacher`, and `Course` collections simultaneously.
- **Remediation Target**: The `analytics` domain must transition into an isolated Read Model (CQRS). Instead of running live aggregations against primary collections, it should consume Domain Events (e.g., `StudentRegistered`, `CourseCompleted`) to update an optimized `AnalyticsSnapshot` table.

### 2.5 Report (Audit/SystemLog) ↔ Global Interceptor
- **Dependency Type**: Necessary Global Infrastructure Dependency.
- **Locations**: Nearly all mutation actions across `student`, `teacher`, and `course` currently trigger `AuditLog` via the centralized `AuditLogger` (now properly bounded inside `shared/logger/`).
- **Remediation Target**: This dependency is structurally sound. Future optimizations will involve publishing audit logs to a Redis queue rather than executing synchronous MongoDB writes during the HTTP request cycle.

## 3. Circular Dependencies Identified
- **Finance ↔ Invoice**: The `ledgerService.js` modifies `Invoice` states, while `invoiceRoutes.js` relies on `ledgerService.js` to calculate current balances. This is a monolithic aggregate that currently spans two domains.
- **Resolution Strategy**: Consolidate into a unified `Finance` aggregate root, or clearly define `Invoice` as a subordinate module that solely handles PDF generation and layout, leaving the state machine purely to the `Ledger`.

## 4. Architectural Directives for Future Sprints
1. **Event Bus Implementation**: The most critical path for resolving Transactional coupling is the implementation of an Event Bus (e.g., BullMQ).
2. **DTO Contracts**: Modules like Analytics require vast amounts of data. DTOs must be explicitly defined to prevent Analytics pipelines from breaking when internal Mongoose schemas change within `Student` or `Teacher`.
