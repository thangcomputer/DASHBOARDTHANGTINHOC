# Error Tracking Review
## Centralization
- `globalErrorHandler` captures all Express unhandled errors.
- CQRS buses inject `isCommandError` or `isQueryError` flags natively.
- `ErrorTracker.js` maps Mongoose, Zod, and App errors to standardized categories (Validation, Authorization, Repository) before logging.
