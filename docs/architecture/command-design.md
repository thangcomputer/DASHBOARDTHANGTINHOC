# Command Catalog Design

## Module: `modules/attendance/commands/`
### Put_scheduleIdCommand
- **Input DTO**: `Put_scheduleIdCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Attendance Domain`
- **Repository Dependencies**: `AttendanceRepository`
- **Expected Domain Events**: `Put_scheduleIdCompleted`

### Delete_scheduleIdCommand
- **Input DTO**: `Delete_scheduleIdCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Attendance Domain`
- **Repository Dependencies**: `AttendanceRepository`
- **Expected Domain Events**: `_scheduleIdDeleted`

### Patch_scheduleId_cancelCommand
- **Input DTO**: `Patch_scheduleId_cancelCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Attendance Domain`
- **Repository Dependencies**: `AttendanceRepository`
- **Expected Domain Events**: `Patch_scheduleId_cancelCompleted`

## Module: `modules/blog/commands/`
### Post_manage_postsCommand
- **Input DTO**: `Post_manage_postsCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Blog Domain`
- **Repository Dependencies**: `BlogRepository`
- **Expected Domain Events**: `Post_manage_postsCompleted`

### Put_manage_posts_idCommand
- **Input DTO**: `Put_manage_posts_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Blog Domain`
- **Repository Dependencies**: `BlogRepository`
- **Expected Domain Events**: `Put_manage_posts_idCompleted`

### Post_manage_posts_id_publishCommand
- **Input DTO**: `Post_manage_posts_id_publishCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Blog Domain`
- **Repository Dependencies**: `BlogRepository`
- **Expected Domain Events**: `Post_manage_posts_id_publishCompleted`

### Post_manage_posts_id_hideCommand
- **Input DTO**: `Post_manage_posts_id_hideCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Blog Domain`
- **Repository Dependencies**: `BlogRepository`
- **Expected Domain Events**: `Post_manage_posts_id_hideCompleted`

### Delete_manage_posts_idCommand
- **Input DTO**: `Delete_manage_posts_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Blog Domain`
- **Repository Dependencies**: `BlogRepository`
- **Expected Domain Events**: `_manage_posts_idDeleted`

## Module: `modules/chat/commands/`
### Post_uploadCommand
- **Input DTO**: `Post_uploadCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Chat Domain`
- **Repository Dependencies**: `ChatRepository`
- **Expected Domain Events**: `Post_uploadCompleted`

### Post_rootCommand
- **Input DTO**: `Post_rootCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Chat Domain`
- **Repository Dependencies**: `ChatRepository`
- **Expected Domain Events**: `Post_rootCompleted`

## Module: `modules/cms/commands/`
### Put_forms_idCommand
- **Input DTO**: `Put_forms_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `Put_forms_idCompleted`

### Delete_forms_idCommand
- **Input DTO**: `Delete_forms_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `_forms_idDeleted`

### Post_forms_idOrSlug_submitCommand
- **Input DTO**: `Post_forms_idOrSlug_submitCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `Post_forms_idOrSlug_submitCompleted`

### Post_forms_idOrSlug_submit_authCommand
- **Input DTO**: `Post_forms_idOrSlug_submit_authCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `Post_forms_idOrSlug_submit_authCompleted`

### Put_reports_idCommand
- **Input DTO**: `Put_reports_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `Put_reports_idCompleted`

### Delete_reports_idCommand
- **Input DTO**: `Delete_reports_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `_reports_idDeleted`

### Post_id_advanceCommand
- **Input DTO**: `Post_id_advanceCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Cms Domain`
- **Repository Dependencies**: `CmsRepository`
- **Expected Domain Events**: `Post_id_advanceCompleted`

## Module: `modules/assignment/commands/`
### Post_uploadCommand
- **Input DTO**: `Post_uploadCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `Post_uploadCompleted`

### Post_rootCommand
- **Input DTO**: `Post_rootCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `Post_rootCompleted`

### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_submitCommand
- **Input DTO**: `Post_id_submitCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `Post_id_submitCompleted`

### Put_submissions_submissionId_gradeCommand
- **Input DTO**: `Put_submissions_submissionId_gradeCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Assignment Domain`
- **Repository Dependencies**: `AssignmentRepository`
- **Expected Domain Events**: `Put_submissions_submissionId_gradeCompleted`

## Module: `modules/course/commands/`
### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Course Domain`
- **Repository Dependencies**: `CourseRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Patch_id_priceCommand
- **Input DTO**: `Patch_id_priceCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Course Domain`
- **Repository Dependencies**: `CourseRepository`
- **Expected Domain Events**: `Patch_id_priceCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Course Domain`
- **Repository Dependencies**: `CourseRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_restoreCommand
- **Input DTO**: `Post_id_restoreCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Course Domain`
- **Repository Dependencies**: `CourseRepository`
- **Expected Domain Events**: `Post_id_restoreCompleted`

## Module: `modules/enrollment/commands/`
### Post_id_enrollmentsCommand
- **Input DTO**: `Post_id_enrollmentsCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Enrollment Domain`
- **Repository Dependencies**: `EnrollmentRepository`
- **Expected Domain Events**: `Post_id_enrollmentsCompleted`

### Put_id_enrollments_enrollmentId_settingsCommand
- **Input DTO**: `Put_id_enrollments_enrollmentId_settingsCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Enrollment Domain`
- **Repository Dependencies**: `EnrollmentRepository`
- **Expected Domain Events**: `Put_id_enrollments_enrollmentId_settingsCompleted`

### Put_id_enrollments_enrollmentId_payCommand
- **Input DTO**: `Put_id_enrollments_enrollmentId_payCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Enrollment Domain`
- **Repository Dependencies**: `EnrollmentRepository`
- **Expected Domain Events**: `Put_id_enrollments_enrollmentId_payCompleted`

### Delete_id_enrollments_enrollmentIdCommand
- **Input DTO**: `Delete_id_enrollments_enrollmentIdCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Enrollment Domain`
- **Repository Dependencies**: `EnrollmentRepository`
- **Expected Domain Events**: `_id_enrollments_enrollmentIdDeleted`

## Module: `modules/evaluation/commands/`
### Post_id_readCommand
- **Input DTO**: `Post_id_readCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Evaluation Domain`
- **Repository Dependencies**: `EvaluationRepository`
- **Expected Domain Events**: `Post_id_readCompleted`

## Module: `modules/examresult/commands/`
### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Examresult Domain`
- **Repository Dependencies**: `ExamresultRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Examresult Domain`
- **Repository Dependencies**: `ExamresultRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/quiz/commands/`
### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Quiz Domain`
- **Repository Dependencies**: `QuizRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_submitCommand
- **Input DTO**: `Post_id_submitCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Quiz Domain`
- **Repository Dependencies**: `QuizRepository`
- **Expected Domain Events**: `Post_id_submitCompleted`

## Module: `modules/feed/commands/`
### Post_rootCommand
- **Input DTO**: `Post_rootCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Feed Domain`
- **Repository Dependencies**: `FeedRepository`
- **Expected Domain Events**: `Post_rootCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Feed Domain`
- **Repository Dependencies**: `FeedRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_commentsCommand
- **Input DTO**: `Post_id_commentsCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Feed Domain`
- **Repository Dependencies**: `FeedRepository`
- **Expected Domain Events**: `Post_id_commentsCompleted`

### Delete_id_comments_commentIdCommand
- **Input DTO**: `Delete_id_comments_commentIdCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Feed Domain`
- **Repository Dependencies**: `FeedRepository`
- **Expected Domain Events**: `_id_comments_commentIdDeleted`

## Module: `modules/file/commands/`
### Post_uploadCommand
- **Input DTO**: `Post_uploadCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `File Domain`
- **Repository Dependencies**: `FileRepository`
- **Expected Domain Events**: `Post_uploadCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `File Domain`
- **Repository Dependencies**: `FileRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/finance/commands/`
### Post_ledger_id_voidCommand
- **Input DTO**: `Post_ledger_id_voidCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Finance Domain`
- **Repository Dependencies**: `FinanceRepository`
- **Expected Domain Events**: `Post_ledger_id_voidCompleted`

### Post_snapshots_rebuildCommand
- **Input DTO**: `Post_snapshots_rebuildCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Finance Domain`
- **Repository Dependencies**: `FinanceRepository`
- **Expected Domain Events**: `Post_snapshots_rebuildCompleted`

### Post_students_id_sync_cacheCommand
- **Input DTO**: `Post_students_id_sync_cacheCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Finance Domain`
- **Repository Dependencies**: `FinanceRepository`
- **Expected Domain Events**: `Post_students_id_sync_cacheCompleted`

## Module: `modules/invoice/commands/`
### Post_id_pdf_queueCommand
- **Input DTO**: `Post_id_pdf_queueCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Invoice Domain`
- **Repository Dependencies**: `InvoiceRepository`
- **Expected Domain Events**: `Post_id_pdf_queueCompleted`

### Post_id_emailCommand
- **Input DTO**: `Post_id_emailCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Invoice Domain`
- **Repository Dependencies**: `InvoiceRepository`
- **Expected Domain Events**: `Post_id_emailCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Invoice Domain`
- **Repository Dependencies**: `InvoiceRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/backup/commands/`
### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Backup Domain`
- **Repository Dependencies**: `BackupRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/systemlog/commands/`
### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Systemlog Domain`
- **Repository Dependencies**: `SystemlogRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/system/commands/`
### Post_upload_popup_image4Command
- **Input DTO**: `Post_upload_popup_image4CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Post_upload_popup_image4Completed`

### Post_upload_invoice_signature5Command
- **Input DTO**: `Post_upload_invoice_signature5CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Post_upload_invoice_signature5Completed`

### Put_training_data11Command
- **Input DTO**: `Put_training_data11CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Put_training_data11Completed`

### Put_student_training_data13Command
- **Input DTO**: `Put_student_training_data13CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Put_student_training_data13Completed`

### Delete_exam_subjects_id19Command
- **Input DTO**: `Delete_exam_subjects_id19CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `_exam_subjects_id19Deleted`

### Post_upload_logo21Command
- **Input DTO**: `Post_upload_logo21CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Post_upload_logo21Completed`

### Post_upload_favicon22Command
- **Input DTO**: `Post_upload_favicon22CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Post_upload_favicon22Completed`

### Post_upload_invoice_logo23Command
- **Input DTO**: `Post_upload_invoice_logo23CommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `System Domain`
- **Repository Dependencies**: `SystemRepository`
- **Expected Domain Events**: `Post_upload_invoice_logo23Completed`

## Module: `modules/student/commands/`
### Post_rootCommand
- **Input DTO**: `Post_rootCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Post_rootCompleted`

### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Put_id_exam_progressCommand
- **Input DTO**: `Put_id_exam_progressCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_exam_progressCompleted`

### Patch_id_priceCommand
- **Input DTO**: `Patch_id_priceCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Patch_id_priceCompleted`

### Put_id_payCommand
- **Input DTO**: `Put_id_payCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_payCompleted`

### Put_id_refundCommand
- **Input DTO**: `Put_id_refundCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_refundCompleted`

### Put_id_unlock_examCommand
- **Input DTO**: `Put_id_unlock_examCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_unlock_examCompleted`

### Put_id_lock_examCommand
- **Input DTO**: `Put_id_lock_examCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_lock_examCompleted`

### Put_id_assign_teacherCommand
- **Input DTO**: `Put_id_assign_teacherCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_assign_teacherCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_reset_today_attendanceCommand
- **Input DTO**: `Post_id_reset_today_attendanceCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Post_id_reset_today_attendanceCompleted`

### Post_id_reset_historyCommand
- **Input DTO**: `Post_id_reset_historyCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Post_id_reset_historyCompleted`

### Put_id_pay_teacherCommand
- **Input DTO**: `Put_id_pay_teacherCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Student Domain`
- **Repository Dependencies**: `StudentRepository`
- **Expected Domain Events**: `Put_id_pay_teacherCompleted`

## Module: `modules/employee/commands/`
### Post_rootCommand
- **Input DTO**: `Post_rootCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Employee Domain`
- **Repository Dependencies**: `EmployeeRepository`
- **Expected Domain Events**: `Post_rootCompleted`

### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Employee Domain`
- **Repository Dependencies**: `EmployeeRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Employee Domain`
- **Repository Dependencies**: `EmployeeRepository`
- **Expected Domain Events**: `_idDeleted`

### Post_id_payCommand
- **Input DTO**: `Post_id_payCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Employee Domain`
- **Repository Dependencies**: `EmployeeRepository`
- **Expected Domain Events**: `Post_id_payCompleted`

## Module: `modules/staff/commands/`
### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Staff Domain`
- **Repository Dependencies**: `StaffRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Staff Domain`
- **Repository Dependencies**: `StaffRepository`
- **Expected Domain Events**: `_idDeleted`

## Module: `modules/teacher/commands/`
### Put_idCommand
- **Input DTO**: `Put_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_idCompleted`

### Put_id_scoreCommand
- **Input DTO**: `Put_id_scoreCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_id_scoreCompleted`

### Put_id_approveCommand
- **Input DTO**: `Put_id_approveCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_id_approveCompleted`

### Post_id_submit_practicalCommand
- **Input DTO**: `Post_id_submit_practicalCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Post_id_submit_practicalCompleted`

### Put_id_rejectCommand
- **Input DTO**: `Put_id_rejectCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_id_rejectCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `_idDeleted`

### Put_id_finance_pay_flexibleCommand
- **Input DTO**: `Put_id_finance_pay_flexibleCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_id_finance_pay_flexibleCompleted`

### Put_id_finance_pay_allCommand
- **Input DTO**: `Put_id_finance_pay_allCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Teacher Domain`
- **Repository Dependencies**: `TeacherRepository`
- **Expected Domain Events**: `Put_id_finance_pay_allCompleted`

## Module: `modules/transaction/commands/`
### Put_id_confirmCommand
- **Input DTO**: `Put_id_confirmCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Transaction Domain`
- **Repository Dependencies**: `TransactionRepository`
- **Expected Domain Events**: `Put_id_confirmCompleted`

### Put_id_cancelCommand
- **Input DTO**: `Put_id_cancelCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Transaction Domain`
- **Repository Dependencies**: `TransactionRepository`
- **Expected Domain Events**: `Put_id_cancelCompleted`

### Delete_idCommand
- **Input DTO**: `Delete_idCommandDTO`
- **Output DTO**: `void` or `AckDTO`
- **Business Owner**: `Transaction Domain`
- **Repository Dependencies**: `TransactionRepository`
- **Expected Domain Events**: `_idDeleted`

