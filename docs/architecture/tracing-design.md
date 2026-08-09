# OpenTelemetry Tracing Design
## Concept
Every request context must propagate the following natively:
- `RequestId`: Originating from HTTP header or auto-generated.
- `CorrelationId`: Ties together distributed async steps (e.g., HTTP -> Command -> Event -> Background Job).
- `TraceId` & `SpanId`: OTel specific hierarchy identifiers.
- `TenantId` & `BranchId`: Multi-tenancy isolation markers.
- `UserId` & `SessionId`: User tracking.
- `CommandId` / `QueryId` / `EventId`: Action-specific identifiers.
