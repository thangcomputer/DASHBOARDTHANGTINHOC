# Technical Debt v3

## 1. Massive "Fat Controllers"
- Files like `studentRoutes.js`, `teacherRoutes.js`, and `ledgerService.js` are monolithic.
- `studentRoutes.js` acts as an orchestrator, validator, business rules engine, and HTTP responder.

## 2. Inconsistent Service Layer
- Some domains (like `finance`) have `services` (e.g., `ledgerService.js`) but they act more like query builders than domain services.
- Many domains simply skip the Service layer and execute business logic directly in the route handler.

## 3. Lack of Input Validation (DTOs)
- Request payloads are parsed implicitly throughout the controller logic (e.g., `req.body.name`).
- There is no central validation mapping before business logic execution.

## 4. Remediation Plan
Sprint 4.3 will extract all business logic into `Services`, and introduce `DTOs` and `Validators` to sanitize inputs before they reach the Service layer.
