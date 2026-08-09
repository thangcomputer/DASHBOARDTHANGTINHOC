# Architecture Review — DTO & Dependencies (Sprint 4.4)

## 1. Mapper Layer Strategy (Phase 5)
Currently, Domain Models (Mongoose Documents) are constructed ad-hoc inside Application Services.
**Proposed Mapper Layer:**
Introduce static Mapper classes (e.g., `StudentMapper`) to handle translations:
- `StudentMapper.toDomain(CreateStudentCommand)` → returns Mongoose payload.
- `StudentMapper.toResponse(StudentDocument)` → returns `StudentResponse` DTO (removing sensitive fields like passwords/tokens).

This guarantees that Repositories only deal with Domain payloads and Controllers only receive Response DTOs.

## 2. Dependency Injection Review (Phase 6)
Currently, dependencies are hardcoded via Node.js `require` and instantiated directly:
```javascript
const studentRepository = require('../repositories/StudentRepository');
// Or inside the class:
class StudentService {
  constructor() {
    this.repo = new StudentRepository();
  }
}
```
**Recommended DI Strategy:**
- Given this is a legacy JavaScript codebase, introducing a heavy DI framework (like `InversifyJS` or `NestJS` decorators) would require massive refactoring to TypeScript and decorators.
- **Recommendation**: Implement **Constructor Injection** combined with a manual **Composition Root** (IoC container via a simple factory pattern in a `container.js` file).
- Controllers will receive Services via constructors. Services will receive Repositories via constructors.

## 3. Readiness Scorecard

| Category | Score | Notes |
|---|---|---|
| **DTO Readiness** | 🟩 100% | The `data` object abstraction from Sprint 4.3 makes DTO extraction trivial. |
| **Validation Readiness** | 🟩 90% | Zod is selected. We just need to define schemas. |
| **CQRS Readiness** | 🟨 70% | Read/Write methods are identified, but segregating them into distinct files will require updating Controller imports. |
| **Mapper Readiness** | 🟩 85% | Clear boundaries exist; just need to write the Mapper classes. |
| **DI Readiness** | 🟨 60% | Requires refactoring `require()` statements to constructor injection. |
| **Overall Readiness** | **GO** | The system is perfectly primed for these patterns thanks to the Repository and Application Service layers built in Sprint 4.3. |

## 4. Final Recommendation
**GO WITH CONDITIONS**: Proceed with implementation, but roll out domain-by-domain (starting with Auth or Student) to prove the Zod + Mapper + DI pattern before executing globally.
