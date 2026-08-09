# Observability Inventory
## Scope
An audit of all layers in the backend platform:
- **Controllers**: 30+ Express routers mapping HTTP requests to CQRS buses.
- **Application Services**: Core business logic modules orchestrating entities.
- **Repositories**: Mongoose wrappers handling database queries.
- **CommandHandlers / QueryHandlers**: CQRS boundary objects.
- **Event Handlers**: Subscribers to `EventBus`.
- **Middleware**: Including Auth, RBAC, Validation.
- **External Dependencies**: MongoDB, BullMQ, Redis, SMTP.
