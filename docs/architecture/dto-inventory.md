# DTO Inventory — Phase 1 Analysis

This document maps all identified `req.body`, `req.query`, `req.params`, and `req.file` dependencies accessed within the Application Service Layer.

## AiApplicationService
## AnalyticsApplicationService
## AttendanceApplicationService
### get_teacher_teacherId
- **Params**: teacherId

### get_student_studentId
- **Params**: studentId

### put_scheduleId
- **Params**: scheduleId
- **Body**: hasUnreadStudentNote, studentNote

### delete_scheduleId
- **Params**: scheduleId

### patch_scheduleId_cancel
- **Params**: scheduleId

## BlogApplicationService
### get_posts
- **Query**: limit, page, q, target

### get_posts_slugOrId
- **Params**: slugOrId
- **Query**: manage

### get_manage_posts
- **Query**: limit, page, q, status

### get_manage_posts_id
- **Params**: id

### post_manage_posts
- **Body**: attachments, content, contentHtml, excerpt, slug, status, targetAudience, thumbnailUrl, title

### put_manage_posts_id
- **Params**: id
- **Body**: attachments, content, contentHtml, excerpt, slug, status, targetAudience, thumbnailUrl, title

### post_manage_posts_id_publish
- **Params**: id

### post_manage_posts_id_hide
- **Params**: id

### delete_manage_posts_id
- **Params**: id

## BranchApplicationService
## ChatApplicationService
### get_conversations_userId
- **Params**: userId

### get_search_userId
- **Params**: userId

### get_conversationId
- **Params**: conversationId

### post_upload
- **File**: Single File Upload

### post_root
- **Body**: conversationId

### get_groups_user_userId
- **Params**: userId

## CmsApplicationService
### get_forms
- **Query**: status

### get_forms_idOrSlug
- **Params**: idOrSlug

### put_forms_id
- **Params**: id

### delete_forms_id
- **Params**: id

### post_forms_idOrSlug_submit
- **Params**: idOrSlug

### post_forms_idOrSlug_submit_auth
- **Params**: idOrSlug

### get_forms_id_submissions
- **Params**: id
- **Query**: limit, page

### get_forms_id_submissions_export
- **Params**: id

### get_reports
- **Query**: page

### put_reports_id
- **Params**: id

### delete_reports_id
- **Params**: id

### get_reports_id_run
- **Params**: id
- **Query**: limit

### get_reports_id_export
- **Params**: id
- **Query**: limit

### get_root
- **Query**: definitionKey, limit, page, status, sync

### get_id
- **Params**: id

### post_id_advance
- **Params**: id

## AssignmentApplicationService
### post_upload
- **File**: Single File Upload

### get_course_courseId
- **Params**: courseId

### get_student_studentId_course_courseId
- **Params**: courseId, studentId

### post_root
- **Body**: courseId

### put_id
- **Params**: id

### delete_id
- **Params**: id

### post_id_submit
- **Params**: id

### put_submissions_submissionId_grade
- **Params**: submissionId

## CourseApplicationService
### get_id
- **Params**: id

### put_id
- **Params**: id

### patch_id_price
- **Params**: id

### delete_id
- **Params**: id

### post_id_restore
- **Params**: id

## TeachingGuideApplicationService
### get_root
- **Query**: category

## TrainingApplicationService
### get_courses_id_lessons
- **Params**: id

## EnrollmentApplicationService
### post_id_enrollments
- **Params**: id

### put_id_enrollments_enrollmentId_settings
- **Params**: enrollmentId, id

### put_id_enrollments_enrollmentId_pay
- **Params**: enrollmentId, id

### delete_id_enrollments_enrollmentId
- **Params**: enrollmentId, id
- **Body**: refundAmount

## EvaluationApplicationService
### get_teacher_teacherId
- **Params**: teacherId

### post_id_read
- **Params**: id

## ExamResultApplicationService
### get_root
- **Query**: limit, page, type

### put_id
- **Params**: id
- **Body**: essayNote

### delete_id
- **Params**: id

## ProctorApplicationService
### get_events_me
- **Query**: limit

### get_events_userId
- **Params**: userId
- **Query**: limit

## QuizApplicationService
### delete_id
- **Params**: id

### get_id
- **Params**: id

### post_id_submit
- **Params**: id

## FeedApplicationService
### get_root
- **Query**: limit, page

### post_root
- **Body**: images

### delete_id
- **Params**: id

### post_id_comments
- **Params**: id
- **Body**: images, parentId

### delete_id_comments_commentId
- **Params**: commentId, id

## FileApplicationService
### post_upload
- **File**: Single File Upload

### delete_id
- **Params**: id

## BiApplicationService
### get_overview
- **Query**: branchId, period

### get_export
- **Query**: branchId, period

## FinanceApplicationService
### get_summary
- **Query**: from, studentId, to

### get_ledger
- **Query**: from, limit, page, status, studentId, teacherId, to, type

### get_students_id
- **Params**: id

### post_ledger_id_void
- **Params**: id

### get_reconcile
- **Query**: from, to

### post_snapshots_rebuild
- **Query**: from, to

### post_students_id_sync_cache
- **Params**: id

## InvoiceApplicationService
### get_stats
- **Query**: branch_id

### get_id
- **Params**: id

### get_id_pdf
- **Params**: id

### post_id_pdf_queue
- **Params**: id

### post_id_email
- **Params**: id

### delete_id
- **Params**: id

## NotificationApplicationService
## PaymentApplicationService
### get_payment_status_studentId
- **Params**: studentId

## BackupApplicationService
### get_root
- **Query**: limit, page

### get_id_download
- **Params**: id

### delete_id
- **Params**: id

## MonitoringApplicationService
## SystemLogApplicationService
### get_root
- **Query**: limit, page

### delete_id
- **Params**: id

## AuthApplicationService
### get_zalo_callback3
- **Query**: state

## SupportApplicationService
## SystemApplicationService
### post_upload_popup_image4
- **File**: Single File Upload

### post_upload_invoice_signature5
- **File**: Single File Upload

### put_training_data11
- **Body**: trainingData

### put_student_training_data13
- **Body**: studentTrainingData

### delete_exam_subjects_id19
- **Params**: id

### post_upload_logo21
- **File**: Single File Upload

### post_upload_favicon22
- **File**: Single File Upload

### post_upload_invoice_logo23
- **File**: Single File Upload

## StudentApplicationService
### get_id
- **Params**: id

### get_id_full_detail
- **Params**: id

### post_root
- **Body**: branchCode, branchId, course, courseId, email, isFirstLogin, password, phone, remainingSessions, status, teacherId, totalSessions, zalo

### put_id
- **Params**: id

### put_id_exam_progress
- **Params**: id

### patch_id_price
- **Params**: id

### put_id_pay
- **Params**: id

### put_id_refund
- **Params**: id
- **Body**: amount

### put_id_unlock_exam
- **Params**: id

### put_id_lock_exam
- **Params**: id

### put_id_assign_teacher
- **Params**: id

### delete_id
- **Params**: id

### post_id_reset_today_attendance
- **Params**: id

### post_id_reset_history
- **Params**: id

### put_id_pay_teacher
- **Params**: id

## EmployeeApplicationService
### get_root
- **Query**: position, search, status

### post_root
- **Body**: gender

### put_id
- **Params**: id

### delete_id
- **Params**: id

### post_id_pay
- **Params**: id

### get_id_payroll
- **Params**: id

## StaffApplicationService
### put_id
- **Params**: id

### delete_id
- **Params**: id

## TeacherApplicationService
### get_id
- **Params**: id

### put_id
- **Params**: id
- **Body**: specialty, subjectIds

### put_id_score
- **Params**: id

### put_id_approve
- **Params**: id

### post_id_submit_practical
- **Params**: id

### put_id_reject
- **Params**: id

### delete_id
- **Params**: id

### get_id_finance
- **Params**: id

### get_id_finance_pending
- **Params**: id

### put_id_finance_pay_flexible
- **Params**: id
- **Body**: idempotencyKey

### put_id_finance_pay_all
- **Params**: id

## TenantApplicationService
## TransactionApplicationService
### get_stats
- **Query**: branch_id

### get_teacher_teacherId
- **Params**: teacherId

### put_id_confirm
- **Params**: id

### put_id_cancel
- **Params**: id

### delete_id
- **Params**: id

