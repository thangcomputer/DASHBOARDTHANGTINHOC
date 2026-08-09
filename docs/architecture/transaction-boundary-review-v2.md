# Transaction Boundary Review v2

## 1. Objective
Following the Repository Pattern migration of the Transactional Domains (Finance, Invoice, Payment) in Sprint 4.2 Batch 3, we have designed the interfaces required for MongoDB Sessions and ACID transactions in future sprints.

## 2. Infrastructure Interfaces Prepared
To support true Unit of Work (UoW), the following abstractions were added to `shared/repositories/TransactionInterfaces.js` and `BaseRepository.js`:

### 2.1 Repository Registry
Instead of statically importing repositories into a Transaction Manager, repositories will register themselves with a `RepositoryRegistry`. This enables future Dependency Injection (DI) and easier test mocking.

### 2.2 TransactionManager & RepositoryFactory
The `TransactionManager` interface exposes `beginTransaction()`, which will ultimately initialize a MongoDB session. The `RepositoryFactory` will then generate a `RepositoryContext` wrapping the active session, distributing it to any requested repositories from the Registry.

### 2.3 UnitOfWork
An interface exposing:
- `begin()`
- `commit()`
- `rollback()`
- `execute(workFn)`
- `dispose()`

Currently, these methods are stubs (`No Mongo Session implementation`), complying with the ARB's restriction.

## 3. Next Steps (Sprint 4.4+)
Once the Service layer is fully decoupled from the Controllers (Sprint 4.3), the `UnitOfWork` can be injected into Orchestrator Services (like `EnrollmentOrchestrator`), passing the active session down into the repositories to achieve cross-domain atomicity.
