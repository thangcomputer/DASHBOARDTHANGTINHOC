# Native Tracing Review
## Mechanics
- `Tracer.js` leverages `RequestContext` to automatically spin off child `spanId`s while preserving the parent `traceId` and `correlationId`.
- Execution bounds for Commands and Queries are automatically intercepted in the `CommandBus` and `QueryBus` constructors.
