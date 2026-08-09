# Repository Design Review v2 (Transaction Readiness)

## 1. Overview
As part of Sprint 4.2 Batch 2, we designed the Repository layer to be transaction-ready (Sprint 4.4 preparation). While MongoDB Sessions are not yet enabled, the foundational abstraction exists in the newly implemented `BaseRepository`.

## 2. BaseRepository Implementation
The `BaseRepository` now accepts an `options` object with an optional `session` key for every mutating or read operation:
- `findById(id, { session })`
- `findOne(filter, { session })`
- `create(data, { session })`
- `updateOne(filter, updateData, { session })`
- `deleteById(id, { session })`

## 3. UnitOfWork (UoW) Pattern Design
The target state for Sprint 4.4 requires atomicity across domains.

### 3.1 Proposed `RepositoryContext`
A factory that provides a scoped instance of all repositories bound to a single transaction session.
```javascript
class RepositoryContext {
  constructor(session) {
    this.session = session;
    this.studentRepository = new MongoStudentRepository(session);
    this.teacherRepository = new MongoTeacherRepository(session);
    // ...
  }
}
```

### 3.2 Proposed `UnitOfWork` Interface
```javascript
class UnitOfWork {
  async start() {
    this.session = await mongoose.startSession();
    this.session.startTransaction();
    this.repositories = new RepositoryContext(this.session);
  }

  async commit() {
    await this.session.commitTransaction();
    this.session.endSession();
  }

  async rollback() {
    await this.session.abortTransaction();
    this.session.endSession();
  }
}
```

## 4. Current Limitations (Batch 2)
Since Controllers manage business logic directly (Fat Controllers), injecting a `UnitOfWork` into a Controller is an anti-pattern. Before enabling true cross-domain transactions in Sprint 4.4, business logic must be fully migrated into Domain Services (`StudentService`, `EnrollmentService`) where the `UnitOfWork` can be orchestrated properly.
