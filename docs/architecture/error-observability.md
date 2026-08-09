# Error Tracking Taxonomy
## Error Classification
Standardized tracking for:
- **Unhandled Exception**: V8 crash.
- **Unhandled Promise**: Async leak.
- **Repository Error**: Mongoose/Mongo timeouts, dup keys.
- **Validation Error**: Zod failures.
- **Authorization/Policy Error**: RBAC rejections.
- **CQRS Errors**: Command/Query specific failures with attached `CommandId`.
