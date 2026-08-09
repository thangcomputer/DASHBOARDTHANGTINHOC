# Dependency Injection Review

## Current State Assessment
- **Constructor Injection**: Currently, the system relies heavily on manual require/import for Repository and Service dependencies. True IoC (Inversion of Control) containers are not universally adopted.
- **Repository Injection**: Application Services directly instantiate or require Repository classes, creating tight coupling to the persistence layer.
- **EventBus Injection**: Will require a DI framework (e.g., Awilix or TSyringe) to securely inject the EventBus into Command Handlers without polluting domain logic.
- **Circular Dependency**: Strict boundary enforcement via DTOs and Mappers has significantly mitigated circular dependencies, but a formal DI container will guarantee resolution.
- **Module Boundaries**: The current folder structure (`modules/`) perfectly supports scoping dependencies per bounded context.

## Action Plan for Future Sprint
- Introduce a lightweight DI container (e.g., Awilix) in the application bootstrap phase.
- Refactor Application Services to accept dependencies via constructor arguments.
