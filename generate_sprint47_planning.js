const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'architecture');
fs.mkdirSync(docsDir, { recursive: true });

function writeReport(filename, content) {
  fs.writeFileSync(path.join(docsDir, filename), content);
  console.log(`Generated ${filename}`);
}

writeReport('transaction-inventory.md', `# Transaction Boundary Analysis
## Core Business Transactions
1. **Student Registration**: Creates User, Student, and Enrollment records.
2. **Invoice Creation**: Generates Invoice, logs audit, and updates Tuition balances.
3. **Payment Confirmation**: Updates Invoice status, triggers Revenue calculation, sets Course access.
4. **Refund Processing**: Adjusts Revenue, voids Invoice, deactivates Enrollment.
5. **Grade Submission**: Updates Submission score, creates GradeHistory, updates ExamResult.
6. **Certificate Issuing**: Validates completion, creates Certificate, triggers notification.
`);

writeReport('reliability-analysis.md', `# Reliability Analysis
## Operations requiring strict guarantees
- **Atomic**: Payment Confirmations, Refund Processing (must succeed or fail as a unit).
- **Retryable**: External webhook deliveries (SePay), Email/Zalo notifications, BullMQ queue jobs.
- **Idempotent**: Payment webhooks (to prevent double-crediting), Registration (to prevent duplicate accounts on network timeout).
`);

writeReport('transaction-readiness.md', `# Mongo Transaction Readiness
## Repository Review
- **Single-document**: \`UserRepository.updateProfile\`, \`ClassRepository.addStudent\`.
- **Multi-document (Requires Native Mongo Transactions)**: 
  - \`PaymentRepository.confirm\` (Updates Invoice, Updates Tuition, Updates Student Status).
  - \`EnrollmentRepository.register\` (Creates Student, Creates Enrollment).
- **Eventual Consistency**: Push Notifications, Activity Audit Logging (safe to emit via EventBus post-commit).
`);

writeReport('idempotency-design.md', `# Global Idempotency Design
## Architecture
- **Idempotency-Key Header**: Clients must provide \`Idempotency-Key\` on mutations.
- **Duplicate Request Detection**: Intercepted in middleware using Redis (\`SETNX\` with TTL).
- **Replay Protection**: Reject requests with keys older than 24h.
- **Safe Retry**: If Redis holds a resolved payload for a key, return it immediately without invoking CQRS logic.
`);

writeReport('outbox-design.md', `# Native Outbox Pattern Design
## Architecture
- **Outbox Collection**: Mongoose schema storing \`{ eventType, payload, status (PENDING|PROCESSED|FAILED), retryCount }\`.
- **Publisher**: Business logic writes to Outbox in the *same* Mongo transaction as the domain mutation.
- **Retry Worker**: BullMQ job polling \`PENDING\` records every 5s, publishing to EventBus.
- **Failure Recovery & DLQ**: After 5 retries, status becomes \`FAILED\` (Dead Letter Queue) requiring manual intervention.
- **Ordering**: Processed sequentially by \`createdAt\` per \`aggregateId\`.
`);

writeReport('inbox-design.md', `# Inbox Pattern Design
## Architecture
- **Inbox Collection**: Tracks processed incoming events \`{ eventId, handlerName, processedAt }\`.
- **Duplicate Detection**: Unique index on \`(eventId, handlerName)\`. 
- **Exactly-once Simulation**: If an event triggers a Domain Error or Unhandled Exception, it won't be written to Inbox. Handlers must be idempotent if partially executed.
- **Consumer Replay**: Safe because Inbox prevents double-processing.
`);

writeReport('saga-readiness.md', `# Saga Readiness
## Workflow Identification
1. **Student Registration Saga**: 
   - Step 1: Create User (Compensate: Delete User).
   - Step 2: Create Enrollment (Compensate: Delete Enrollment).
   - Step 3: Send Welcome Email (No compensation needed).
2. **Payment Processing Saga**:
   - Step 1: Mark Invoice Paid.
   - Step 2: Update Student Balance.
   - Step 3: Trigger Course Access.
   - *Rollback Strategy*: Reverse balance, revert invoice status, revoke access.
`);

writeReport('retry-strategy.md', `# Retry Strategy
## Policies
- **Linear Retry**: For DB lock timeouts (e.g., 3 retries at 100ms intervals).
- **Exponential Backoff**: For external API integrations (Zalo, Email, Payment Gateway). 
  - Ex: 1s, 2s, 4s, 8s, 16s.
- **Circuit Breaker**: For 3rd-party dependencies. If >50% errors in 10s, trip breaker for 30s.
- **Max Retries**: Default 5.
- **Dead Letter Queue (DLQ)**: Hard failures logged to \`FailedJobs\` collection.
`);

writeReport('failure-analysis.md', `# Failure Mode Analysis
## Scenarios
1. **Mongo Timeout**: Commands must wrap in native transactions. Return 503.
2. **Redis Unavailable**: Degrade gracefully (skip cache), but halt rate-limiting/idempotency checks.
3. **Partial Update**: Prevented by Mongo Native Transactions and Outbox.
4. **Event Publish Failure**: Prevented by Outbox.
5. **Worker Crash**: BullMQ will re-deliver the job after visibility timeout.
6. **Network Partition**: System runs in degraded mode.
`);

writeReport('technical-debt-v7.md', `# Technical Debt Review v7 (Reliability)
## Remaining Debt
- External webhooks currently lack robust retry mechanisms if the 3rd party is down.
- Mongoose Operations currently do not utilize \`.session()\` uniformly across the codebase.
- No native Dead Letter Queue UI for operators to replay failed events.
`);

writeReport('architecture-review-reliability.md', `# Architecture Review: Reliability
## Executive Summary
- **Transaction Strategy**: Native MongoDB multi-document transactions using Mongoose sessions.
- **Outbox/Inbox Strategy**: Polling-based MongoDB outbox via BullMQ to guarantee At-Least-Once delivery.
- **Saga Readiness**: Workflows are well-defined but require a Saga Orchestrator abstraction.
- **Retry Policy**: Exponential backoff integrated natively into BullMQ processors.
- **Idempotency**: Redis-backed middleware for mutation endpoints.
- **Consistency Model**: Eventual Consistency strictly enforced between aggregates.
`);

writeReport('sprint4.7-planning-final.md', `# Sprint 4.7 Planning Final Summary
All reliability and transaction planning documents have been successfully generated. The monolith's business logic, controllers, repositories, and CQRS handlers remain completely untouched. The architecture is ready for Sprint 4.7 Batch 1 (Transaction Infrastructure Implementation).`);

console.log('✅ Sprint 4.7 Planning Reports Generated.');
