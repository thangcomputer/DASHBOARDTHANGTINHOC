# DTO Guidelines (Sprint 4.4+)

## 1. Core Principle
A Data Transfer Object (DTO) must act purely as a container for data. 
- **NO Logic**: A DTO must not contain any business logic, validation rules, or database query logic.
- **Immutability**: DTOs should be immutable once created. Use `Object.freeze(dto)` or `readonly` properties.

## 2. Directory Structure
```
dto/
  commands/     # Mutating operations (POST, PUT, DELETE, PATCH)
  queries/      # Read operations (GET, search, export)
  responses/    # Payloads returned to the client
  mappers/      # Transformers mapping DTO <-> Entity
  validators/   # Zod Schemas
  index.js      # Barrel file for clean imports
```

## 3. Immutability
All DTOs passed to Application Services MUST be frozen.
```javascript
function createCreateStudentCommand(data) {
  return Object.freeze({
    fullName: data.fullName,
    email: data.email
  });
}
```
