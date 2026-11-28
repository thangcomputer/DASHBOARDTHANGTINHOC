# API mapping — LMS Thắng Tin Học

Sinh từ source ngày 2026-11-28. Route thật nằm trong `routes/*.js` và được `server.js` mount. Handler phần lớn nằm ngay trong file route, không tách controller riêng.

## Cổng vào

| Lớp | Cách gọi | Auth |
| --- | --- | --- |
| Web | `client/src/services/api.js` → `apiFetch` | Bearer theo vai trò trên URL + cookie + CSRF khi ghi |
| Web (một phần admin) | SWR bọc `apiFetch`, `dedupingInterval` 30s, không refetch khi focus | Cùng `apiFetch` |
| Mobile | `thang-tin-hoc-mobile/src/services/apiClient.ts` → `mobileApiRequest` | Bearer SecureStore, header `X-Client-Platform: mobile`, CSRF khi ghi, refresh một promise |
| Realtime | Web `SocketContext`, mobile `socketService` | Token trong `auth` handshake. Không đổi tên event |

## Mount trong server.js (49)

| Prefix | Target |
| --- | --- |
| `/api/auth` | `authRoutes` |
| `/api/calls` | `require('./routes/callRoutes')` |
| `/api/class-room` | `require('./routes/classRoomRoutes')` |
| `/api/communication-preferences` | `require('./routes/communicationPreferencesRoutes')` |
| `/api/students` | `studentRoutes` |
| `/api/invoices` | `invoiceRoutes` |
| `/api/messages` | `messageRoutes` |
| `/api/schedules` | `scheduleRoutes` |
| `/api/courses` | `courseRoutes` |
| `/api/teachers` | `teacherRoutes` |
| `/api/assignments` | `assignmentRoutes` |
| `/api/quizzes` | `quizRoutes` |
| `/api/evaluations` | `evaluationRoutes` |
| `/api/exam-results` | `examResultRoutes` |
| `/api/system-logs` | `systemLogRoutes` |
| `/api/training` | `teachingGuideRoutes` |
| `/api/training-lms` | `trainingRoutes` |
| `/api/transactions` | `transactionRoutes` |
| `/api/settings` | `settingsRoutes` |
| `/api/webhooks` | `webhookRoutes` |
| `/api/staff` | `staffRoutes` |
| `/api/branches` | `branchRoutes` |
| `/api/analytics` | `analyticsRoutes` |
| `/api/employees` | `employeeRoutes` |
| `/api/notifications` | `notificationRoutes` |
| `/api/mobile-push-tokens` | `mobilePushTokenRoutes` |
| `/api/mobile-billing` | `require('./routes/mobileBillingRoutes')` |
| `/api/files` | `fileRoutes` |
| `/api/backups` | `backupRoutes` |
| `/api/monitoring` | `monitoringRoutes` |
| `/api/proctor` | `proctorRoutes` |
| `/api/ai` | `aiRoutes` |
| `/api/ai-support` | `aiSupportRoutes` |
| `/api/bi` | `biRoutes` |
| `/api/finance` | `financeRoutes` |
| `/api/workflows` | `workflowRoutes` |
| `/api/builder` | `builderRoutes` |
| `/api/tenants` | `tenantRoutes` |
| `/api/feed` | `feedRoutes` |
| `/api/blog` | `blogRoutes` |
| `/api/center-info` | `centerInfoRoutes` |
| `/api/cert-prep` | `certPrepRoutes` |
| `/api/lesson-practice` | `lessonPracticeRoutes` |
| `/api/daily-practice` | `dailyPracticeRoutes` |
| `/api/dewskill-classes` | `require('./routes/dewskillClassRoutes')` |
| `/api/dewskill-students` | `require('./routes/dewskillStudentRoutes')` |
| `/api/lms-progress` | `lmsProgressRoutes` |
| `/api/subscription` | `require('./routes/subscriptionRoutes')` |
| `/api/meet-classes` | `require('./routes/meetClassRoutes')` |

## Route khai báo trong routes/ : 620 handler, 51 file

| File | Số handler |
| --- | ---: |
| `routes/authRoutes.js` | 53 |
| `routes/certPrepRoutes.js` | 43 |
| `routes/dailyPracticeRoutes.js` | 41 |
| `routes/lessonPracticeRoutes.js` | 34 |
| `routes/messageRoutes.js` | 34 |
| `routes/settingsRoutes.js` | 33 |
| `routes/studentRoutes.js` | 31 |
| `routes/aiSupportRoutes.js` | 25 |
| `routes/teacherRoutes.js` | 25 |
| `routes/dewskillClassRoutes.js` | 22 |
| `routes/subscriptionRoutes.js` | 20 |
| `routes/builderRoutes.js` | 16 |
| `routes/trainingRoutes.js` | 16 |
| `routes/blogRoutes.js` | 14 |
| `routes/scheduleRoutes.js` | 14 |
| `routes/feedRoutes.js` | 13 |
| `routes/transactionRoutes.js` | 11 |
| `routes/financeRoutes.js` | 10 |
| `routes/centerInfoRoutes.js` | 9 |
| `routes/courseRoutes.js` | 9 |
| `routes/monitoringRoutes.js` | 9 |
| `routes/assignmentRoutes.js` | 8 |
| `routes/invoiceRoutes.js` | 8 |
| `routes/notificationRoutes.js` | 8 |
| `routes/quizRoutes.js` | 8 |
| `routes/employeeRoutes.js` | 7 |
| `routes/tenantRoutes.js` | 7 |
| `routes/webhookRoutes.js` | 7 |
| `routes/fileRoutes.js` | 6 |
| `routes/meetClassRoutes.js` | 6 |
| `routes/workflowRoutes.js` | 6 |
| `routes/aiRoutes.js` | 5 |
| `routes/backupRoutes.js` | 5 |
| `routes/branchRoutes.js` | 5 |
| `routes/dewskillStudentRoutes.js` | 5 |
| `routes/evaluationRoutes.js` | 5 |
| `routes/mobileBillingRoutes.js` | 5 |
| `routes/examResultRoutes.js` | 4 |
| `routes/lmsProgressRoutes.js` | 4 |
| `routes/mobilePushTokenRoutes.js` | 4 |
| `routes/publicPolicyRoutes.js` | 4 |
| `routes/staffRoutes.js` | 4 |
| `routes/analyticsRoutes.js` | 3 |
| `routes/proctorRoutes.js` | 3 |
| `routes/systemLogRoutes.js` | 3 |
| `routes/biRoutes.js` | 2 |
| `routes/communicationPreferencesRoutes.js` | 2 |
| `routes/callRoutes.js` | 1 |
| `routes/classRoomRoutes.js` | 1 |
| `routes/internalRbacRoutes.js` | 1 |
| `routes/teachingGuideRoutes.js` | 1 |

## Endpoint theo file

### routes/aiRoutes.js

- GET `/status`
- POST `/quiz`
- POST `/notification-draft`
- POST `/summarize`
- POST `/complete`

### routes/aiSupportRoutes.js

- GET `/status`
- GET `/packages`
- POST `/packages/checkout`
- GET `/packages/session/:sessionId`
- POST `/packages/simulate-paid`
- POST `/message`
- POST `/open`
- POST `/escalate`
- POST `/reset`
- POST `/end`
- POST `/clear-history`
- GET `/queue`
- GET `/thread/:conversationId`
- POST `/claim`
- POST `/resolve`
- POST `/reply`
- POST `/quick-ask`
- POST `/quick-ask/feedback`
- POST `/quick-ask/client-event`
- GET `/admin/rag-metrics`
- GET `/admin/rag-feedback`
- PATCH `/admin/rag-feedback/:id`
- GET `/admin/model-policy`
- PUT `/admin/model-policy`
- POST `/admin/model-policy/reset`

### routes/analyticsRoutes.js

- GET `/revenue`
- GET `/enrollment`
- GET `/branches`

### routes/assignmentRoutes.js

- POST `/upload`
- GET `/course/:courseId`
- GET `/student/:studentId/course/:courseId`
- POST `/`
- PUT `/:id`
- DELETE `/:id`
- POST `/:id/submit`
- PUT `/submissions/:submissionId/grade`

### routes/authRoutes.js

- GET `/csrf-token`
- GET `/captcha`
- POST `/refresh`
- POST `/check-role`
- GET `/google`
- GET `/google/callback`
- GET `/zalo`
- GET `/zalo/callback`
- POST `/login`
- POST `/login/public`
- POST `/login/mobile`
- POST `/login/internal`
- POST `/mfa/verify`
- POST `/mfa/otp-resend`
- POST `/mfa/setup`
- POST `/mfa/enable`
- POST `/mfa/disable`
- GET `/mfa/status`
- GET `/mfa/otp-config`
- POST `/mfa/otp-setup/send`
- POST `/mfa/otp-setup/verify`
- POST `/mfa/otp-disable`
- POST `/logout`
- GET `/registered-devices`
- POST `/registered-devices/:id/revoke`
- GET `/device-sessions`
- POST `/device-sessions/revoke-others`
- POST `/device-sessions/:sessionId/revoke`
- POST `/register-teacher`
- GET `/sessions`
- DELETE `/sessions/:sessionId`
- POST `/change-password`
- POST `/delete-account`
- POST `/free-survey`
- POST `/welcome-celebration/seen`
- POST `/course-celebration/seen`
- GET `/me`
- POST `/avatar`
- POST `/forgot-password/request`
- POST `/forgot-password/verify`
- POST `/admin/generate-otp`
- POST `/reset-password-request`
- POST `/admin/reset-password`
- PUT `/admin/profile`
- POST `/register-free`
- POST `/free-portal/send-otp`
- POST `/free-portal/resend-otp`
- POST `/free-portal/verify-otp`
- GET `/free-portal/social/status`
- POST `/free-portal/social/exchange`
- POST `/free-portal/social/complete`
- GET `/free-portal/:provider`
- GET `/free-portal/:provider/callback`

### routes/backupRoutes.js

- GET `/stats`
- GET `/`
- POST `/`
- GET `/:id/download`
- DELETE `/:id`

### routes/biRoutes.js

- GET `/overview`
- GET `/export`

### routes/blogRoutes.js

- GET `/topics`
- GET `/posts`
- GET `/posts/:slugOrId`
- GET `/manage/posts`
- GET `/manage/posts/:id`
- POST `/manage/posts`
- PUT `/manage/posts/:id`
- POST `/manage/posts/:id/publish`
- POST `/manage/posts/:id/hide`
- DELETE `/manage/posts/:id`
- POST `/manage/topics`
- PUT `/manage/topics/:id`
- DELETE `/manage/topics/:id`
- POST `/manage/upload`

### routes/branchRoutes.js

- GET `/`
- GET `/all`
- POST `/`
- PUT `/:id`
- DELETE `/:id`

### routes/builderRoutes.js

- GET `/forms`
- GET `/forms/:idOrSlug`
- POST `/forms`
- PUT `/forms/:id`
- DELETE `/forms/:id`
- POST `/forms/:idOrSlug/submit`
- POST `/forms/:idOrSlug/submit-auth`
- GET `/forms/:id/submissions`
- GET `/forms/:id/submissions/export`
- GET `/reports/sources`
- GET `/reports`
- POST `/reports`
- PUT `/reports/:id`
- DELETE `/reports/:id`
- GET `/reports/:id/run`
- GET `/reports/:id/export`

### routes/callRoutes.js

- GET `/history`

### routes/centerInfoRoutes.js

- GET `/`
- GET `/manage/overview`
- PUT `/manage/overview`
- GET `/manage/items`
- POST `/manage/items`
- PUT `/manage/items/:id`
- DELETE `/manage/items/:id`
- POST `/manage/items/reorder`
- POST `/manage/upload`

### routes/certPrepRoutes.js

- POST `/upload`
- GET `/my-catalog`
- POST `/sessions`
- GET `/sessions/:id`
- POST `/sessions/:id/pause`
- GET `/sessions/:id/result`
- GET `/tests/:id/attempts`
- PATCH `/sessions/:id`
- POST `/sessions/:id/submit`
- POST `/sessions/:id/answer-file`
- DELETE `/sessions/:id`
- GET `/courses`
- POST `/courses`
- GET `/courses/:id/levels`
- GET `/courses/:id/questions/export`
- POST `/courses/:id/questions/import`
- POST `/courses/:id/levels`
- PUT `/courses/:id`
- DELETE `/courses/:id`
- GET `/levels/:id/tests`
- POST `/levels/:id/tests`
- PUT `/levels/:id`
- DELETE `/levels/:id`
- GET `/tests/:id/questions`
- GET `/tests/:id/prompt`
- POST `/tests/:id/prompt`
- DELETE `/tests/:id/prompt`
- POST `/tests/:id/questions`
- DELETE `/tests/:id/questions`
- PUT `/tests/:id`
- DELETE `/tests/:id`
- PATCH `/questions/reorder`
- PUT `/questions/:id`
- DELETE `/questions/:id`
- GET `/students`
- GET `/access`
- GET `/enrollment-mappings`
- POST `/enrollment-mappings`
- PATCH `/enrollment-mappings/:id`
- DELETE `/enrollment-mappings/:id`
- POST `/enrollment-mappings/sync`
- POST `/access`
- DELETE `/access/:id`

### routes/classRoomRoutes.js

- POST `/ticket`

### routes/communicationPreferencesRoutes.js

- GET `/`
- PUT `/`

### routes/courseRoutes.js

- GET `/stats/summary`
- GET `/`
- GET `/:id`
- POST `/`
- PUT `/:id`
- PATCH `/:id/price`
- DELETE `/:id`
- POST `/:id/restore`
- POST `/seed`

### routes/dailyPracticeRoutes.js

- GET `/topics`
- POST `/topics`
- PUT `/topics/:id`
- DELETE `/topics/:id`
- POST `/topics/:id/publish-drafts`
- POST `/starter`
- GET `/xp-packs`
- PUT `/xp-packs`
- GET `/topics/:id/units`
- POST `/topics/:id/units`
- PUT `/topics/:id/units/order`
- POST `/topics/:id/units/assign-unassigned`
- PUT `/units/:id`
- DELETE `/units/:id`
- GET `/questions`
- POST `/questions`
- POST `/questions/ai-generate`
- PUT `/questions/:id`
- DELETE `/questions/:id`
- POST `/exercises/test-grade`
- GET `/my/overview`
- GET `/my/path`
- PUT `/my/path/active-topic`
- GET `/my/path/units/:unitId/videos`
- POST `/my/path/units/:unitId/videos/:videoId/checks/:checkId/answer`
- POST `/my/path/units/:unitId/videos/:videoId/checks/:checkId/hint`
- POST `/my/path/units/:unitId/videos/:videoId/checks/:checkId/skip`
- POST `/my/path/videos/watched`
- POST `/my/path/units/:unitId/sections/complete`
- POST `/my/path/units/:unitId/nodes/:nodeKey/exercises/:exerciseId/submit`
- POST `/my/path/units/:unitId/chest/claim`
- POST `/my/sessions`
- POST `/my/sessions/:id/answer`
- POST `/my/sessions/:id/hint`
- POST `/my/sessions/:id/finish`
- POST `/my/sessions/:id/abandon`
- POST `/my/spaced-review/start`
- POST `/my/referral/redeem`
- GET `/my/related-topics`
- POST `/my/ai-assistant`
- POST `/my/placement-advice`

### routes/dewskillClassRoutes.js

- GET `/catalog-ui`
- PUT `/catalog-ui`
- POST `/catalog-ui/reset`
- POST `/catalog-ui/upload-image`
- GET `/meta`
- POST `/seed-defaults`
- GET `/students/search`
- GET `/access`
- POST `/access/grant`
- PATCH `/access/:accessId`
- DELETE `/access/:accessId`
- GET `/my-visible`
- GET `/my/purchase-history`
- POST `/my/checkout`
- POST `/my/redeem-code`
- GET `/my/payment-sessions/:sessionId`
- POST `/my/payment-sessions/:sessionId/simulate-paid`
- GET `/`
- POST `/`
- PUT `/:id`
- PATCH `/:id/visibility`
- DELETE `/:id`

### routes/dewskillStudentRoutes.js

- GET `/`
- POST `/`
- PATCH `/:id`
- POST `/:id/reset-devices`
- DELETE `/:id`

### routes/employeeRoutes.js

- GET `/`
- GET `/stats`
- POST `/`
- PUT `/:id`
- DELETE `/:id`
- POST `/:id/pay`
- GET `/payroll`

### routes/evaluationRoutes.js

- GET `/admin`
- GET `/teacher/:teacherId`
- GET `/mine`
- POST `/`
- POST `/:id/read`

### routes/examResultRoutes.js

- GET `/`
- POST `/`
- PUT `/:id`
- DELETE `/:id`

### routes/feedRoutes.js

- POST `/upload`
- GET `/`
- GET `/reports`
- POST `/:id/reports`
- POST `/:id/pin`
- POST `/reports/:reportId/resolve`
- POST `/`
- PUT `/:id`
- DELETE `/:id`
- POST `/:id/like`
- POST `/:id/react`
- POST `/:id/comments`
- DELETE `/:id/comments/:commentId`

### routes/fileRoutes.js

- POST `/upload`
- GET `/stats`
- GET `/categories`
- GET `/`
- POST `/purge-expired`
- DELETE `/:id`

### routes/financeRoutes.js

- GET `/summary`
- GET `/ledger`
- GET `/ledger/export`
- GET `/students/:id`
- POST `/students/:id/heal-orphans`
- POST `/ledger/:id/void`
- POST `/discount`
- GET `/reconcile`
- POST `/snapshots/rebuild`
- POST `/students/:id/sync-cache`

### routes/internalRbacRoutes.js

- GET `/runtime-evidence`

### routes/invoiceRoutes.js

- GET `/`
- GET `/stats`
- GET `/:id`
- POST `/`
- GET `/:id/pdf`
- POST `/:id/pdf/queue`
- POST `/:id/email`
- DELETE `/:id`

### routes/lessonPracticeRoutes.js

- GET `/backup/export`
- POST `/backup/import`
- GET `/subjects`
- GET `/courses`
- POST `/subjects`
- POST `/subjects/seed-defaults`
- PATCH `/subjects/:id`
- DELETE `/subjects/:id`
- GET `/subjects/:id/units`
- PATCH `/subjects/:id/units/reorder`
- POST `/subjects/:id/units`
- PATCH `/units/:id`
- DELETE `/units/:id`
- GET `/units/:id/items`
- POST `/units/:id/items`
- PATCH `/items/:id`
- DELETE `/items/:id`
- GET `/progress`
- POST `/upload`
- GET `/my/subjects`
- POST `/my/courses/:id/checkout`
- GET `/my/course-purchase-sessions/:sessionId`
- POST `/my/course-purchase-sessions/:sessionId/simulate-paid`
- GET `/my/subjects/:id/units`
- GET `/my/units/:id`
- POST `/my/units/:id/sections/:section`
- POST `/my/units/:id/reset-practice`
- POST `/my/items/:id/confirm`
- GET `/my/learning-goal`
- PUT `/my/learning-goal`
- GET `/my/learning-leaderboard`
- GET `/my/resume-point`
- PUT `/my/resume-point`
- POST `/my/study-heartbeat`

### routes/lmsProgressRoutes.js

- GET `/settings`
- PUT `/settings`
- GET `/me`
- GET `/leaderboard`

### routes/meetClassRoutes.js

- GET `/mine`
- GET `/eligible-students`
- GET `/`
- POST `/`
- PATCH `/:id/link`
- POST `/:id/cancel`

### routes/messageRoutes.js

- GET `/contacts`
- GET `/conversations/:userId`
- POST `/purge-orphans`
- GET `/search/:userId`
- GET `/hidden`
- GET `/pinned-conversations`
- PUT `/pin-conversation/:conversationId`
- POST `/report`
- GET `/blocks`
- POST `/block`
- DELETE `/block/:blockedUserId`
- GET `/ai-auto-reply/global`
- PUT `/ai-auto-reply/global`
- GET `/ai-auto-reply/history`
- POST `/ai-auto-reply/:conversationId/admin-disable`
- GET `/ai-auto-reply/:conversationId`
- PUT `/ai-auto-reply/:conversationId`
- GET `/:conversationId`
- GET `/sync/:userId`
- POST `/upload`
- POST `/`
- POST `/hide/:conversationId`
- PUT `/read/:conversationId`
- PUT `/:conversationId/pin`
- PATCH `/:messageId/reaction`
- PATCH `/:messageId/recall`
- PATCH `/:messageId/soft-delete`
- POST `/groups`
- GET `/groups/user/:userId`
- POST `/groups/:groupId/leave`
- POST `/groups/:groupId/members`
- DELETE `/groups/:groupId`
- GET `/unread/:userId`
- POST `/broadcast`

### routes/mobileBillingRoutes.js

- GET `/catalog`
- GET `/history`
- POST `/verify`
- POST `/restore`
- POST `/webhook`

### routes/mobilePushTokenRoutes.js

- POST `/`
- GET `/preferences`
- PUT `/preferences`
- DELETE `/`

### routes/monitoringRoutes.js

- GET `/health`
- GET `/metrics`
- GET `/overview`
- POST `/metrics/reset`
- POST `/ingest/vital`
- POST `/ingest/error`
- GET `/telemetry`
- PATCH `/telemetry/errors/:fingerprint/resolve`
- POST `/telemetry/test-error`

### routes/notificationRoutes.js

- GET `/`
- GET `/count`
- GET `/unread`
- PUT `/mark-read`
- PUT `/read-all`
- PUT `/:id/read`
- DELETE `/:id`
- POST `/`

### routes/proctorRoutes.js

- POST `/events`
- GET `/events/me`
- GET `/events/:userId`

### routes/publicPolicyRoutes.js

- GET `/privacy-policy`
- GET `/terms-of-service`
- GET `/delete-account`
- POST `/api/public/account-deletion-request`

### routes/quizRoutes.js

- GET `/teacher`
- POST `/create`
- POST `/generate-ai`
- DELETE `/:id`
- GET `/student`
- GET `/:id`
- POST `/:id/submit`
- GET `/admin/all`

### routes/scheduleRoutes.js

- GET `/`
- GET `/stats`
- GET `/teacher/:teacherId`
- GET `/pending-confirm`
- GET `/disputes`
- GET `/student/:studentId`
- POST `/`
- PUT `/:scheduleId`
- DELETE `/:scheduleId`
- POST `/:scheduleId/student-confirm`
- POST `/:scheduleId/resolve-dispute`
- PATCH `/:scheduleId/cancel`
- GET `/history/:teacherId`
- GET `/:scheduleId`

### routes/settingsRoutes.js

- GET `/bank`
- GET `/`
- PUT `/`
- POST `/upload-popup-image`
- POST `/upload-student-banner`
- POST `/upload-teacher-banner`
- POST `/upload-invoice-signature`
- GET `/popup`
- GET `/payment`
- GET `/web`
- PUT `/web`
- GET `/training-data`
- PUT `/training-data`
- GET `/student-training-data`
- PUT `/student-training-data`
- GET `/free-portal-training-data`
- PUT `/free-portal-training-data`
- POST `/free-portal-training-data/assignments/:assignmentId/submit`
- GET `/student-exam-config`
- GET `/teacher-exam-config`
- PUT `/teacher-exam-config`
- GET `/exam-subjects`
- PUT `/exam-admin-group-label`
- POST `/exam-subjects`
- PUT `/exam-subjects/:id`
- DELETE `/exam-subjects/:id`
- PUT `/student-exam-config`
- POST `/upload-training-file`
- POST `/upload-exam-warning-sound`
- POST `/upload-logo`
- POST `/upload-favicon`
- POST `/upload-invoice-logo`
- POST `/reset-data`

### routes/staffRoutes.js

- GET `/`
- POST `/`
- PUT `/:id`
- DELETE `/:id`

### routes/studentRoutes.js

- GET `/`
- GET `/stats`
- GET `/:id`
- GET `/:id/full-detail`
- POST `/import`
- POST `/reserve-code`
- POST `/`
- PUT `/:id`
- POST `/:id/exam-attempt`
- POST `/:id/exam-attempt/submit`
- POST `/:id/exam-attempt/forfeit`
- POST `/:id/exam-attempt/abandon`
- PUT `/:id/exam-progress`
- PATCH `/:id/price`
- PUT `/:id/pay`
- PUT `/:id/refund`
- PUT `/:id/unlock-exam`
- PUT `/:id/lock-exam`
- POST `/:id/enrollments`
- PUT `/:id/enrollments/:enrollmentId/settings`
- PUT `/:id/enrollments/:enrollmentId/pay`
- DELETE `/:id/enrollments/:enrollmentId`
- PUT `/:id/assign-teacher`
- POST `/purge-cancelled`
- DELETE `/:id`
- POST `/:id/reset-devices`
- POST `/:id/lock-account`
- POST `/:id/unlock-account`
- POST `/:id/reset-today-attendance`
- POST `/:id/reset-history`
- PUT `/:id/pay-teacher`

### routes/subscriptionRoutes.js

- GET `/my`
- POST `/my/redeem`
- POST `/my/checkout`
- GET `/my/sessions/:sessionId`
- POST `/my/sessions/:sessionId/simulate-paid`
- GET `/plans`
- PUT `/plans`
- GET `/xp-config`
- PUT `/xp-config`
- POST `/xp-config/reset-all`
- GET `/referral-config`
- PUT `/referral-config`
- POST `/referral-config/reset`
- GET `/codes`
- POST `/codes`
- POST `/codes/:id/revoke`
- GET `/codes/export.csv`
- GET `/students`
- GET `/students/:id`
- PUT `/students/:id`

### routes/systemLogRoutes.js

- GET `/`
- POST `/`
- DELETE `/:id`

### routes/teacherRoutes.js

- POST `/upload-practical`
- POST `/:id/exam-attempt`
- POST `/:id/exam-attempt/submit`
- POST `/:id/exam-attempt/forfeit`
- POST `/`
- GET `/`
- GET `/stats/summary`
- GET `/:id/public-card`
- GET `/:id`
- PUT `/:id`
- PUT `/:id/score`
- PUT `/:id/approve`
- PUT `/:id/grant-exam-access`
- PUT `/:id/review-practical`
- PUT `/:id/manual-activate`
- PUT `/:id/suspend`
- PUT `/:id/reactivate`
- POST `/:id/submit-practical`
- POST `/:id/practical-forfeit`
- PUT `/:id/reject`
- DELETE `/:id`
- GET `/:id/finance`
- GET `/:id/finance/pending`
- PUT `/:id/finance/pay-flexible`
- PUT `/:id/finance/pay-all`

### routes/teachingGuideRoutes.js

- GET `/`

### routes/tenantRoutes.js

- GET `/`
- GET `/meta/branches`
- GET `/:id/stats`
- GET `/:id`
- POST `/`
- PUT `/:id`
- POST `/:id/branches`

### routes/trainingRoutes.js

- GET `/courses`
- POST `/video-courses/:id/checkout`
- GET `/video-purchases/session/:sessionId`
- GET `/video-purchases`
- GET `/courses/:id/lessons`
- POST `/complete-lesson`
- GET `/progress/me`
- GET `/teacher/overview`
- POST `/save-watch-progress`
- GET `/admin/progress/:courseId`
- GET `/qa`
- POST `/qa`
- POST `/qa/:id/answer`
- POST `/qa/:id/reply`
- GET `/reviews`
- POST `/reviews`

### routes/transactionRoutes.js

- GET `/`
- GET `/export`
- GET `/stats`
- GET `/teacher/:teacherId`
- GET `/me/payment-notices`
- PUT `/:id/payment-notice-seen`
- POST `/calculate`
- POST `/`
- PUT `/:id/confirm`
- PUT `/:id/cancel`
- DELETE `/:id`

### routes/webhookRoutes.js

- POST `/payment-session`
- POST `/create-session`
- POST `/cancel-session`
- GET `/payment-session/:id`
- GET `/payment-status`
- POST `/sepay`
- GET `/payment-status/:studentId`

### routes/workflowRoutes.js

- GET `/definitions`
- GET `/`
- POST `/sync`
- GET `/:id`
- POST `/`
- POST `/:id/advance`

## Lời gọi thấy trong source

- Web: 540 lời gọi `apiFetch` / `csrfFetch` với path dạng chuỗi.
- Mobile: 31 lời gọi `mobileApiRequest` với path dạng chuỗi.
- Path ghép bằng biến không nằm trong số này.

### Web — file gọi nhiều nhất

| File | Số lời gọi chuỗi |
| --- | ---: |
| `client/src/services/api.js` | 311 |
| `client/src/services/dailyPracticeApi.js` | 45 |
| `client/src/services/certPrepApi.js` | 42 |
| `client/src/services/lessonPracticeApi.js` | 32 |
| `client/src/services/dewskillClassApi.js` | 21 |
| `client/src/services/subscriptionApi.js` | 20 |
| `client/src/components/CoursePricingTab.jsx` | 7 |
| `client/src/components/lms/LmsPlayerTabs.jsx` | 7 |
| `client/src/services/aiAutoReplyApi.js` | 6 |
| `client/src/services/meetClassApi.js` | 6 |
| `client/src/services/dewskillStudentApi.js` | 5 |
| `client/src/components/admin/shared/AddStudentModal.jsx` | 4 |
| `client/src/components/TeacherTrainingLMS.jsx` | 4 |
| `client/src/context/SocketContext.jsx` | 3 |
| `client/src/components/admin/tabs/AdminLmsXpSettings.jsx` | 2 |
| `client/src/components/EmployeeManagementTab.jsx` | 2 |
| `client/src/components/NotificationCenterPage.jsx` | 2 |
| `client/src/components/student/LmsGoalMergedCard.jsx` | 2 |
| `client/src/components/student/LmsProgressCard.jsx` | 2 |
| `client/src/context/useDataNotifications.js` | 2 |
| `client/src/components/admin/certPrep/CertPrepEnrollmentMappingPanel.jsx` | 1 |
| `client/src/components/admin/shared/AddTeacherModal.jsx` | 1 |
| `client/src/components/admin/shared/CourseSubjectSelector.jsx` | 1 |
| `client/src/components/admin/shared/EditTeacherModal.jsx` | 1 |
| `client/src/components/admin/tabs/AdminStudentsTab.jsx` | 1 |

### Mobile — file gọi

| File | Số lời gọi chuỗi |
| --- | ---: |
| `thang-tin-hoc-mobile/src/services/messageApi.ts` | 8 |
| `thang-tin-hoc-mobile/src/services/feedApi.ts` | 6 |
| `thang-tin-hoc-mobile/src/services/mockService.ts` | 5 |
| `thang-tin-hoc-mobile/src/services/courseVideoApi.ts` | 3 |
| `thang-tin-hoc-mobile/src/services/mobilePushNotifications.ts` | 2 |
| `thang-tin-hoc-mobile/src/components/FreePortalModals.tsx` | 1 |
| `thang-tin-hoc-mobile/src/screens/LoginScreen.tsx` | 1 |
| `thang-tin-hoc-mobile/src/services/aiSupportApi.ts` | 1 |
| `thang-tin-hoc-mobile/src/services/assignmentApi.ts` | 1 |
| `thang-tin-hoc-mobile/src/services/teacherApi.ts` | 1 |
| `thang-tin-hoc-mobile/src/services/teacherPaymentNoticeApi.ts` | 1 |
| `thang-tin-hoc-mobile/src/services/teacherQuizApi.ts` | 1 |

## Path khai báo trùng trong cùng file: 0

Không thấy cùng method + path lặp trong một file route.
