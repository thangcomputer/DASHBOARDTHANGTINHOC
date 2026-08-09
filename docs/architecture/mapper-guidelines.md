# Mapper Guidelines (Sprint 4.4+)

## 1. Core Principle
Mappers decouple external HTTP representations from internal Persistence Entities.
- Mappers handle translations only.
- Mappers **MUST NOT** execute business logic.
- Mappers **MUST NOT** communicate with Repositories.

## 2. Standardized Methods
Every Mapper should provide standard mapping functions depending on the domain's complexity:
- `fromCreateDTO(command)`: Converts a create payload into a database-ready object.
- `fromUpdateDTO(command)`: Converts an update payload into a database-ready object.
- `toEntity(dto)`: General purpose transform.
- `toResponse(entity)`: Maps an entity to a full response.
- `toSummary(entity)`: Maps an entity to a lightweight response (for lists).
- `toDetail(entity)`: Equivalent to `toResponse` with potential relationship expansions.

## 3. Implementation Rule (Response DTOs)
**DO NOT** use JavaScript `class` instantiation (`new StudentResponse()`) for simple output payloads unless there is a strong architectural need (like getters/setters). Return plain objects for performance.

```javascript
class StudentMapper {
  static toResponse(entity) {
    return {
      id: entity._id.toString(),
      name: entity.name,
      email: entity.email
      // Excludes secrets and raw MongoDB metadata
    };
  }
}
```
