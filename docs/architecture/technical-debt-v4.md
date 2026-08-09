# Technical Debt Review — Sprint 4.4 (DTO & Mapping)

## 1. Fat DTO Candidates
Currently, the Application Services accept a monolithic `data` object containing `body`, `query`, `params`, `file`, and `user`. 
- This `data` object is a "Fat DTO" because it blindly forwards all HTTP context without discrimination.
- **Resolution**: Introduce dedicated Request DTOs (e.g., `CreateStudentRequest`) that strictly extract only the expected fields.

## 2. Duplicate Validations
- Validation is currently scattered across Application Services. For example, checking if a `fullName` exists or if an `email` is valid happens inline inside the business logic.
- **Resolution**: Move all structural validation to the DTO layer using Zod, ensuring the Service layer never has to write `if (!data.body.email) throw Error()`.

## 3. Duplicate Mapping & Manual Object Construction
- Repositories and Services currently construct domain objects manually:
  ```javascript
  const student = new Student({
    name: data.body.name,
    email: data.body.email,
    branch: data.user.branchId
  });
  ```
- **Resolution**: Introduce a **Mapper Layer** (e.g., `StudentMapper.toDomain(dto)` and `StudentMapper.toResponse(entity)`). This will centralize object construction and prevent missed fields when schemas evolve.

## 4. Tight Coupling to External Frameworks
- Some services still manually handle `multer` file paths deeply inside their business logic.
- **Resolution**: File paths and buffers should be mapped into a agnostic `FileDto` before the service receives them.
