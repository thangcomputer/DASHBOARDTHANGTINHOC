# DTO Design Strategy — Phase 2

This document outlines the conceptual DTO hierarchy for each Application Service. **No implementation has been made; this is strictly architectural design.**

## Ai DTOs

### Response DTOs
- **`AiResponse`**: Standard representation of a single Ai entity.
- **`AiSummaryResponse`**: Lightweight representation for lists.

---

## Analytics DTOs

### Response DTOs
- **`AnalyticsResponse`**: Standard representation of a single Analytics entity.
- **`AnalyticsSummaryResponse`**: Lightweight representation for lists.

---

## Attendance DTOs

### Query DTOs
- **`Get_teacher_teacherIdQuery`**: teacherId
- **`Get_student_studentIdQuery`**: studentId

### Command DTOs
- **`Put_scheduleIdCommand`**: hasUnreadStudentNote, studentNote, scheduleId
- **`Delete_scheduleIdCommand`**: scheduleId
- **`Patch_scheduleId_cancelCommand`**: scheduleId

### Response DTOs
- **`AttendanceResponse`**: Standard representation of a single Attendance entity.
- **`AttendanceSummaryResponse`**: Lightweight representation for lists.

---

## Blog DTOs

### Query DTOs
- **`Get_postsQuery`**: limit, page, q, target
- **`Get_posts_slugOrIdQuery`**: manage, slugOrId
- **`Get_manage_postsQuery`**: limit, page, q, status
- **`Get_manage_posts_idQuery`**: id

### Command DTOs
- **`Post_manage_postsCommand`**: attachments, content, contentHtml, excerpt, slug, status, targetAudience, thumbnailUrl, title
- **`Put_manage_posts_idCommand`**: attachments, content, contentHtml, excerpt, slug, status, targetAudience, thumbnailUrl, title, id
- **`Post_manage_posts_id_publishCommand`**: id
- **`Post_manage_posts_id_hideCommand`**: id
- **`Delete_manage_posts_idCommand`**: id

### Response DTOs
- **`BlogResponse`**: Standard representation of a single Blog entity.
- **`BlogSummaryResponse`**: Lightweight representation for lists.

---

## Branch DTOs

### Response DTOs
- **`BranchResponse`**: Standard representation of a single Branch entity.
- **`BranchSummaryResponse`**: Lightweight representation for lists.

---

## Chat DTOs

### Query DTOs
- **`Get_conversations_userIdQuery`**: userId
- **`Get_search_userIdQuery`**: userId
- **`Get_conversationIdQuery`**: conversationId
- **`Get_groups_user_userIdQuery`**: userId

### Command DTOs
- **`Post_uploadCommand`**: (No payload)
- **`Post_rootCommand`**: conversationId

### Response DTOs
- **`ChatResponse`**: Standard representation of a single Chat entity.
- **`ChatSummaryResponse`**: Lightweight representation for lists.

---

## Cms DTOs

### Query DTOs
- **`Get_formsQuery`**: status
- **`Get_forms_idOrSlugQuery`**: idOrSlug
- **`Get_forms_id_submissionsQuery`**: limit, page, id
- **`Get_forms_id_submissions_exportQuery`**: id
- **`Get_reportsQuery`**: page
- **`Get_reports_id_runQuery`**: limit, id
- **`Get_reports_id_exportQuery`**: limit, id
- **`Get_rootQuery`**: definitionKey, limit, page, status, sync
- **`Get_idQuery`**: id

### Command DTOs
- **`Put_forms_idCommand`**: id
- **`Delete_forms_idCommand`**: id
- **`Post_forms_idOrSlug_submitCommand`**: idOrSlug
- **`Post_forms_idOrSlug_submit_authCommand`**: idOrSlug
- **`Put_reports_idCommand`**: id
- **`Delete_reports_idCommand`**: id
- **`Post_id_advanceCommand`**: id

### Response DTOs
- **`CmsResponse`**: Standard representation of a single Cms entity.
- **`CmsSummaryResponse`**: Lightweight representation for lists.

---

## Assignment DTOs

### Query DTOs
- **`Get_course_courseIdQuery`**: courseId
- **`Get_student_studentId_course_courseIdQuery`**: courseId, studentId

### Command DTOs
- **`Post_uploadCommand`**: (No payload)
- **`Post_rootCommand`**: courseId
- **`Put_idCommand`**: id
- **`Delete_idCommand`**: id
- **`Post_id_submitCommand`**: id
- **`Put_submissions_submissionId_gradeCommand`**: submissionId

### Response DTOs
- **`AssignmentResponse`**: Standard representation of a single Assignment entity.
- **`AssignmentSummaryResponse`**: Lightweight representation for lists.

---

## Course DTOs

### Query DTOs
- **`Get_idQuery`**: id

### Command DTOs
- **`Put_idCommand`**: id
- **`Patch_id_priceCommand`**: id
- **`Delete_idCommand`**: id
- **`Post_id_restoreCommand`**: id

### Response DTOs
- **`CourseResponse`**: Standard representation of a single Course entity.
- **`CourseSummaryResponse`**: Lightweight representation for lists.

---

## TeachingGuide DTOs

### Query DTOs
- **`Get_rootQuery`**: category

### Response DTOs
- **`TeachingGuideResponse`**: Standard representation of a single TeachingGuide entity.
- **`TeachingGuideSummaryResponse`**: Lightweight representation for lists.

---

## Training DTOs

### Query DTOs
- **`Get_courses_id_lessonsQuery`**: id

### Response DTOs
- **`TrainingResponse`**: Standard representation of a single Training entity.
- **`TrainingSummaryResponse`**: Lightweight representation for lists.

---

## Enrollment DTOs

### Command DTOs
- **`Post_id_enrollmentsCommand`**: id
- **`Put_id_enrollments_enrollmentId_settingsCommand`**: enrollmentId, id
- **`Put_id_enrollments_enrollmentId_payCommand`**: enrollmentId, id
- **`Delete_id_enrollments_enrollmentIdCommand`**: refundAmount, enrollmentId, id

### Response DTOs
- **`EnrollmentResponse`**: Standard representation of a single Enrollment entity.
- **`EnrollmentSummaryResponse`**: Lightweight representation for lists.

---

## Evaluation DTOs

### Query DTOs
- **`Get_teacher_teacherIdQuery`**: teacherId

### Command DTOs
- **`Post_id_readCommand`**: id

### Response DTOs
- **`EvaluationResponse`**: Standard representation of a single Evaluation entity.
- **`EvaluationSummaryResponse`**: Lightweight representation for lists.

---

## ExamResult DTOs

### Query DTOs
- **`Get_rootQuery`**: limit, page, type

### Command DTOs
- **`Put_idCommand`**: essayNote, id
- **`Delete_idCommand`**: id

### Response DTOs
- **`ExamResultResponse`**: Standard representation of a single ExamResult entity.
- **`ExamResultSummaryResponse`**: Lightweight representation for lists.

---

## Proctor DTOs

### Query DTOs
- **`Get_events_meQuery`**: limit
- **`Get_events_userIdQuery`**: limit, userId

### Response DTOs
- **`ProctorResponse`**: Standard representation of a single Proctor entity.
- **`ProctorSummaryResponse`**: Lightweight representation for lists.

---

## Quiz DTOs

### Query DTOs
- **`Get_idQuery`**: id

### Command DTOs
- **`Delete_idCommand`**: id
- **`Post_id_submitCommand`**: id

### Response DTOs
- **`QuizResponse`**: Standard representation of a single Quiz entity.
- **`QuizSummaryResponse`**: Lightweight representation for lists.

---

## Feed DTOs

### Query DTOs
- **`Get_rootQuery`**: limit, page

### Command DTOs
- **`Post_rootCommand`**: images
- **`Delete_idCommand`**: id
- **`Post_id_commentsCommand`**: images, parentId, id
- **`Delete_id_comments_commentIdCommand`**: commentId, id

### Response DTOs
- **`FeedResponse`**: Standard representation of a single Feed entity.
- **`FeedSummaryResponse`**: Lightweight representation for lists.

---

## File DTOs

### Command DTOs
- **`Post_uploadCommand`**: (No payload)
- **`Delete_idCommand`**: id

### Response DTOs
- **`FileResponse`**: Standard representation of a single File entity.
- **`FileSummaryResponse`**: Lightweight representation for lists.

---

## Bi DTOs

### Query DTOs
- **`Get_overviewQuery`**: branchId, period
- **`Get_exportQuery`**: branchId, period

### Response DTOs
- **`BiResponse`**: Standard representation of a single Bi entity.
- **`BiSummaryResponse`**: Lightweight representation for lists.

---

## Finance DTOs

### Query DTOs
- **`Get_summaryQuery`**: from, studentId, to
- **`Get_ledgerQuery`**: from, limit, page, status, studentId, teacherId, to, type
- **`Get_students_idQuery`**: id
- **`Get_reconcileQuery`**: from, to

### Command DTOs
- **`Post_ledger_id_voidCommand`**: id
- **`Post_snapshots_rebuildCommand`**: (No payload)
- **`Post_students_id_sync_cacheCommand`**: id

### Response DTOs
- **`FinanceResponse`**: Standard representation of a single Finance entity.
- **`FinanceSummaryResponse`**: Lightweight representation for lists.

---

## Invoice DTOs

### Query DTOs
- **`Get_statsQuery`**: branch_id
- **`Get_idQuery`**: id
- **`Get_id_pdfQuery`**: id

### Command DTOs
- **`Post_id_pdf_queueCommand`**: id
- **`Post_id_emailCommand`**: id
- **`Delete_idCommand`**: id

### Response DTOs
- **`InvoiceResponse`**: Standard representation of a single Invoice entity.
- **`InvoiceSummaryResponse`**: Lightweight representation for lists.

---

## Notification DTOs

### Response DTOs
- **`NotificationResponse`**: Standard representation of a single Notification entity.
- **`NotificationSummaryResponse`**: Lightweight representation for lists.

---

## Payment DTOs

### Query DTOs
- **`Get_payment_status_studentIdQuery`**: studentId

### Response DTOs
- **`PaymentResponse`**: Standard representation of a single Payment entity.
- **`PaymentSummaryResponse`**: Lightweight representation for lists.

---

## Backup DTOs

### Query DTOs
- **`Get_rootQuery`**: limit, page
- **`Get_id_downloadQuery`**: id

### Command DTOs
- **`Delete_idCommand`**: id

### Response DTOs
- **`BackupResponse`**: Standard representation of a single Backup entity.
- **`BackupSummaryResponse`**: Lightweight representation for lists.

---

## Monitoring DTOs

### Response DTOs
- **`MonitoringResponse`**: Standard representation of a single Monitoring entity.
- **`MonitoringSummaryResponse`**: Lightweight representation for lists.

---

## SystemLog DTOs

### Query DTOs
- **`Get_rootQuery`**: limit, page

### Command DTOs
- **`Delete_idCommand`**: id

### Response DTOs
- **`SystemLogResponse`**: Standard representation of a single SystemLog entity.
- **`SystemLogSummaryResponse`**: Lightweight representation for lists.

---

## Auth DTOs

### Query DTOs
- **`Get_zalo_callback3Query`**: state

### Response DTOs
- **`AuthResponse`**: Standard representation of a single Auth entity.
- **`AuthSummaryResponse`**: Lightweight representation for lists.

---

## Support DTOs

### Response DTOs
- **`SupportResponse`**: Standard representation of a single Support entity.
- **`SupportSummaryResponse`**: Lightweight representation for lists.

---

## System DTOs

### Command DTOs
- **`Post_upload_popup_image4Command`**: (No payload)
- **`Post_upload_invoice_signature5Command`**: (No payload)
- **`Put_training_data11Command`**: trainingData
- **`Put_student_training_data13Command`**: studentTrainingData
- **`Delete_exam_subjects_id19Command`**: id
- **`Post_upload_logo21Command`**: (No payload)
- **`Post_upload_favicon22Command`**: (No payload)
- **`Post_upload_invoice_logo23Command`**: (No payload)

### Response DTOs
- **`SystemResponse`**: Standard representation of a single System entity.
- **`SystemSummaryResponse`**: Lightweight representation for lists.

---

## Student DTOs

### Query DTOs
- **`Get_idQuery`**: id
- **`Get_id_full_detailQuery`**: id

### Command DTOs
- **`Post_rootCommand`**: branchCode, branchId, course, courseId, email, isFirstLogin, password, phone, remainingSessions, status, teacherId, totalSessions, zalo
- **`Put_idCommand`**: id
- **`Put_id_exam_progressCommand`**: id
- **`Patch_id_priceCommand`**: id
- **`Put_id_payCommand`**: id
- **`Put_id_refundCommand`**: amount, id
- **`Put_id_unlock_examCommand`**: id
- **`Put_id_lock_examCommand`**: id
- **`Put_id_assign_teacherCommand`**: id
- **`Delete_idCommand`**: id
- **`Post_id_reset_today_attendanceCommand`**: id
- **`Post_id_reset_historyCommand`**: id
- **`Put_id_pay_teacherCommand`**: id

### Response DTOs
- **`StudentResponse`**: Standard representation of a single Student entity.
- **`StudentSummaryResponse`**: Lightweight representation for lists.

---

## Employee DTOs

### Query DTOs
- **`Get_rootQuery`**: position, search, status
- **`Get_id_payrollQuery`**: id

### Command DTOs
- **`Post_rootCommand`**: gender
- **`Put_idCommand`**: id
- **`Delete_idCommand`**: id
- **`Post_id_payCommand`**: id

### Response DTOs
- **`EmployeeResponse`**: Standard representation of a single Employee entity.
- **`EmployeeSummaryResponse`**: Lightweight representation for lists.

---

## Staff DTOs

### Command DTOs
- **`Put_idCommand`**: id
- **`Delete_idCommand`**: id

### Response DTOs
- **`StaffResponse`**: Standard representation of a single Staff entity.
- **`StaffSummaryResponse`**: Lightweight representation for lists.

---

## Teacher DTOs

### Query DTOs
- **`Get_idQuery`**: id
- **`Get_id_financeQuery`**: id
- **`Get_id_finance_pendingQuery`**: id

### Command DTOs
- **`Put_idCommand`**: specialty, subjectIds, id
- **`Put_id_scoreCommand`**: id
- **`Put_id_approveCommand`**: id
- **`Post_id_submit_practicalCommand`**: id
- **`Put_id_rejectCommand`**: id
- **`Delete_idCommand`**: id
- **`Put_id_finance_pay_flexibleCommand`**: idempotencyKey, id
- **`Put_id_finance_pay_allCommand`**: id

### Response DTOs
- **`TeacherResponse`**: Standard representation of a single Teacher entity.
- **`TeacherSummaryResponse`**: Lightweight representation for lists.

---

## Tenant DTOs

### Response DTOs
- **`TenantResponse`**: Standard representation of a single Tenant entity.
- **`TenantSummaryResponse`**: Lightweight representation for lists.

---

## Transaction DTOs

### Query DTOs
- **`Get_statsQuery`**: branch_id
- **`Get_teacher_teacherIdQuery`**: teacherId

### Command DTOs
- **`Put_id_confirmCommand`**: id
- **`Put_id_cancelCommand`**: id
- **`Delete_idCommand`**: id

### Response DTOs
- **`TransactionResponse`**: Standard representation of a single Transaction entity.
- **`TransactionSummaryResponse`**: Lightweight representation for lists.

---

