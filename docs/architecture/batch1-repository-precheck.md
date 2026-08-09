# Batch 1 Repository Precheck

## 1. Overview
This document serves as the pre-flight verification for Sprint 4.2 Batch 1 (Foundation & Simple Domains). The domains targeted for Repository Pattern migration are: `auth`, `tenant`, `branch`, `system` (settings), `notification`, and `media` (file).

## 2. Repository Inventory (Batch 1 Scope)

### `Auth` (Model: `Employee`)
- **Files to Modify**: 
  - `modules/auth/authRoutes.js`
  - `modules/teacher/routes/employeeRoutes.js`
  - `modules/system/settingsRoutes.js`
- **Expected Import Changes**: Replace `require('../auth/models/Employee')` with `AuthRepository`.

### `Tenant` (Model: `Tenant`)
- **Files to Modify**: 
  - `modules/tenant/tenantService.js`
- **Expected Import Changes**: Replace direct Mongoose queries with `TenantRepository`.

### `Branch` (Model: `Branch`)
- **Files to Modify**: 
  - `modules/branch/branchController.js`
  - `modules/analytics/routes/analyticsRoutes.js`
  - `modules/finance/services/biService.js`
  - `modules/student/routes/studentRoutes.js`
  - `modules/teacher/routes/staffRoutes.js`
  - `modules/tenant/tenantRoutes.js`
  - `modules/tenant/tenantService.js`
- **Expected Import Changes**: Replace direct `Branch.find()` with `BranchRepository.findActiveBranches()`.

### `System` (Model: `SystemSettings`)
- **Files to Modify**:
  - `modules/system/settingsController.js`
  - `modules/system/settingsCache.js`
  - `modules/system/settingsRoutes.js`
  - `modules/auth/authRoutes.js`
  - `modules/chat/routes/messageRoutes.js`
  - `modules/course/routes/trainingRoutes.js`
- **Expected Import Changes**: Replace `SystemSettings.findOne()` with `SystemRepository.getSettings()`.

### `Notification` (Model: `Notification`)
- **Files to Modify**:
  - `modules/notification/services/NotificationService.js`
  - `modules/notification/services/notificationCenter.js`
  - `modules/auth/authRoutes.js`
  - `modules/blog/routes/blogRoutes.js`
  - `modules/course/routes/assignmentRoutes.js`
  - `modules/system/settingsRoutes.js`
- **Expected Import Changes**: Centralize `Notification.create()` to `NotificationRepository.save()`.

### `Media/File` (Model: `FileAsset`)
- **Files to Modify**:
  - `modules/file/services/fileService.js`
- **Expected Import Changes**: Encapsulate file metadata persistence into `FileRepository`.

## 3. Risk Assessment & Dependency Impact
- **Cross-Domain Ripple**: The `Branch` model is used heavily in `analytics`, `student`, and `finance`. Migrating `Branch` to a Repository means we must rewrite Mongoose queries in those other domains *right now* to keep the codebase compiling.
- **Fluent API Risk**: Some routes (e.g., `studentRoutes.js`) might be doing `Branch.findById().lean()`. We must ensure the `BranchRepository.findById()` method returns standard objects to satisfy these consumers.
- **Service Encapsulation**: Controllers (like `authRoutes.js`) are currently calling models from `system` and `notification`. According to ARB rules: "Controllers must never import mongoose models. Services must depend ONLY on repositories." Therefore, `authRoutes.js` must be refactored to call `SystemService.getSettings()` instead of `SystemRepository.getSettings()` directly (or perhaps call the Repository if it acts as the data layer, but ARB says "Controller -> Service -> Repository"). Since some modules lack a Service layer, we may need to introduce one or allow Controller -> Repository directly for simple CRUD. *Correction*: ARB says "Controllers continue calling services." If there is no service, I will either create one or map directly in simple cases, but will strive for Controller -> Service -> Repository.

## 4. Execution Plan
We will implement one domain at a time in this exact order:
1. `file` (Media)
2. `tenant`
3. `system` (Settings)
4. `notification`
5. `branch`
6. `auth`

After each domain, `npm run lint` and `npm test` will be executed.
