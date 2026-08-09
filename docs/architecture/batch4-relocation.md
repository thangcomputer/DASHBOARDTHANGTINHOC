# Batch 4 Edge Domains Relocation Report

## 1. Overview
Sprint 4.1 Batch 4 concludes the physical Enterprise Domain Modularization sequence. The edge domains (`notification`, `chat`, `cms`, `blog`, `feed`, `ai`, `file`) were structurally relocated into the `modules/` architecture. The legacy root directories (`routes/`, `models/`, `controllers/`) are now functionally extinct, housing zero business logic files.

## 2. Files Moved & Target Domains
A total of **26 files** were relocated into 7 domain modules.
Placeholder folders (`controllers`, `services`, `repositories`, `validators`, `dto`, `events`, `tests`) and an `index.js` file were successfully provisioned for all edge domains.

*Notification*
- `routes/notificationRoutes.js` -> `modules/notification/routes/notificationRoutes.js`
- `models/Notification.js` -> `modules/notification/models/Notification.js`
- `services/NotificationService.js` -> `modules/notification/services/NotificationService.js`
- `services/notificationCenter.js` -> `modules/notification/services/notificationCenter.js`

*Chat*
- `routes/messageRoutes.js` -> `modules/chat/routes/messageRoutes.js`
- `models/Message.js` -> `modules/chat/models/Message.js`
- `models/ConversationVisibility.js` -> `modules/chat/models/ConversationVisibility.js`
- `services/chatAccessService.js` -> `modules/chat/services/chatAccessService.js`
- `services/messaging/` -> `modules/chat/services/messaging/`

*CMS*
- `routes/builderRoutes.js` -> `modules/cms/routes/builderRoutes.js`
- `routes/workflowRoutes.js` -> `modules/cms/routes/workflowRoutes.js`
- `models/FormDefinition.js` -> `modules/cms/models/FormDefinition.js`
- `models/FormSubmission.js` -> `modules/cms/models/FormSubmission.js`
- `models/WorkflowInstance.js` -> `modules/cms/models/WorkflowInstance.js`
- `services/formService.js` -> `modules/cms/services/formService.js`
- `services/workflowService.js` -> `modules/cms/services/workflowService.js`

*Blog & Feed*
- `routes/blogRoutes.js` -> `modules/blog/routes/blogRoutes.js`
- `models/BlogPost.js` -> `modules/blog/models/BlogPost.js`
- `routes/feedRoutes.js` -> `modules/feed/routes/feedRoutes.js`
- `models/FeedPost.js` -> `modules/feed/models/FeedPost.js`

*AI & File*
- `routes/aiRoutes.js` -> `modules/ai/routes/aiRoutes.js`
- `services/aiService.js` -> `modules/ai/services/aiService.js`
- `services/ai/` -> `modules/ai/services/ai/`
- `routes/fileRoutes.js` -> `modules/file/routes/fileRoutes.js`
- `models/FileAsset.js` -> `modules/file/models/FileAsset.js`
- `services/fileService.js` -> `modules/file/services/fileService.js`

## 3. Import Updates
An abstract syntax tree script processed the repository to redirect relative `require()` paths dynamically.
- **Total files modified for imports:** 48 files.

## 4. Cross-Domain Dependencies & Technical Debt
As detailed in `edge-domain-review.md` and `shared-kernel-review.md`:
- `Notification` and `Chat` remain tightly coupled to `Student`, `Teacher`, and `Auth` via synchronous logic.
- The `services/queue/` directory handles legacy BullMQ jobs (OTP/Welcome emails) and currently sits as a monolithic `LEGACY_SHARED` component outside any domain.
- Transitioning to an Event Bus (Sprint 4.2) is the mandated remediation path.

## 5. Regression Results
- **Linting (`npm run lint`)**: Passed. 0 errors or gãy liên kết nội bộ.
- **Integration Tests (`npm test`)**: 101 tests executed. 99 Passed, 2 Skipped, 0 Failed.
- **Validation**: All Webhooks, WebSocket initializations (Chat), and internal CMS builders successfully bound to their respective HTTP endpoints without route mismatches.

## 6. Rollback Plan
If any unforeseen edge-case failure occurs in production (e.g., a dynamic file path injection failing to find a media asset), a standard `git revert` of the Batch 4 relocation commit will safely resurrect the legacy file structure without affecting database schemas.
