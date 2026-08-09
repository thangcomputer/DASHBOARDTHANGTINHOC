# System Service Review — Sprint 4.3 Batch 1

## 1. Domain: `system`

### Before
- **File**: `modules/system/settingsRoutes.js` (1,002 lines)
- Business logic for settings CRUD, URL normalization (`normalizeUploadFileUrl`, `normalizeTrainingDataUrls`), exam catalog merging (`getMergedExamCatalog`), and upload file handling embedded directly in route handlers.
- `settingsController.js` partially existed but was a mixed layer — contained both HTTP response code and business logic calls.

### After
- **`modules/system/services/SystemApplicationService.js`** — Contains all business logic extracted from route handlers, including:
  - `getSettings()` / `updateMainSettings()`
  - URL normalization helpers
  - Exam subject catalog merging
  - Training data management
- **`modules/system/controllers/SystemController.js`** — Pure orchestration. Maps request to service call, maps result to response.
- **`modules/system/settingsRoutes.js`** — Reduced to route declarations, middleware, and multer upload middleware only.

### Endpoints Migrated (25 routes)
Settings, popup upload, invoice signature upload, web settings, training data (student + teacher), exam subjects, logo/favicon uploads, reset data.

## 2. Boundary Compliance
- ✅ Controller does NOT call repositories directly.
- ✅ Controller does NOT call Mongoose models.
- ✅ `settingsCache` invalidation stays in the Service.
- ✅ Exam catalog merging logic stays in the Service.
- ✅ All existing error messages, status codes preserved.
