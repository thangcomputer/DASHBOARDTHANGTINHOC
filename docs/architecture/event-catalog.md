# Domain Event Catalog

## Domain: attendance
- **Put_scheduleIdCompleted** (Triggered by: Put_scheduleIdCommand)
- **_scheduleIdDeleted** (Triggered by: Delete_scheduleIdCommand)
- **Patch_scheduleId_cancelCompleted** (Triggered by: Patch_scheduleId_cancelCommand)

## Domain: blog
- **Post_manage_postsCompleted** (Triggered by: Post_manage_postsCommand)
- **Put_manage_posts_idCompleted** (Triggered by: Put_manage_posts_idCommand)
- **Post_manage_posts_id_publishCompleted** (Triggered by: Post_manage_posts_id_publishCommand)
- **Post_manage_posts_id_hideCompleted** (Triggered by: Post_manage_posts_id_hideCommand)
- **_manage_posts_idDeleted** (Triggered by: Delete_manage_posts_idCommand)

## Domain: chat
- **Post_uploadCompleted** (Triggered by: Post_uploadCommand)
- **Post_rootCompleted** (Triggered by: Post_rootCommand)

## Domain: cms
- **Put_forms_idCompleted** (Triggered by: Put_forms_idCommand)
- **_forms_idDeleted** (Triggered by: Delete_forms_idCommand)
- **Post_forms_idOrSlug_submitCompleted** (Triggered by: Post_forms_idOrSlug_submitCommand)
- **Post_forms_idOrSlug_submit_authCompleted** (Triggered by: Post_forms_idOrSlug_submit_authCommand)
- **Put_reports_idCompleted** (Triggered by: Put_reports_idCommand)
- **_reports_idDeleted** (Triggered by: Delete_reports_idCommand)
- **Post_id_advanceCompleted** (Triggered by: Post_id_advanceCommand)

## Domain: assignment
- **Post_uploadCompleted** (Triggered by: Post_uploadCommand)
- **Post_rootCompleted** (Triggered by: Post_rootCommand)
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_submitCompleted** (Triggered by: Post_id_submitCommand)
- **Put_submissions_submissionId_gradeCompleted** (Triggered by: Put_submissions_submissionId_gradeCommand)

## Domain: course
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **Patch_id_priceCompleted** (Triggered by: Patch_id_priceCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_restoreCompleted** (Triggered by: Post_id_restoreCommand)

## Domain: enrollment
- **Post_id_enrollmentsCompleted** (Triggered by: Post_id_enrollmentsCommand)
- **Put_id_enrollments_enrollmentId_settingsCompleted** (Triggered by: Put_id_enrollments_enrollmentId_settingsCommand)
- **Put_id_enrollments_enrollmentId_payCompleted** (Triggered by: Put_id_enrollments_enrollmentId_payCommand)
- **_id_enrollments_enrollmentIdDeleted** (Triggered by: Delete_id_enrollments_enrollmentIdCommand)

## Domain: evaluation
- **Post_id_readCompleted** (Triggered by: Post_id_readCommand)

## Domain: examresult
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: quiz
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_submitCompleted** (Triggered by: Post_id_submitCommand)

## Domain: feed
- **Post_rootCompleted** (Triggered by: Post_rootCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_commentsCompleted** (Triggered by: Post_id_commentsCommand)
- **_id_comments_commentIdDeleted** (Triggered by: Delete_id_comments_commentIdCommand)

## Domain: file
- **Post_uploadCompleted** (Triggered by: Post_uploadCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: finance
- **Post_ledger_id_voidCompleted** (Triggered by: Post_ledger_id_voidCommand)
- **Post_snapshots_rebuildCompleted** (Triggered by: Post_snapshots_rebuildCommand)
- **Post_students_id_sync_cacheCompleted** (Triggered by: Post_students_id_sync_cacheCommand)

## Domain: invoice
- **Post_id_pdf_queueCompleted** (Triggered by: Post_id_pdf_queueCommand)
- **Post_id_emailCompleted** (Triggered by: Post_id_emailCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: backup
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: systemlog
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: system
- **Post_upload_popup_image4Completed** (Triggered by: Post_upload_popup_image4Command)
- **Post_upload_invoice_signature5Completed** (Triggered by: Post_upload_invoice_signature5Command)
- **Put_training_data11Completed** (Triggered by: Put_training_data11Command)
- **Put_student_training_data13Completed** (Triggered by: Put_student_training_data13Command)
- **_exam_subjects_id19Deleted** (Triggered by: Delete_exam_subjects_id19Command)
- **Post_upload_logo21Completed** (Triggered by: Post_upload_logo21Command)
- **Post_upload_favicon22Completed** (Triggered by: Post_upload_favicon22Command)
- **Post_upload_invoice_logo23Completed** (Triggered by: Post_upload_invoice_logo23Command)

## Domain: student
- **Post_rootCompleted** (Triggered by: Post_rootCommand)
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **Put_id_exam_progressCompleted** (Triggered by: Put_id_exam_progressCommand)
- **Patch_id_priceCompleted** (Triggered by: Patch_id_priceCommand)
- **Put_id_payCompleted** (Triggered by: Put_id_payCommand)
- **Put_id_refundCompleted** (Triggered by: Put_id_refundCommand)
- **Put_id_unlock_examCompleted** (Triggered by: Put_id_unlock_examCommand)
- **Put_id_lock_examCompleted** (Triggered by: Put_id_lock_examCommand)
- **Put_id_assign_teacherCompleted** (Triggered by: Put_id_assign_teacherCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_reset_today_attendanceCompleted** (Triggered by: Post_id_reset_today_attendanceCommand)
- **Post_id_reset_historyCompleted** (Triggered by: Post_id_reset_historyCommand)
- **Put_id_pay_teacherCompleted** (Triggered by: Put_id_pay_teacherCommand)

## Domain: employee
- **Post_rootCompleted** (Triggered by: Post_rootCommand)
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Post_id_payCompleted** (Triggered by: Post_id_payCommand)

## Domain: staff
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)

## Domain: teacher
- **Put_idCompleted** (Triggered by: Put_idCommand)
- **Put_id_scoreCompleted** (Triggered by: Put_id_scoreCommand)
- **Put_id_approveCompleted** (Triggered by: Put_id_approveCommand)
- **Post_id_submit_practicalCompleted** (Triggered by: Post_id_submit_practicalCommand)
- **Put_id_rejectCompleted** (Triggered by: Put_id_rejectCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)
- **Put_id_finance_pay_flexibleCompleted** (Triggered by: Put_id_finance_pay_flexibleCommand)
- **Put_id_finance_pay_allCompleted** (Triggered by: Put_id_finance_pay_allCommand)

## Domain: transaction
- **Put_id_confirmCompleted** (Triggered by: Put_id_confirmCommand)
- **Put_id_cancelCompleted** (Triggered by: Put_id_cancelCommand)
- **_idDeleted** (Triggered by: Delete_idCommand)

