# Remaining Technical Debt

## 1. Fat Controllers
The single largest technical debt in the application is the prevalence of Fat Controllers (e.g., `studentRoutes.js` is over 2,800 lines of code).
- **Impact**: Business logic, authorization, HTTP request parsing, and database transactions are all mixed.
- **Next Step**: Abstract business logic into Domain Services (e.g., `StudentService`, `FinanceService`).

## 2. Cross-Domain Orchestration in Routes
Controllers currently orchestrate multi-domain logic. For example, enrolling a student creates a ledger entry, assigns a teacher, and generates an invoice, all within `studentRoutes.js`.
- **Impact**: Makes it impossible to implement clean Unit of Work (UoW) boundaries or reuse the enrollment logic elsewhere.
- **Next Step**: Implement Application Services or Orchestrators (e.g., `EnrollmentOrchestrator`).

## 3. Mongoose `.save()` Reliance
While we abstracted data access behind `BaseRepository`, many routes still instantiate Mongoose documents directly via `repository.createInstance(req.body)` and mutate them before calling `.save()`.
- **Impact**: Domain entities are tightly coupled to Mongoose document structures, and Mongoose middlewares are implicitly relied upon.
- **Next Step**: Replace `.save()` workflows with explicit `repository.updateById(id, data)` and rely on Data Transfer Objects (DTOs) for domain modeling.

## 4. Query Parameter Injection
Controllers pass raw `req.query` attributes into repository filters (e.g., `filter.status = req.query.status`).
- **Impact**: Exposes the database schema to the API contract and bypasses domain-level validation.
- **Next Step**: Enforce Query Objects (e.g., `StudentQuery`) as defined in the Batch 2 precheck.
