# Structured Logging Design
## Format
All logs must output as flat JSON to stdout/stderr. No ad-hoc `console.log` strings allowed in business logic.

```json
{
  "timestamp": "2026-08-06T11:00:00.000Z",
  "level": "info",
  "requestId": "req-1234",
  "correlationId": "corr-5678",
  "tenantId": "t-123",
  "branchId": "b-456",
  "userId": "u-789",
  "module": "student",
  "operation": "CreateStudent",
  "duration": "120ms",
  "status": "success",
  "error": null,
  "metadata": {}
}
```
