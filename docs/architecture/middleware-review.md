# Middleware Integration Review
## Pipeline
- `ObservabilityMiddleware` mounts at the top of the `server.js` Express stack.
- Extracts headers like `x-request-id` and injects them into `AsyncLocalStorage`.
- Captures `res.on('finish')` to log metrics and structured HTTP completion logs natively without modifying Controller routes.
