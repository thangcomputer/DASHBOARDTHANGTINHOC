# Shared Kernel Review

## 1. Overview
As part of Sprint 4.1 Batch 4, the edge domains were successfully relocated. The remaining files in the monolithic root directories now strictly belong to the "Shared Kernel". This document catalogs these shared utilities and classifies them according to Domain-Driven Design principles, dictating their future treatment in Sprint 4.2.

## 2. Shared Kernel Classification

### 2.1 Core Shared (`CORE_SHARED`)
Components that provide essential application infrastructure and do not contain business logic.
- `shared/logger/` (e.g., `auditLogger.js`)
- `shared/metrics/` (e.g., `metricsCollector.js`)
- `shared/middleware/` (e.g., `authMiddleware.js`, `authenticate.js`, `authorize.js`, `requestMetrics.js`, `systemLogger.js`)
- `config/` (Database, Redis, and global configurations)
- `bootstrap/` (Initialization scripts)

*Directive*: These remain globally accessible and will not be moved into specific business domains.

### 2.2 Domain Shared (`DOMAIN_SHARED`)
Components that facilitate cross-domain orchestration but belong fundamentally to one domain's context.
- `services/accountWelcome.js`: Orchestrates Zalo/Email welcome messages during Auth/Student onboarding.
  *Directive*: Relocate to `modules/notification/services/` or establish as a Domain Event listener within `modules/student/`.

### 2.3 Legacy Shared (`LEGACY_SHARED`)
Components bridging the gap between monolithic synchronous calls and the future asynchronous event bus.
- `services/queue/` (BullMQ workers for background jobs like OTP and Email).
  *Directive*: This entire queueing infrastructure must be upgraded into the `events/` architectural layer (Event Bus implementation) during Sprint 4.2.

### 2.4 Candidate for Removal (`CANDIDATE_FOR_REMOVAL`)
Any utility that was circumvented by the Enterprise RBAC migration or is no longer consumed by any domain.
- Currently, no files fit this description as Sprint 3.8 surgically removed all legacy authorization utilities.

## 3. Summary
The root directories (`routes/`, `models/`, `controllers/`) are now functionally extinct. The `services/` directory only contains infrastructure orchestration (`accountWelcome` and `queue`) which will be addressed when implementing the Event Bus. The platform is ready for physical microservice detachment.
