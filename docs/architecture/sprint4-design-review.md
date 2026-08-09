# Sprint 4 Design Review: Enterprise Domain Modularization

## 1. Executive Summary
This document reviews the architectural blueprint designed during Sprint 4 (Phases 1-5) for DASHBOARDTHANGTINHOC. The objective is to transition from a flat, technical-layer monolith into a highly cohesive, domain-driven modular platform without altering business logic, API contracts, or database schemas.

## 2. Current Architecture (Monolith Layers)
The application currently groups files by their technical function:
- `routes/*.js`
- `controllers/*.js`
- `services/*.js`
- `models/*.js`

**Drawbacks**: This causes heavy cross-domain coupling (e.g., `FinanceService` directly importing `StudentModel`). It makes extracting microservices difficult and increases the cognitive load for developers working on specific business features.

## 3. Target Architecture (Domain Modules)
Files will be collocated by their business domain under the `modules/` directory.

- **Domains Defined**: `auth`, `student`, `teacher`, `course`, `enrollment`, `attendance`, `exam`, `certificate`, `finance`, `payment`, `notification`, `cms`, `ai`, `branch`, `tenant`, `report`.
- **Module Internal Structure**: Each domain contains its own `*.routes.js`, `*.controller.js`, `*.service.js`, and `models/`.
- **Shared Infrastructure**: A `shared/` directory encapsulates cross-cutting concerns (RBAC `authorize`, Context `PolicyService`, Observability `MetricsCollector`, `AuditLogger`).

## 4. Architectural Validation
The proposed target structure has been logically validated against the following platform constraints:
- **API Compatibility**: Express routers will be mounted exactly at their legacy paths (e.g., `/api/students`). Zero API contract drift.
- **RBAC & Policy Engine**: The `authorize()` middleware is stateless regarding folder structure. Moving it to `shared/middleware/authorize.js` preserves full compatibility.
- **Permission Cache**: In-memory Redis/Cache operations remain globally accessible from `shared/context/`.
- **Audit & Observability**: `AuditLogger` and `MetricsCollector` will be injected as shared middleware, capturing identical telemetry.

## 5. Migration Strategy (Estimated Sprint Breakdown)
The transition requires physically relocating files and updating import paths. This will be executed incrementally across **Sprint 4.1**.

- **Batch 1 (Infrastructure & Auth)**: Setup `shared/`, migrate `auth`, `tenant`, `branch`.
- **Batch 2 (Core Entities)**: Migrate `student`, `teacher`, `course`.
- **Batch 3 (Transactional/Operations)**: Migrate `finance`, `enrollment`, `attendance`, `exam`.
- **Batch 4 (Edge & Support)**: Migrate `notification`, `cms`, `report`, `ai`, `payment`.

*Expected Velocity: 1 Batch per execution phase. Full regression suite runs after every batch.*

## 6. Risk Analysis & Mitigation
- **Risk 1: Broken Import Paths (High Risk)**. Moving a service file will break any controller importing it if the relative path is not updated.
  - *Mitigation*: Extensive reliance on `npm run lint` and `npm test` after every file move. Use intelligent IDE refactoring or automated script traversal.
- **Risk 2: Circular Dependencies (Medium Risk)**. During the move, hidden circular dependencies may surface.
  - *Mitigation*: Decouple via the `Service` layer or utilize Event Emitters for cross-domain notifications.

## 7. Rollback Strategy
Because Sprint 4.1 will be executed as a series of isolated structural commits (no logic changes), rollback is instantaneous via Git (`git revert`). There is zero database state manipulation, guaranteeing a risk-free rollback path.

## 8. Conclusion
The Domain Modularization design is robust, verified, and adheres strictly to the ARB requirements. 
**Recommendation**: The Architecture Review Board should approve the transition to execution phase (Sprint 4.1).
