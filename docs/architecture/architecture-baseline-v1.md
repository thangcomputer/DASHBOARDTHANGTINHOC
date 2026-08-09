# Architecture Baseline v1.0
*DASHBOARDTHANGTINHOC - Education ERP / LMS Platform*

## 1. Current Architecture Overview
The system follows a modular, layered backend architecture built on Node.js and Express. It enforces strict separation of concerns, separating HTTP request routing, security (authorization), and business domain logic. The platform is multi-tenant capable, with advanced branch-level data isolation.

## 2. Core Platform Layers
1. **Routing Layer (`routes/`)**: Responsible solely for defining HTTP verbs, URL paths, input validation orchestration, and binding middleware. No business logic or authorization decisions occur here.
2. **Middleware Layer (`shared/middleware/`)**: Intercepts requests for Authentication, Authorization (RBAC), Data Scoping (Branch Filter), and Validation.
3. **Controller Layer (`controllers/`)**: Handles parsing of incoming HTTP payloads, invokes the Service Layer, and formats standard JSON responses.
4. **Service Layer (`services/`)**: The core domain engine. Executes business rules, orchestrates database interactions, and ensures transactional integrity.
5. **Data Access Layer (`models/`)**: Mongoose schemas defining the structure of MongoDB collections, including pre/post hooks for cascading deletes or audit trail updates.

## 3. RBAC Architecture
The legacy ad-hoc role checking has been entirely replaced by an Enterprise Role-Based Access Control (RBAC) architecture.
- **Access Vectors**: `authorize(permission)`, `authorizeAny([...permissions])`, `authorizeAll([...permissions])`.
- **Granularity**: Permissions are highly granular (e.g., `STUDENT_CREATE`, `SETTINGS_UPDATE`) allowing dynamic composition rather than static role arrays.
- **Separation of Logic**: Route guards verify *Authorization* (Does this user have the right to attempt this action?). The Service layer verifies *Business Rules* (e.g., Is this user's balance sufficient? Is this invoice already paid?).

## 4. Policy Engine
The `PolicyService` (`shared/context/policy.service.js`) centrally manages complex authorization conditions dynamically:
- **TenantPolicy**: Prevents data leakage between segregated environments.
- **BranchPolicy**: Filters access based on a user's assigned branch(es). Staff can only read/mutate data belonging to their authorized branches unless they possess `GLOBAL` scope.
- **ConditionPolicy**: Evaluates dynamic attributes (e.g., Time-based access limits, IP restrictions) before granting permission.

## 5. Permission Cache
To ensure the RBAC engine does not introduce high latency via database lookups on every request, a highly optimized `PermissionCache` (`shared/context/permissionCache.js`) is implemented.
- **In-Memory Store**: Quick retrieval of resolved permission sets.
- **Invalidation**: Cache invalidates automatically upon Role changes, Permission assignment updates, or explicit TTL expiration.

## 6. Observability & Monitoring
- **Health Checks (`/health`, `/ready`, `/live`)**: Exposes system status, Redis connectivity, and Database availability.
- **Metrics (`/metrics`)**: The `MetricsCollector` captures critical telemetry, including cache hit/miss rates, request latency, and endpoint error frequencies.
- **RequestContext**: Uses `AsyncLocalStorage` to bind a unique `Correlation ID` and `Request ID` to every HTTP cycle, allowing distributed tracing across synchronous and asynchronous boundaries.

## 7. Logging & Audit
- **Application Logging**: Structured JSON logging (Pino/Winston) capturing system events.
- **Audit Logging**: The `auditLogger` intercepts critical mutations and access denials (e.g., `PERMISSION_DENIED`). It automatically logs the Actor (`currentUser`), the Action, the target Resource ID, and IP address for forensic compliance.

## 8. Module Boundaries & Folder Structure
```text
├── bootstrap/            # Application startup and bootstrapping sequences
├── client/               # Frontend React Application
├── config/               # Environment variables and configuration manifests
├── controllers/          # HTTP request handlers
├── docs/                 # Architectural documentation and sprint reports
├── models/               # Database schemas and DTOs
├── modules/              # Domain-specific bounded contexts (e.g., AI, Analytics)
├── routes/               # API endpoint definitions
├── services/             # Core business logic
├── shared/               # Cross-cutting concerns (constants, context, errors, logger, middleware)
├── tests/                # Unit and Integration test suites
└── utils/                # Pure helper functions
```

## 9. Coding Standards
- **Asynchronous Execution**: Heavy usage of `async/await`. Avoid `.then().catch()` chains to prevent callback hell.
- **Error Handling**: Use the centralized `AppError` class. Never throw raw strings or generic Error objects. Errors must be passed to `next(err)` to be caught by the global error handler.
- **Response Format**: All successful API responses must adhere to the standard envelope: `{ success: true, data: {}, meta: {} }`.
- **Validation**: Payload validation must occur via declarative schemas (e.g., Joi/Zod) injected at the routing layer before hitting the controller.

## 10. Dependency Rules
- **Acyclic Dependencies**: Services may call Models. Controllers may call Services. Services **must never** call Controllers. Models **must never** call Services.
- **Authorization Isolation**: Background workers, queues, and cron jobs must execute logic autonomously based on payload validation, never relying on HTTP context middleware (`authMiddleware`).
