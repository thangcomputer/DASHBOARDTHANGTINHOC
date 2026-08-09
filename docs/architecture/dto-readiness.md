# DTO Readiness

## Overview
Analysis of payloads and validation duplication.

### Domain: ai
- Request DTO candidate: `req.body` payload for POST /quiz
- Request DTO candidate: `req.body` payload for POST /notification-draft
- Request DTO candidate: `req.body` payload for POST /summarize
- Request DTO candidate: `req.body` payload for POST /complete

### Domain: analytics

### Domain: attendance
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:scheduleId
- Request DTO candidate: `req.body` payload for DELETE /:scheduleId
- Request DTO candidate: `req.body` payload for PATCH /:scheduleId/cancel

### Domain: blog
- Request DTO candidate: `req.body` payload for POST /manage/posts
- Request DTO candidate: `req.body` payload for PUT /manage/posts/:id
- Request DTO candidate: `req.body` payload for POST /manage/posts/:id/publish
- Request DTO candidate: `req.body` payload for POST /manage/posts/:id/hide
- Request DTO candidate: `req.body` payload for DELETE /manage/posts/:id
- Request DTO candidate: `req.body` payload for POST /manage/upload

### Domain: chat
- Request DTO candidate: `req.body` payload for POST /upload
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for POST /hide/:conversationId
- Request DTO candidate: `req.body` payload for PUT /read/:conversationId
- Request DTO candidate: `req.body` payload for PATCH /:messageId/reaction
- Request DTO candidate: `req.body` payload for PATCH /:messageId/recall
- Request DTO candidate: `req.body` payload for PATCH /:messageId/soft-delete
- Request DTO candidate: `req.body` payload for POST /groups
- Request DTO candidate: `req.body` payload for DELETE /groups/:groupId
- Request DTO candidate: `req.body` payload for POST /broadcast

### Domain: cms
- Request DTO candidate: `req.body` payload for POST /forms
- Request DTO candidate: `req.body` payload for PUT /forms/:id
- Request DTO candidate: `req.body` payload for DELETE /forms/:id
- Request DTO candidate: `req.body` payload for POST /forms/:idOrSlug/submit
- Request DTO candidate: `req.body` payload for POST /forms/:idOrSlug/submit-auth
- Request DTO candidate: `req.body` payload for POST /reports
- Request DTO candidate: `req.body` payload for PUT /reports/:id
- Request DTO candidate: `req.body` payload for DELETE /reports/:id
- Request DTO candidate: `req.body` payload for POST /sync
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for POST /:id/advance

### Domain: course
- Request DTO candidate: `req.body` payload for POST /upload
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/submit
- Request DTO candidate: `req.body` payload for PUT /submissions/:submissionId/grade
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for PATCH /:id/price
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/restore
- Request DTO candidate: `req.body` payload for POST /seed
- Request DTO candidate: `req.body` payload for POST /complete-lesson
- Request DTO candidate: `req.body` payload for POST /save-watch-progress

### Domain: exam
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for POST /:id/read
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /events
- Request DTO candidate: `req.body` payload for POST /create
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/submit

### Domain: feed
- Request DTO candidate: `req.body` payload for POST /upload
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/like
- Request DTO candidate: `req.body` payload for POST /:id/react
- Request DTO candidate: `req.body` payload for POST /:id/comments
- Request DTO candidate: `req.body` payload for DELETE /:id/comments/:commentId

### Domain: file
- Request DTO candidate: `req.body` payload for POST /upload
- Request DTO candidate: `req.body` payload for POST /purge-expired
- Request DTO candidate: `req.body` payload for DELETE /:id

### Domain: finance
- Request DTO candidate: `req.body` payload for POST /ledger/:id/void
- Request DTO candidate: `req.body` payload for POST /discount
- Request DTO candidate: `req.body` payload for POST /snapshots/rebuild
- Request DTO candidate: `req.body` payload for POST /students/:id/sync-cache

### Domain: invoice
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for POST /:id/pdf/queue
- Request DTO candidate: `req.body` payload for POST /:id/email
- Request DTO candidate: `req.body` payload for DELETE /:id

### Domain: notification
- Request DTO candidate: `req.body` payload for PUT /mark-read
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /

### Domain: payment
- Request DTO candidate: `req.body` payload for POST /payment-session
- Request DTO candidate: `req.body` payload for POST /create-session
- Request DTO candidate: `req.body` payload for POST /sepay

### Domain: report
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /metrics/reset
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for DELETE /:id

### Domain: student
- Request DTO candidate: `req.body` payload for POST /import
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for PUT /:id/exam-progress
- Request DTO candidate: `req.body` payload for PATCH /:id/price
- Request DTO candidate: `req.body` payload for PUT /:id/pay
- Request DTO candidate: `req.body` payload for PUT /:id/refund
- Request DTO candidate: `req.body` payload for PUT /:id/unlock-exam
- Request DTO candidate: `req.body` payload for PUT /:id/lock-exam
- Request DTO candidate: `req.body` payload for POST /:id/enrollments
- Request DTO candidate: `req.body` payload for PUT /:id/enrollments/:enrollmentId/settings
- Request DTO candidate: `req.body` payload for PUT /:id/enrollments/:enrollmentId/pay
- Request DTO candidate: `req.body` payload for DELETE /:id/enrollments/:enrollmentId
- Request DTO candidate: `req.body` payload for PUT /:id/assign-teacher
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/reset-today-attendance
- Request DTO candidate: `req.body` payload for POST /:id/reset-history
- Request DTO candidate: `req.body` payload for PUT /:id/pay-teacher

### Domain: teacher
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /:id/pay
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for POST /upload-practical
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id
- Request DTO candidate: `req.body` payload for PUT /:id/score
- Request DTO candidate: `req.body` payload for PUT /:id/approve
- Request DTO candidate: `req.body` payload for POST /:id/submit-practical
- Request DTO candidate: `req.body` payload for PUT /:id/reject
- Request DTO candidate: `req.body` payload for DELETE /:id
- Request DTO candidate: `req.body` payload for PUT /:id/finance/pay-flexible
- Request DTO candidate: `req.body` payload for PUT /:id/finance/pay-all

### Domain: transaction
- Request DTO candidate: `req.body` payload for POST /calculate
- Request DTO candidate: `req.body` payload for POST /
- Request DTO candidate: `req.body` payload for PUT /:id/confirm
- Request DTO candidate: `req.body` payload for PUT /:id/cancel
- Request DTO candidate: `req.body` payload for DELETE /:id

