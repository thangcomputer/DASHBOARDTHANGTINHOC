# Endpoint Coverage Report

## Summary
- **Total Routes Analyzed**: 286
- **Migrated to New RBAC**: 0
- **Legacy (Guard)**: 39
- **No Auth**: 80

## Route Details
| Method | Route | Authentication | Authorization | Permission | Policies | Legacy fallback | Coverage |
|---|---|---|---|---|---|---|---|
| GET | /api/ai/status | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/ai/quiz | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/ai/notification-draft | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/ai/summarize | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/ai/complete | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/analytics/revenue | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/analytics/enrollment | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/analytics/branches | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/assignment/upload | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/assignment/course/:courseId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/assignment/student/:studentId/course/:courseId | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/assignment/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/assignment/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/assignment/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/assignment/:id/submit | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/assignment/submissions/:submissionId/grade | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/csrf-token | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/captcha | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/refresh | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/check-role | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/google | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/google/callback | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/zalo | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/zalo/callback | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/login | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/login/public | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/login/internal | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/mfa/verify | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/mfa/setup | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/mfa/enable | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/mfa/disable | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/mfa/status | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/logout | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/register-teacher | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/change-password | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/auth/me | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/avatar | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/forgot-password/request | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/forgot-password/verify | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/admin/generate-otp | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/reset-password-request | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/auth/admin/reset-password | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/auth/admin/profile | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/backup/stats | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/backup/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/backup/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/backup/:id/download | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| DELETE | /api/backup/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/bi/overview | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/bi/export | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/blog/posts | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/blog/posts/:slugOrId | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/blog/manage/posts | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/blog/manage/posts/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/blog/manage/posts | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/blog/manage/posts/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/blog/manage/posts/:id/publish | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/blog/manage/posts/:id/hide | ❌ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/blog/manage/posts/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/blog/manage/upload | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/branch/all | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/branch/ | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/branch/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/branch/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/branch/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/forms | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/forms/:idOrSlug | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/builder/forms | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/builder/forms/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/builder/forms/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/builder/forms/:idOrSlug/submit | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/builder/forms/:idOrSlug/submit-auth | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/forms/:id/submissions | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/forms/:id/submissions/export | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/reports/sources | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/reports | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/builder/reports | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/builder/reports/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/builder/reports/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/reports/:id/run | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/builder/reports/:id/export | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/course/stats/summary | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/course/ | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/course/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/course/ | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/course/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/course/:id/price | ❌ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/course/:id | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/course/:id/restore | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/course/seed | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/employee/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/employee/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/employee/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/employee/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/employee/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/employee/:id/pay | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/employee/payroll | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/evaluation/admin | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/evaluation/teacher/:teacherId | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/evaluation/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/evaluation/:id/read | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/examResult/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/examResult/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/examResult/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/examResult/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/feed/upload | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/feed/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/feed/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/feed/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/feed/:id/like | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/feed/:id/react | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/feed/:id/comments | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/feed/:id/comments/:commentId | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/file/upload | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/file/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/file/categories | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/file/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/file/purge-expired | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/file/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/finance/summary | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/finance/ledger | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/finance/students/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/finance/ledger/:id/void | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/finance/discount | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/finance/reconcile | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/finance/snapshots/rebuild | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/finance/students/:id/sync-cache | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/invoice/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/invoice/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/invoice/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/invoice/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/invoice/:id/pdf | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/invoice/:id/pdf/queue | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/invoice/:id/email | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/invoice/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/contacts | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/conversations/:userId | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/search/:userId | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/hidden | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/:conversationId | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/sync/:userId | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/message/upload | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/message/ | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/message/hide/:conversationId | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/message/read/:conversationId | ❌ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/message/:messageId/reaction | ❌ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/message/:messageId/recall | ❌ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/message/:messageId/soft-delete | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/message/groups | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/groups/user/:userId | ❌ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/message/groups/:groupId | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/message/unread/:userId | ❌ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/message/broadcast | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/monitoring/health | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/monitoring/metrics | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/monitoring/overview | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/monitoring/metrics/reset | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/notification/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/notification/count | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/notification/unread | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/notification/mark-read | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/notification/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/notification/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/proctor/events | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/proctor/events/me | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/proctor/events/:userId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/quiz/teacher | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/quiz/create | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/quiz/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/quiz/student | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/quiz/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/quiz/:id/submit | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/quiz/admin/all | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/schedule/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/schedule/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/schedule/teacher/:teacherId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/schedule/student/:studentId | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/schedule/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/schedule/:scheduleId | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/schedule/:scheduleId | ✅ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/schedule/:scheduleId/cancel | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/schedule/history/:teacherId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/bank | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-popup-image | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-invoice-signature | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/popup | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/payment | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/web | ❌ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/web | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/training-data | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/training-data | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/student-training-data | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/student-training-data | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/student-exam-config | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/teacher-exam-config | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/teacher-exam-config | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/settings/exam-subjects | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/exam-subjects | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/settings/exam-subjects/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/settings/student-exam-config | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-training-file | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-logo | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-favicon | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/upload-invoice-logo | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/settings/reset-data | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/staff/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/staff/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| PUT | /api/staff/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| DELETE | /api/staff/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/student/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/student/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/student/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/student/:id/full-detail | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/student/import | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/student/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/exam-progress | ✅ | ❌ None | None | Yes | No | Requires Update |
| PATCH | /api/student/:id/price | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/pay | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/refund | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/unlock-exam | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/lock-exam | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/student/:id/enrollments | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/enrollments/:enrollmentId/settings | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/enrollments/:enrollmentId/pay | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/student/:id/enrollments/:enrollmentId | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/assign-teacher | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/student/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/student/:id/reset-today-attendance | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/student/:id/reset-history | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/student/:id/pay-teacher | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/systemLog/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/systemLog/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/systemLog/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/teacher/upload-practical | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/teacher/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teacher/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teacher/stats/summary | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teacher/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id/score | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id/approve | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/teacher/:id/submit-practical | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id/reject | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/teacher/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teacher/:id/finance | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teacher/:id/finance/pending | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id/finance/pay-flexible | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/teacher/:id/finance/pay-all | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/teachingGuide/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/tenant/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/tenant/meta/branches | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/tenant/:id/stats | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/tenant/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/tenant/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| PUT | /api/tenant/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/tenant/:id/branches | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/training/courses | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/training/courses/:id/lessons | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/training/complete-lesson | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/training/progress/me | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/training/teacher/overview | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/training/save-watch-progress | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/training/admin/progress/:courseId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/transaction/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/transaction/stats | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/transaction/teacher/:teacherId | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/transaction/calculate | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/transaction/ | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/transaction/:id/confirm | ✅ | ❌ None | None | Yes | No | Requires Update |
| PUT | /api/transaction/:id/cancel | ✅ | ❌ None | None | Yes | No | Requires Update |
| DELETE | /api/transaction/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/webhook/payment-session | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/webhook/create-session | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/webhook/payment-session/:id | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/webhook/payment-status | ✅ | ❌ None | None | Yes | No | Requires Update |
| POST | /api/webhook/sepay | ❌ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/webhook/payment-status/:studentId | ✅ | ❌ None | None | Yes | No | Requires Update |
| GET | /api/workflow/definitions | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/workflow/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/workflow/sync | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| GET | /api/workflow/:id | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/workflow/ | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
| POST | /api/workflow/:id/advance | ✅ | ⚠️ Legacy Guard | None | Yes | Yes | Requires Update |
