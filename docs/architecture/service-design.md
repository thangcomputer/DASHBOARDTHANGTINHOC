# Application Service Layer Design

## 1. Objective
Establish a clean Application Service Layer separating HTTP controllers from Business Logic.

## 2. Directory Structure Mandate
Every domain must follow this strict structure:
```text
modules/<domain>/
  ├── controllers/     # Orchestrates HTTP request/response
  ├── services/        # Contains pure business logic (Application Services)
  ├── repositories/    # Contains pure data access logic
  ├── dto/             # Data Transfer Objects
  ├── validators/      # Business & Input validation logic
  ├── events/          # Domain events & Pub/Sub
  └── index.js         # Domain entrypoint
```

## 3. Boundary Rules
- **Controllers** become orchestration-only. They parse `req`, call a Service, and send `res`.
- **Services** become business-logic only. They handle rules, errors, and call Repositories.
- **Repositories** remain persistence-only.
- **No Controller may call a Repository directly.**
- **No Service may parse HTTP requests (`req`, `res`, `next`).**

## 4. Interaction Flow
`Client -> Router -> Controller (parses DTO) -> Service (business rules) -> Repository (DB) -> Service -> Controller -> Client`
