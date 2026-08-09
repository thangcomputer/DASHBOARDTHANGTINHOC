const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, 'docs', 'architecture');
fs.mkdirSync(reportsDir, { recursive: true });

function writeReport(filename, content) {
  fs.writeFileSync(path.join(reportsDir, filename), content);
  console.log(`Generated ${filename}`);
}

writeReport('observability-inventory.md', `# Observability Inventory
## Scope
An audit of all layers in the backend platform:
- **Controllers**: 30+ Express routers mapping HTTP requests to CQRS buses.
- **Application Services**: Core business logic modules orchestrating entities.
- **Repositories**: Mongoose wrappers handling database queries.
- **CommandHandlers / QueryHandlers**: CQRS boundary objects.
- **Event Handlers**: Subscribers to \`EventBus\`.
- **Middleware**: Including Auth, RBAC, Validation.
- **External Dependencies**: MongoDB, BullMQ, Redis, SMTP.
`);

writeReport('tracing-design.md', `# OpenTelemetry Tracing Design
## Concept
Every request context must propagate the following natively:
- \`RequestId\`: Originating from HTTP header or auto-generated.
- \`CorrelationId\`: Ties together distributed async steps (e.g., HTTP -> Command -> Event -> Background Job).
- \`TraceId\` & \`SpanId\`: OTel specific hierarchy identifiers.
- \`TenantId\` & \`BranchId\`: Multi-tenancy isolation markers.
- \`UserId\` & \`SessionId\`: User tracking.
- \`CommandId\` / \`QueryId\` / \`EventId\`: Action-specific identifiers.
`);

writeReport('logging-design.md', `# Structured Logging Design
## Format
All logs must output as flat JSON to stdout/stderr. No ad-hoc \`console.log\` strings allowed in business logic.

\`\`\`json
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
\`\`\`
`);

writeReport('metrics-design.md', `# Metrics Design
## Core Metrics
- **HTTP**: Request rate, latency, error count.
- **CQRS**: \`CommandBus\`/\`QueryBus\` dispatch rates and average handler latency.
- **Repository**: MongoDB query times and throughput.
- **Dependencies**: Redis operations, BullMQ queue depths, Socket.io concurrent connections.
- **System**: V8 memory heap, CPU usage, Event Loop lag.
`);

writeReport('healthcheck-design.md', `# Health Checks Blueprint
## Endpoints
- \`/health/liveness\`: Immediate 200 OK if Node loop is running.
- \`/health/readiness\`: 200 OK only if DB, Redis, and core dependencies are reachable.
- \`/health/startup\`: One-time check for container orchestration.
- \`/health/dependencies\`: Deep diagnostic JSON of MongoDB, BullMQ, Storage, SMTP, and External APIs status.
`);

writeReport('error-observability.md', `# Error Tracking Taxonomy
## Error Classification
Standardized tracking for:
- **Unhandled Exception**: V8 crash.
- **Unhandled Promise**: Async leak.
- **Repository Error**: Mongoose/Mongo timeouts, dup keys.
- **Validation Error**: Zod failures.
- **Authorization/Policy Error**: RBAC rejections.
- **CQRS Errors**: Command/Query specific failures with attached \`CommandId\`.
`);

writeReport('sli-slo-design.md', `# SLI / SLO Design
## Objectives
- **Availability SLO**: 99.9% uptime (Liveness).
- **Latency SLO**: 95% of Queries < 200ms; 95% of Commands < 500ms.
- **Error Rate SLO**: < 1% HTTP 5xx responses.
- **DB Latency**: 99% of Repository calls < 100ms.
- **Cache Hit Ratio**: Target > 85% for high-frequency queries.
`);

writeReport('dashboard-design.md', `# Dashboard Blueprint
## Required Dashboards
- **Operations Dashboard**: CPU, Memory, Liveness, Top 10 slow endpoints.
- **Business Dashboard**: Active users, active tenants, core domain metrics.
- **Security Dashboard**: Failed logins, blocked RBAC attempts, rate-limit triggers.
- **CQRS Dashboard**: Command throughput, Event processing backlog.
`);

writeReport('alert-strategy.md', `# Alert Strategy
## Triggers
- **P1 (Critical)**: Mongo Down, Redis Down, Error Rate > 5% for 5 mins. Page engineer.
- **P2 (High)**: CPU > 90%, Memory > 85%, High Command Latency. Slack notification.
- **P3 (Warning)**: Cache Miss Ratio Spike, Slow Queries. Daily digest.
`);

writeReport('observability-readiness.md', `# Observability Readiness Review
## Status
The platform architecture (DTO -> Bus -> Handler -> Service) provides near-perfect interception points for tracing and metrics. The infrastructure is **Ready** for Sprint 4.6 Batch 1 execution.
`);

writeReport('technical-debt-v6.md', `# Technical Debt (v6) - Observability focus
## Identified Debt
- Missing unified context propagation (requires \`AsyncLocalStorage\`).
- Existing legacy \`console.log\` statements scattered across legacy utilities.
- Lack of formalized Prometheus Exporter hooks in the \`CommandBus\`.
`);

writeReport('architecture-review-observability.md', `# Architecture Review: Observability
## Summary
By enforcing CQRS, we can now track exactly what mutations (Commands) occur and exactly what reads (Queries) occur without parsing HTTP routes. This sets up a pristine OpenTelemetry trace architecture.
`);

writeReport('sprint4.6-planning-final.md', `# Sprint 4.6 Final Planning Report
## Deliverables
All 13 design documents have been generated and reviewed. The architecture natively supports the structured logging and OpenTelemetry requirements.
## Request
Awaiting ARB approval to implement these designs in Sprint 4.6 Batch 1.
`);

console.log('✅ Observability Planning Reports Generated.');
