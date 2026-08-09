# Batch 4 Edge Domains Relocation Precheck

## 1. Overview
Sprint 4.1 Batch 4 is the final structural relocation batch. It targets the edge domains, content management systems, communication layers, and external integrations (`notification`, `chat`, `cms`, `blog`, `feed`, `ai`, `file`). Upon completion of this batch, the legacy `routes/`, `models/`, and `services/` root directories will essentially be emptied of operational business logic, achieving 100% modularization.

## 2. File Verification & Target Mapping

### Domain: `notification`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/notificationRoutes.js` | `modules/notification/routes/notificationRoutes.js`| Route | `Notification`, `NotificationService` |
| `models/Notification.js` | `modules/notification/models/Notification.js` | Model | `mongoose` |
| `services/NotificationService.js`| `modules/notification/services/NotificationService.js`| Service | `Notification` |
| `services/notificationCenter.js` | `modules/notification/services/notificationCenter.js` | Service | `Notification` |

### Domain: `chat`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/messageRoutes.js` | `modules/chat/routes/messageRoutes.js` | Route | `Message`, `ConversationVisibility`, `chatAccessService` |
| `models/Message.js` | `modules/chat/models/Message.js` | Model | `mongoose` |
| `models/ConversationVisibility.js`| `modules/chat/models/ConversationVisibility.js`| Model | `mongoose` |
| `services/chatAccessService.js`| `modules/chat/services/chatAccessService.js`| Service | `ConversationVisibility`, `Message`, `Student`, `Teacher` |
| `services/messaging/` (Dir) | `modules/chat/services/messaging/` | Service | `mongoose`, `Message` |

### Domain: `cms`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/builderRoutes.js` | `modules/cms/routes/builderRoutes.js` | Route | `FormDefinition`, `formService` |
| `routes/workflowRoutes.js` | `modules/cms/routes/workflowRoutes.js` | Route | `WorkflowInstance`, `workflowService` |
| `models/FormDefinition.js` | `modules/cms/models/FormDefinition.js` | Model | `mongoose` |
| `models/FormSubmission.js` | `modules/cms/models/FormSubmission.js` | Model | `mongoose` |
| `models/WorkflowInstance.js` | `modules/cms/models/WorkflowInstance.js` | Model | `mongoose` |
| `services/formService.js` | `modules/cms/services/formService.js` | Service | `FormDefinition`, `FormSubmission` |
| `services/workflowService.js`| `modules/cms/services/workflowService.js`| Service | `WorkflowInstance` |

### Domain: `blog`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/blogRoutes.js` | `modules/blog/routes/blogRoutes.js` | Route | `BlogPost` |
| `models/BlogPost.js` | `modules/blog/models/BlogPost.js` | Model | `mongoose` |

### Domain: `feed`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/feedRoutes.js` | `modules/feed/routes/feedRoutes.js` | Route | `FeedPost` |
| `models/FeedPost.js` | `modules/feed/models/FeedPost.js` | Model | `mongoose` |

### Domain: `ai`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/aiRoutes.js` | `modules/ai/routes/aiRoutes.js` | Route | `aiService` |
| `services/aiService.js` | `modules/ai/services/aiService.js` | Service | `ai/` integrations |
| `services/ai/` (Dir) | `modules/ai/services/ai/` | Service | OpenAI, Anthropic, Gemini libraries |

### Domain: `file` (Media/Upload)
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/fileRoutes.js` | `modules/file/routes/fileRoutes.js` | Route | `FileAsset`, `fileService` |
| `models/FileAsset.js` | `modules/file/models/FileAsset.js` | Model | `mongoose` |
| `services/fileService.js` | `modules/file/services/fileService.js`| Service | `FileAsset`, S3 SDK |

### Unmapped Core/Legacy Utilities
The following components remain in `services/` and will be analyzed in Phase 3 (Shared Kernel Review), but will NOT be moved in this structural batch:
- `services/accountWelcome.js`
- `services/queue/` (Queue configurations & BullMQ processors)

## 3. Placeholder Directory Structure
For every domain (`notification`, `chat`, `cms`, `blog`, `media`, `banner`, `feed`, `announcement`, `ai`, `upload`, `file`), the standard layout will be enforced:
- `controllers/`, `services/`, `repositories/`, `routes/`, `models/`, `validators/`, `dto/`, `events/`, `tests/`
- `index.js`

Domains like `banner` or `announcement` that currently have no dedicated legacy files will just be provisioned as empty placeholder structures for future Sprint 4.2+ development.

## 4. Execution Readiness
The dependencies are fully mapped. Phase 2 (Safe Relocation) is cleared to execute using the abstract syntax tree string replacement script to secure paths.
