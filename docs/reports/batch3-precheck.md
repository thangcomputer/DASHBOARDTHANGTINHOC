# Batch 3 Migration Pre-check: Content & Communication

## Phase 1: Endpoint Analysis

### Module: Blog & CMS (`routes/blogRoutes.js`, `routes/builderRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `GET /manage/posts` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | Low |
| `POST /manage/posts` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | Medium |
| `PUT /manage/posts/:id` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | Medium |
| `DELETE /manage/posts/:id` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | Medium |
| `POST /manage/posts/:id/publish` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | High |
| `POST /manage/posts/:id/hide` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | High |
| `POST /manage/upload` | `checkPermission(MANAGE_BLOG)` | `CMS_PUBLISH` | Tenant, Branch | Medium |
| `GET/POST /builder/*` (builderRoutes) | `isAdmin` | `CMS_PUBLISH` | Tenant, Branch | Medium |
*Note: The `isAdminSide` variable in `blogRoutes.js` is a business rule determining visibility of drafted posts and will be strictly preserved.*

### Module: Notification (`routes/notificationRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `POST /` (Send Global Notification) | `isAdmin` | `NOTIFICATION_BROADCAST` | Tenant, Branch | High |

### Module: Media/File (`routes/fileRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `GET /stats` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant, Branch | Low |
| `GET /` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant, Branch | Low |
| `POST /purge-expired` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant, Branch | High |

### Module: Chat & Feed (`routes/messageRoutes.js`, `routes/feedRoutes.js`)
- These modules primarily use `isAdminLevelAccount` and `isAdminLike` which serve as business logic routing mechanisms rather than standard route guards. No route-level `isAdmin` guards were detected that require migration to `authorize()`. The business logic will remain untouched to preserve mailbox routing rules.

## Security Policies to Validate
1. **Tenant Policy**: Content must be scoped to the active tenant.
2. **Branch Policy**: Some content (e.g., local announcements) may be branch-specific.
3. **Ownership Policy**: Users must only be able to modify their own content (if applicable).
4. **Condition Policy**: Special conditions like "active" status for notifications.
