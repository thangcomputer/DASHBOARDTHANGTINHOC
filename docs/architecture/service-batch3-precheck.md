# Service Precheck — Sprint 4.3 Batch 3

## Scope
Batch 3 focuses exclusively on transactional and highly-complex domains:
- `finance`: `financeRoutes.js`, `biRoutes.js`
- `payment`: `webhookRoutes.js`
- `invoice`: `invoiceRoutes.js`
- `transaction`: `transactionRoutes.js`
- `exam`: `evaluationRoutes.js`, `examResultRoutes.js`, `proctorRoutes.js`, `quizRoutes.js`
- `certificate`: (No active routes discovered)
- `analytics`: `analyticsRoutes.js`
- `report`: `backupRoutes.js`, `monitoringRoutes.js`, `systemLogRoutes.js`

## Complexity Assessment
These domains involve Mongo transactions, aggregated reporting, complex calculation logic, and webhook signatures. The migration must safely untangle Express `req`/`res` objects from calculations without disturbing the business workflows.

## Validation Strategy
- Rely on existing robust test suites.
- Use automated AST-like parsing to decouple payload mapping into Controllers while preserving verbatim logic in Application Services.
- **Rule Check**: Ensure no Mongo `session` or aggregate logic leaks into the Controller layer.
