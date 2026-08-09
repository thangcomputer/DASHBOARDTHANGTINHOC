# Repository Layer Design

## 1. Overview
This document defines the architectural blueprint for the Repository Layer across all domains in Sprint 4.2. The Repository pattern abstracts data persistence, ensuring that Business Logic (Services) and Presentation Logic (Controllers/Routes) are entirely decoupled from Mongoose, MongoDB, and schemas.

## 2. Design Principles
1. **Domain-Specific Contracts**: Repositories must not be generic CRUD wrappers. They must expose methods mapped to business intent (e.g., `StudentRepository.findEnrolledStudents()` instead of `Repository.find({ status: 'enrolled' })`).
2. **Encapsulation**: Mongoose models (`require('mongoose').model`) are ONLY permitted inside files within `modules/<domain>/repositories/`.
3. **No Fluent APIs Leaking**: Repositories must resolve and return standardized JavaScript Objects (or future DTOs) or Mongoose Documents directly, but they must NOT return unresolved Mongoose Query objects (e.g., `.populate()` or `.sort()` chains cannot be appended by the Service).

## 3. Aggregate Repository Specifications

### 3.1 Core Domains
- **`StudentRepository` (`modules/student/repositories/StudentRepository.js`)**
  - Manages `Student` and `Group` entities.
  - *Key Methods*: `findById`, `findByPhone`, `findActiveInBranch`, `assignToGroup`.
- **`TeacherRepository` (`modules/teacher/repositories/TeacherRepository.js`)**
  - Manages `Teacher` and `TeacherAssignmentSegment`.
  - *Key Methods*: `findById`, `findByEmployeeId`, `findAvailableTeachers`, `updateBonusScores`.
- **`CourseRepository` (`modules/course/repositories/CourseRepository.js`)**
  - Manages `Course`, `TrainingCourse`, `TeachingGuide`.
  - *Key Methods*: `findById`, `findActiveCourses`, `findCoursesByTeacher`.

### 3.2 Transactional Domains
- **`FinanceRepository` (`modules/finance/repositories/FinanceRepository.js`)**
  - Manages `LedgerEntry`, `CreditNote`, `FinanceDailySnapshot`, `PayrollLog`.
  - *Key Methods*: `recordLedgerEntry`, `calculateBalance`, `getDailySnapshot`.
- **`InvoiceRepository` (`modules/invoice/repositories/InvoiceRepository.js`)**
  - Manages `Invoice`.
  - *Key Methods*: `findById`, `findByStudent`, `markAsPaid`.
- **`TransactionRepository` (`modules/transaction/repositories/TransactionRepository.js`)**
  - Manages `Transaction`.
  - *Key Methods*: `recordTransaction`, `findByInvoiceId`.

### 3.3 Event & Operational Domains
- **`ExamRepository` (`modules/exam/repositories/ExamRepository.js`)**
  - Manages `ExamResult`, `ProctorEvent`, `LessonQuiz`, `Evaluation`.
  - *Key Methods*: `saveResult`, `findStudentHistory`, `logProctorEvent`.
- **`AttendanceRepository` (`modules/attendance/repositories/AttendanceRepository.js`)**
  - Manages `Schedule`, `ScheduleHistory`.
  - *Key Methods*: `logAttendance`, `findScheduleByCourse`.

### 3.4 Edge Domains
- **`NotificationRepository` (`modules/notification/repositories/NotificationRepository.js`)**
  - Manages `Notification`.
  - *Key Methods*: `createNotification`, `markAsRead`, `findByUserId`.
- **`ChatRepository` (`modules/chat/repositories/ChatRepository.js`)**
  - Manages `Message`, `ConversationVisibility`.
  - *Key Methods*: `saveMessage`, `getConversationHistory`.
- **`ReportRepository` (`modules/report/repositories/ReportRepository.js`)**
  - Manages `SystemLog`, `AuditLog`, `ReportDefinition`.
  - *Key Methods*: `logAction`, `fetchAuditTrail`.

## 4. Implementation Strategy (The Risk)
Migrating 150+ direct Mongoose query files to use these repositories is highly complex. Fluent APIs like `Student.find().populate('groupId').lean().exec()` must be carefully encapsulated inside the repository method `findWithGroups()`. Automating this globally via an AST script is unsafe and risks catastrophic data loss or application failure.
Implementation MUST be done manually and incrementally per domain.
