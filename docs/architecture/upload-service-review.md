# Upload & Media Service Review — Sprint 4.3 Batch 4

## Domains: `file`, `media`, `upload`

### Architecture Before Batch 4
- File uploading logic in `fileRoutes.js` tightly coupled to middleware streams.
- Missing explicit Search and Media folders (likely consolidated into File).

### Architecture After Batch 4
- The script preserves `multer` middleware in the router (since stream processing is an HTTP concern) and passes the validated `req.file` / `req.files` object into the `FileApplicationService`.
- `FileApplicationService` handles the storage accounting and logical referencing.

### Boundary Compliance
- ✅ Stream management remains in HTTP layer (via `multer`).
- ✅ File persistence checks and path normalization moved to Service layer.
