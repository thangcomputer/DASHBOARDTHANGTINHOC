# Technical Debt Assessment V5

## Post-Sprint 4.4 Status
- **Express Coupling**: RESOLVED. Controllers no longer leak `req` / `res` into Application Services.
- **Validation Sprawl**: RESOLVED. All validations are centralized in the `validators/` directories using Zod.
- **Mapping Hell**: RESOLVED. Pure Mapper classes handle all object transformations.

## Remaining Debt (To be resolved in Sprint 4.5/4.6)
- **Service Bloat**: Application Services remain "God Classes" containing dozens of methods. CQRS will resolve this by shattering them into individual Handlers.
- **Hardcoded Dependencies**: Lack of a proper Dependency Injection container makes mocking and testing harder.
- **Dual-Write Problem**: Operations currently modify the database and perform side effects (e.g., emails) in the same thread. An Event Bus will resolve this.
