# Edge Domain Review (Batch 4)

## 1. Overview
Sprint 4.1 Batch 4 structurally relocated edge and communication domains (`notification`, `chat`, `cms`, `blog`, `feed`, `ai`, `file`). This document analyzes cross-domain dependencies created by this relocation to inform future structural decoupling in Sprint 4.2.

## 2. Cross-Domain Dependency Analysis

### 2.1 Notification ↔ Student / Teacher
- **Dependency Type**: Shared Orchestration.
- **Locations**: `modules/notification/services/NotificationService.js` natively orchestrates messaging for `Student` and `Teacher` identities.
- **Remediation Target**: Implement a Pub/Sub Event Bus. Domains like `exam` or `finance` should publish events (e.g., `InvoiceOverdue`, `ExamGraded`), and the `Notification` domain subscribes to these events to dispatch the physical messages, rather than synchronous API invocations linking them directly.

### 2.2 Chat ↔ Auth / Tenant
- **Dependency Type**: Tight Access Control Coupling.
- **Locations**: `modules/chat/services/chatAccessService.js` actively verifies `Employee` (Auth) and `Tenant` contexts to authorize WebSockets and conversation access.
- **Remediation Target**: The `chatAccessService` is currently doing too much Identity evaluation. Future refactoring should pass a standardized Identity context (via DTOs or JWT payload) into the Chat service rather than having Chat query Auth tables directly.

### 2.3 CMS ↔ Media (File)
- **Dependency Type**: Embedded Mongoose References.
- **Locations**: `modules/cms/models/BlogPost.js` and `modules/cms/models/FeedPost.js` rely directly on ObjectId references to `FileAsset` within the `file` domain.
- **Remediation Target**: This is an acceptable level of coupling (Foreign Keys) provided that population is handled safely across modules, but ideally, `CMS` should fetch media data via a `FileService` interface rather than executing `populate('mediaId')` directly against Mongoose.

### 2.4 AI ↔ Student / Course
- **Dependency Type**: Knowledge Graph Extraction.
- **Locations**: `modules/ai/routes/aiRoutes.js` queries `Course` metadata to provide context to LLM models.
- **Remediation Target**: Establish explicit Service contracts (e.g., `CourseService.getSyllabus(courseId)`). AI should not run raw MongoDB aggregations against other domains.

## 3. Conclusion
The edge domains suffer from less "fatal" coupling than the transactional core, but they represent a web of synchronous API calls that degrade system resilience. Transitioning `Notification` and `Chat` to entirely event-driven paradigms will be the primary objective of Sprint 4.2.
