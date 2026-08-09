# Use Case Catalog

## Overview
Candidate Application Services (Use Cases) identified per domain.

### Domain: ai
- POST /quiz
- POST /notification-draft
- POST /summarize
- POST /complete

### Domain: analytics

### Domain: attendance
- POST /
- PUT /:scheduleId
- DELETE /:scheduleId
- PATCH /:scheduleId/cancel

### Domain: blog
- POST /manage/posts
- PUT /manage/posts/:id
- POST /manage/posts/:id/publish
- POST /manage/posts/:id/hide
- DELETE /manage/posts/:id
- POST /manage/upload

### Domain: chat
- POST /upload
- POST /
- POST /hide/:conversationId
- PUT /read/:conversationId
- PATCH /:messageId/reaction
- PATCH /:messageId/recall
- PATCH /:messageId/soft-delete
- POST /groups
- DELETE /groups/:groupId
- POST /broadcast

### Domain: cms
- POST /forms
- PUT /forms/:id
- DELETE /forms/:id
- POST /forms/:idOrSlug/submit
- POST /forms/:idOrSlug/submit-auth
- POST /reports
- PUT /reports/:id
- DELETE /reports/:id
- POST /sync
- POST /
- POST /:id/advance

### Domain: course
- POST /upload
- POST /
- PUT /:id
- DELETE /:id
- POST /:id/submit
- PUT /submissions/:submissionId/grade
- POST /
- PUT /:id
- PATCH /:id/price
- DELETE /:id
- POST /:id/restore
- POST /seed
- POST /complete-lesson
- POST /save-watch-progress

### Domain: exam
- POST /
- POST /:id/read
- POST /
- PUT /:id
- DELETE /:id
- POST /events
- POST /create
- DELETE /:id
- POST /:id/submit

### Domain: feed
- POST /upload
- POST /
- DELETE /:id
- POST /:id/like
- POST /:id/react
- POST /:id/comments
- DELETE /:id/comments/:commentId

### Domain: file
- POST /upload
- POST /purge-expired
- DELETE /:id

### Domain: finance
- POST /ledger/:id/void
- POST /discount
- POST /snapshots/rebuild
- POST /students/:id/sync-cache

### Domain: invoice
- POST /
- POST /:id/pdf/queue
- POST /:id/email
- DELETE /:id

### Domain: notification
- PUT /mark-read
- DELETE /:id
- POST /

### Domain: payment
- POST /payment-session
- POST /create-session
- POST /sepay

### Domain: report
- POST /
- DELETE /:id
- POST /metrics/reset
- POST /
- DELETE /:id

### Domain: student
- POST /import
- POST /
- PUT /:id
- PUT /:id/exam-progress
- PATCH /:id/price
- PUT /:id/pay
- PUT /:id/refund
- PUT /:id/unlock-exam
- PUT /:id/lock-exam
- POST /:id/enrollments
- PUT /:id/enrollments/:enrollmentId/settings
- PUT /:id/enrollments/:enrollmentId/pay
- DELETE /:id/enrollments/:enrollmentId
- PUT /:id/assign-teacher
- DELETE /:id
- POST /:id/reset-today-attendance
- POST /:id/reset-history
- PUT /:id/pay-teacher

### Domain: teacher
- POST /
- PUT /:id
- DELETE /:id
- POST /:id/pay
- POST /
- PUT /:id
- DELETE /:id
- POST /upload-practical
- POST /
- PUT /:id
- PUT /:id/score
- PUT /:id/approve
- POST /:id/submit-practical
- PUT /:id/reject
- DELETE /:id
- PUT /:id/finance/pay-flexible
- PUT /:id/finance/pay-all

### Domain: transaction
- POST /calculate
- POST /
- PUT /:id/confirm
- PUT /:id/cancel
- DELETE /:id

