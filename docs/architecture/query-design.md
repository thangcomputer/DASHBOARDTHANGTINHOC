# Query Catalog Design

## Module: `modules/attendance/queries/`
### Get_teacher_teacherIdQuery
- **Input DTO**: `Get_teacher_teacherIdQueryDTO`
- **Output DTO**: `AttendanceResponseDTO` or List
- **Repository Dependencies**: `AttendanceReadModelRepository`

### Get_student_studentIdQuery
- **Input DTO**: `Get_student_studentIdQueryDTO`
- **Output DTO**: `AttendanceResponseDTO` or List
- **Repository Dependencies**: `AttendanceReadModelRepository`

## Module: `modules/blog/queries/`
### Get_postsQuery
- **Input DTO**: `Get_postsQueryDTO`
- **Output DTO**: `BlogResponseDTO` or List
- **Repository Dependencies**: `BlogReadModelRepository`

### Get_posts_slugOrIdQuery
- **Input DTO**: `Get_posts_slugOrIdQueryDTO`
- **Output DTO**: `BlogResponseDTO` or List
- **Repository Dependencies**: `BlogReadModelRepository`

### Get_manage_postsQuery
- **Input DTO**: `Get_manage_postsQueryDTO`
- **Output DTO**: `BlogResponseDTO` or List
- **Repository Dependencies**: `BlogReadModelRepository`

### Get_manage_posts_idQuery
- **Input DTO**: `Get_manage_posts_idQueryDTO`
- **Output DTO**: `BlogResponseDTO` or List
- **Repository Dependencies**: `BlogReadModelRepository`

## Module: `modules/chat/queries/`
### Get_conversations_userIdQuery
- **Input DTO**: `Get_conversations_userIdQueryDTO`
- **Output DTO**: `ChatResponseDTO` or List
- **Repository Dependencies**: `ChatReadModelRepository`

### Get_search_userIdQuery
- **Input DTO**: `Get_search_userIdQueryDTO`
- **Output DTO**: `ChatResponseDTO` or List
- **Repository Dependencies**: `ChatReadModelRepository`

### Get_conversationIdQuery
- **Input DTO**: `Get_conversationIdQueryDTO`
- **Output DTO**: `ChatResponseDTO` or List
- **Repository Dependencies**: `ChatReadModelRepository`

### Get_groups_user_userIdQuery
- **Input DTO**: `Get_groups_user_userIdQueryDTO`
- **Output DTO**: `ChatResponseDTO` or List
- **Repository Dependencies**: `ChatReadModelRepository`

## Module: `modules/cms/queries/`
### Get_formsQuery
- **Input DTO**: `Get_formsQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_forms_idOrSlugQuery
- **Input DTO**: `Get_forms_idOrSlugQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_forms_id_submissionsQuery
- **Input DTO**: `Get_forms_id_submissionsQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_forms_id_submissions_exportQuery
- **Input DTO**: `Get_forms_id_submissions_exportQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_reportsQuery
- **Input DTO**: `Get_reportsQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_reports_id_runQuery
- **Input DTO**: `Get_reports_id_runQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_reports_id_exportQuery
- **Input DTO**: `Get_reports_id_exportQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `CmsResponseDTO` or List
- **Repository Dependencies**: `CmsReadModelRepository`

## Module: `modules/assignment/queries/`
### Get_course_courseIdQuery
- **Input DTO**: `Get_course_courseIdQueryDTO`
- **Output DTO**: `AssignmentResponseDTO` or List
- **Repository Dependencies**: `AssignmentReadModelRepository`

### Get_student_studentId_course_courseIdQuery
- **Input DTO**: `Get_student_studentId_course_courseIdQueryDTO`
- **Output DTO**: `AssignmentResponseDTO` or List
- **Repository Dependencies**: `AssignmentReadModelRepository`

## Module: `modules/course/queries/`
### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `CourseResponseDTO` or List
- **Repository Dependencies**: `CourseReadModelRepository`

## Module: `modules/teachingguide/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `TeachingguideResponseDTO` or List
- **Repository Dependencies**: `TeachingguideReadModelRepository`

## Module: `modules/training/queries/`
### Get_courses_id_lessonsQuery
- **Input DTO**: `Get_courses_id_lessonsQueryDTO`
- **Output DTO**: `TrainingResponseDTO` or List
- **Repository Dependencies**: `TrainingReadModelRepository`

## Module: `modules/evaluation/queries/`
### Get_teacher_teacherIdQuery
- **Input DTO**: `Get_teacher_teacherIdQueryDTO`
- **Output DTO**: `EvaluationResponseDTO` or List
- **Repository Dependencies**: `EvaluationReadModelRepository`

## Module: `modules/examresult/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `ExamresultResponseDTO` or List
- **Repository Dependencies**: `ExamresultReadModelRepository`

## Module: `modules/proctor/queries/`
### Get_events_meQuery
- **Input DTO**: `Get_events_meQueryDTO`
- **Output DTO**: `ProctorResponseDTO` or List
- **Repository Dependencies**: `ProctorReadModelRepository`

### Get_events_userIdQuery
- **Input DTO**: `Get_events_userIdQueryDTO`
- **Output DTO**: `ProctorResponseDTO` or List
- **Repository Dependencies**: `ProctorReadModelRepository`

## Module: `modules/quiz/queries/`
### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `QuizResponseDTO` or List
- **Repository Dependencies**: `QuizReadModelRepository`

## Module: `modules/feed/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `FeedResponseDTO` or List
- **Repository Dependencies**: `FeedReadModelRepository`

## Module: `modules/bi/queries/`
### Get_overviewQuery
- **Input DTO**: `Get_overviewQueryDTO`
- **Output DTO**: `BiResponseDTO` or List
- **Repository Dependencies**: `BiReadModelRepository`

### Get_exportQuery
- **Input DTO**: `Get_exportQueryDTO`
- **Output DTO**: `BiResponseDTO` or List
- **Repository Dependencies**: `BiReadModelRepository`

## Module: `modules/finance/queries/`
### Get_summaryQuery
- **Input DTO**: `Get_summaryQueryDTO`
- **Output DTO**: `FinanceResponseDTO` or List
- **Repository Dependencies**: `FinanceReadModelRepository`

### Get_ledgerQuery
- **Input DTO**: `Get_ledgerQueryDTO`
- **Output DTO**: `FinanceResponseDTO` or List
- **Repository Dependencies**: `FinanceReadModelRepository`

### Get_students_idQuery
- **Input DTO**: `Get_students_idQueryDTO`
- **Output DTO**: `FinanceResponseDTO` or List
- **Repository Dependencies**: `FinanceReadModelRepository`

### Get_reconcileQuery
- **Input DTO**: `Get_reconcileQueryDTO`
- **Output DTO**: `FinanceResponseDTO` or List
- **Repository Dependencies**: `FinanceReadModelRepository`

## Module: `modules/invoice/queries/`
### Get_statsQuery
- **Input DTO**: `Get_statsQueryDTO`
- **Output DTO**: `InvoiceResponseDTO` or List
- **Repository Dependencies**: `InvoiceReadModelRepository`

### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `InvoiceResponseDTO` or List
- **Repository Dependencies**: `InvoiceReadModelRepository`

### Get_id_pdfQuery
- **Input DTO**: `Get_id_pdfQueryDTO`
- **Output DTO**: `InvoiceResponseDTO` or List
- **Repository Dependencies**: `InvoiceReadModelRepository`

## Module: `modules/payment/queries/`
### Get_payment_status_studentIdQuery
- **Input DTO**: `Get_payment_status_studentIdQueryDTO`
- **Output DTO**: `PaymentResponseDTO` or List
- **Repository Dependencies**: `PaymentReadModelRepository`

## Module: `modules/backup/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `BackupResponseDTO` or List
- **Repository Dependencies**: `BackupReadModelRepository`

### Get_id_downloadQuery
- **Input DTO**: `Get_id_downloadQueryDTO`
- **Output DTO**: `BackupResponseDTO` or List
- **Repository Dependencies**: `BackupReadModelRepository`

## Module: `modules/systemlog/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `SystemlogResponseDTO` or List
- **Repository Dependencies**: `SystemlogReadModelRepository`

## Module: `modules/auth/queries/`
### Get_zalo_callback3Query
- **Input DTO**: `Get_zalo_callback3QueryDTO`
- **Output DTO**: `AuthResponseDTO` or List
- **Repository Dependencies**: `AuthReadModelRepository`

## Module: `modules/student/queries/`
### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `StudentResponseDTO` or List
- **Repository Dependencies**: `StudentReadModelRepository`

### Get_id_full_detailQuery
- **Input DTO**: `Get_id_full_detailQueryDTO`
- **Output DTO**: `StudentResponseDTO` or List
- **Repository Dependencies**: `StudentReadModelRepository`

## Module: `modules/employee/queries/`
### Get_rootQuery
- **Input DTO**: `Get_rootQueryDTO`
- **Output DTO**: `EmployeeResponseDTO` or List
- **Repository Dependencies**: `EmployeeReadModelRepository`

### Get_id_payrollQuery
- **Input DTO**: `Get_id_payrollQueryDTO`
- **Output DTO**: `EmployeeResponseDTO` or List
- **Repository Dependencies**: `EmployeeReadModelRepository`

## Module: `modules/teacher/queries/`
### Get_idQuery
- **Input DTO**: `Get_idQueryDTO`
- **Output DTO**: `TeacherResponseDTO` or List
- **Repository Dependencies**: `TeacherReadModelRepository`

### Get_id_financeQuery
- **Input DTO**: `Get_id_financeQueryDTO`
- **Output DTO**: `TeacherResponseDTO` or List
- **Repository Dependencies**: `TeacherReadModelRepository`

### Get_id_finance_pendingQuery
- **Input DTO**: `Get_id_finance_pendingQueryDTO`
- **Output DTO**: `TeacherResponseDTO` or List
- **Repository Dependencies**: `TeacherReadModelRepository`

## Module: `modules/transaction/queries/`
### Get_statsQuery
- **Input DTO**: `Get_statsQueryDTO`
- **Output DTO**: `TransactionResponseDTO` or List
- **Repository Dependencies**: `TransactionReadModelRepository`

### Get_teacher_teacherIdQuery
- **Input DTO**: `Get_teacher_teacherIdQueryDTO`
- **Output DTO**: `TransactionResponseDTO` or List
- **Repository Dependencies**: `TransactionReadModelRepository`

