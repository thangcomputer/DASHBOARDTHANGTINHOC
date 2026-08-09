# Structured Logger Review
## Capabilities
- Output format: Flat JSON.
- Auto-injected context: `requestId`, `correlationId`, `traceId`, `tenantId`, `userId`.
- Replaced naive `console.log` across CQRS hooks with structured output.
- Business Logic remains untouched.
