# Domain Discovery

## 1. Overview
The current monolithic structure of DASHBOARDTHANGTINHOC is layered (e.g., `routes/`, `controllers/`, `services/`, `models/`). Phase 1 of Sprint 4 identifies the mapping of these flat files into cohesive business domains to transition toward an Enterprise Domain Modularization structure.

## 2. Domain Mappings

### 2.1 Identity & Access (`auth`)
- **Routes**: `authRoutes.js`
- **Models**: `Employee.js`, `Role` (Implicit)
- **Middleware**: `authenticate.js`, `authorize.js`, `authMiddleware.js`
- **Context**: JWT generation, Password recovery.

### 2.2 Student Management (`student`)
- **Routes**: `studentRoutes.js`
- **Models**: `Student.js`, `Group.js`
- **Services**: Student profile management, progression tracking.

### 2.3 Teacher Management (`teacher`)
- **Routes**: `teacherRoutes.js`, `staffRoutes.js`, `employeeRoutes.js`
- **Models**: `Teacher.js`, `TeacherAssignmentSegment.js`
- **Services**: `teacherStarBonus.js`

### 2.4 Curriculum & Course (`course`)
- **Routes**: `courseRoutes.js`, `trainingRoutes.js`, `teachingGuideRoutes.js`, `assignmentRoutes.js`
- **Models**: `Course.js`, `TrainingCourse.js`, `TrainingLesson.js`, `TrainingProgress.js`, `TeachingGuide.js`, `Assignment.js`, `Submission.js`

### 2.5 Enrollment & Academic Operations (`enrollment`)
- **Services**: `enrollmentService.js` (Currently orchestrating Student to Course associations).

### 2.6 Scheduling & Attendance (`attendance`)
- **Routes**: `scheduleRoutes.js`
- **Models**: `Schedule.js`, `ScheduleHistory.js`

### 2.7 Examination & Proctoring (`exam`)
- **Routes**: `examResultRoutes.js`, `proctorRoutes.js`, `quizRoutes.js`, `evaluationRoutes.js`
- **Models**: `ExamResult.js`, `ProctorEvent.js`, `LessonQuiz.js`, `Evaluation.js`
- **Services**: `examProgressService.js`, `examSubjectCatalog.js`, `proctorAuditService.js`

### 2.8 Certificate Management (`certificate`)
- (Future/Implicit Module): Certificate generation and validation logic currently embedded within Student/Course services.

### 2.9 Financial Ledger & Invoicing (`finance`)
- **Routes**: `financeRoutes.js`, `invoiceRoutes.js`, `transactionRoutes.js`, `biRoutes.js`
- **Models**: `Invoice.js`, `Transaction.js`, `LedgerEntry.js`, `CreditNote.js`, `FinanceDailySnapshot.js`, `PayrollLog.js`
- **Services**: `ledgerService.js`, `revenueAggregate.js`, `biService.js`

### 2.10 Payment Gateway (`payment`)
- **Routes**: `webhookRoutes.js` (SePay Webhooks)
- **Models**: `PaymentSession.js`, `SepayWebhookEvent.js`

### 2.11 Notifications & Messaging (`notification`)
- **Routes**: `notificationRoutes.js`, `messageRoutes.js`
- **Models**: `Notification.js`, `Message.js`, `ConversationVisibility.js`
- **Services**: `NotificationService.js`, `notificationCenter.js`, `accountWelcome.js`, `messaging/`, `chatAccessService.js`

### 2.12 Content Management System (`cms`)
- **Routes**: `blogRoutes.js`, `feedRoutes.js`, `fileRoutes.js`, `builderRoutes.js`, `formRoutes.js` (implicit)
- **Models**: `BlogPost.js`, `FeedPost.js`, `FileAsset.js`, `FormDefinition.js`, `FormSubmission.js`
- **Services**: `fileService.js`, `formService.js`

### 2.13 Artificial Intelligence (`ai`)
- **Routes**: `aiRoutes.js`
- **Services**: `aiService.js`, `ai/` folder

### 2.14 Multi-Branch Management (`branch`)
- **Routes**: `branchRoutes.js`
- **Models**: `Branch.js`
- **Middleware**: `branchFilter.js`

### 2.15 Multi-Tenant Core (`tenant`)
- **Routes**: `tenantRoutes.js`
- **Models**: `Tenant.js`
- **Services**: `tenantService.js`

### 2.16 Reports & Auditing (`report`)
- **Routes**: `analyticsRoutes.js`, `monitoringRoutes.js`, `systemLogRoutes.js`, `backupRoutes.js`
- **Models**: `ReportDefinition.js`, `SystemLog.js`, `AuditLog.js`, `BackupJob.js`
- **Services**: `reportService.js`, `monitoringService.js`, `metricsCollector.js`, `auditLogService.js`, `backupService.js`

### 2.17 Shared Infrastructure (`shared`)
- **Routes**: `settingsRoutes.js`, `workflowRoutes.js`
- **Models**: `SystemSettings.js`, `WorkflowInstance.js`
- **Services**: `settingsCache.js`, `workflowService.js`, `queue/`
- **Common**: `shared/errors`, `shared/logger`, `shared/context`
