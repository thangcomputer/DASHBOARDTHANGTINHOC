# Chat & Feed Service Review — Sprint 4.3 Batch 4

## Domains: `chat`, `feed`

### Architecture Before Batch 4
- Handlers emitted `Socket.io` events inline, tightly coupling HTTP and WebSocket transport alongside DB operations.

### Architecture After Batch 4
- `ChatApplicationService.js` and `FeedApplicationService.js` created.
- Business logic (like checking block status or resolving feed recipients) now lives in the Application Service, keeping `messageRoutes.js` and `feedRoutes.js` clean.

### Boundary Compliance
- ✅ Controller correctly extracts the `req.app` instance so the Application Service can use standard Socket events without importing `express`.
- ✅ No leakage of models into routes.
