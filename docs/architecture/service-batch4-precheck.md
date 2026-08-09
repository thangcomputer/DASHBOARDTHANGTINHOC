# Service Precheck — Sprint 4.3 Batch 4

## Scope
Batch 4 handles the remaining auxiliary and utility domains:
- **CMS**: `builderRoutes.js`, `workflowRoutes.js`
- **Blog**: `blogRoutes.js`
- **Chat**: `messageRoutes.js`
- **Feed**: `feedRoutes.js`
- **AI**: `aiRoutes.js`
- **File/Upload/Media**: `fileRoutes.js`
- **Support**: `support.routes.js`

*(Note: Banner, Media, and Search domains do not have dedicated routing files that are active. Their logic is likely embedded in existing CMS or File controllers/services, or they were purely backend modules. They will be skipped per instructions).*

## Complexity Assessment
These domains heavily interact with file uploads (`multer`), real-time features (`Socket.io` emitting), or external API integrations (AI). The migration script must ensure that middleware dependencies (like `multer` upload handlers) stay inside the Express Route, while the actual processing/persistence is pushed into the `ApplicationService`.

## Validation Strategy
- The automated extraction tool handles `multer` properly by keeping it in the route definition.
- `req.file` and `req.files` will be correctly forwarded to the `data` payload for the services to consume.
- Continue to rely on existing test coverage.
