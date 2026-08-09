# Module Inventory

## 1. Overview
This document catalogs all modules structured within the new `modules/` root directory post-Sprint 4.1. Each module strictly implements a 9-folder placeholder hierarchy and an `index.js` public API entrypoint.

## 2. Module Directory
The system consists of **28 defined modules** (including empty placeholders for future expansion).

### 2.1 Foundation Modules (Batch 1)
- **`auth`**: Contains `routes/authRoutes.js`, `models/Employee.js`. 
  - *Placeholders*: `controllers`, `services`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`branch`**: Contains `routes/branchRoutes.js`, `controllers/branchController.js`, `models/Branch.js`.
  - *Placeholders*: `services`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`tenant`**: Contains `routes/tenantRoutes.js`, `services/tenantService.js`, `models/Tenant.js`.
  - *Placeholders*: `controllers`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`system`**: Contains `routes/settingsRoutes.js`, `controllers/settingsController.js`, `services/settingsCache.js`, `models/SystemSettings.js`.
  - *Placeholders*: `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.

### 2.2 Core Operational Domains (Batch 2)
- **`student`**: Contains `routes/studentRoutes.js`, `models/Student.js`, `models/Group.js`.
  - *Placeholders*: `controllers`, `services`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`teacher`**: Contains `routes/teacherRoutes.js`, `routes/staffRoutes.js`, `routes/employeeRoutes.js`, `models/Teacher.js`, `models/TeacherAssignmentSegment.js`, `services/teacherStarBonus.js`.
  - *Placeholders*: `controllers`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`course`**: Contains `routes/courseRoutes.js`, `routes/trainingRoutes.js`, `routes/teachingGuideRoutes.js`, `routes/assignmentRoutes.js`, `models/Course.js`, `models/TrainingCourse.js`, `models/TrainingLesson.js`, `models/TrainingProgress.js`, `models/TeachingGuide.js`, `models/Assignment.js`, `models/Submission.js`.
  - *Placeholders*: `controllers`, `services`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`enrollment`**: Contains `services/enrollmentService.js`.
  - *Placeholders*: `controllers`, `repositories`, `routes`, `models`, `validators`, `dto`, `events`, `tests`, `index.js`.
- **`attendance`**: Contains `routes/scheduleRoutes.js`, `models/Schedule.js`, `models/ScheduleHistory.js`.
  - *Placeholders*: `controllers`, `services`, `repositories`, `validators`, `dto`, `events`, `tests`, `index.js`.

### 2.3 Transactional & Event Domains (Batch 3)
- **`finance`**: Contains `routes/financeRoutes.js`, `routes/biRoutes.js`, `models/LedgerEntry.js`, `models/CreditNote.js`, `models/FinanceDailySnapshot.js`, `models/PayrollLog.js`, `services/ledgerService.js`, `services/revenueAggregate.js`, `services/biService.js`.
- **`invoice`**: Contains `routes/invoiceRoutes.js`, `models/Invoice.js`.
- **`transaction`**: Contains `routes/transactionRoutes.js`, `models/Transaction.js`.
- **`payment`**: Contains `routes/webhookRoutes.js`, `models/PaymentSession.js`, `models/SepayWebhookEvent.js`.
- **`exam`**: Contains 4 routes (`examResult`, `proctor`, `quiz`, `evaluation`), 4 models (`ExamResult`, `ProctorEvent`, `LessonQuiz`, `Evaluation`), 3 services (`examProgressService`, `examSubjectCatalog`, `proctorAuditService`).
- **`analytics`**: Contains `routes/analyticsRoutes.js`.
- **`report`**: Contains 3 routes (`monitoring`, `systemLog`, `backup`), 4 models (`ReportDefinition`, `SystemLog`, `AuditLog`, `BackupJob`), 5 services (`reportService`, `monitoringService`, `backupService`, `metricsCollector`, `auditLogService`).
- **`certificate`**: (Empty Placeholder).

### 2.4 Edge Domains (Batch 4)
- **`notification`**: `routes/notificationRoutes.js`, `models/Notification.js`, `services/NotificationService.js`, `services/notificationCenter.js`.
- **`chat`**: `routes/messageRoutes.js`, `models/Message.js`, `models/ConversationVisibility.js`, `services/chatAccessService.js`, `services/messaging/`.
- **`cms`**: `routes/builderRoutes.js`, `routes/workflowRoutes.js`, 3 models (`FormDefinition`, `FormSubmission`, `WorkflowInstance`), 2 services (`formService`, `workflowService`).
- **`blog`**: `routes/blogRoutes.js`, `models/BlogPost.js`.
- **`feed`**: `routes/feedRoutes.js`, `models/FeedPost.js`.
- **`ai`**: `routes/aiRoutes.js`, `services/aiService.js`, `services/ai/`.
- **`file`**: `routes/fileRoutes.js`, `models/FileAsset.js`, `services/fileService.js`.
- **`media`, `banner`, `announcement`, `upload`**: (Empty Placeholders for future feature-splitting).

## 3. Public API (index.js) Status
Currently, **100% of all `index.js` files are empty placeholders** (`// Entry point for <domain> module`).
The application currently bypasses these boundaries, as files import internal dependencies (e.g., `require('../../modules/student/models/Student')`) directly rather than requesting them through an exposed API (`require('../../modules/student')`). This is the defining technical debt addressed in Phase 4 of this architectural review.
