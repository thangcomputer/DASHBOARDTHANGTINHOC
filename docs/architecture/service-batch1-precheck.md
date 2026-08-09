# Batch 1 Service Extraction Precheck

## 1. Objective
Establish the Application Service Layer for the base infrastructure domains: `auth`, `notification`, `tenant`, `branch`, and `system`.

## 2. Methodology
For each domain:
1. Extract business logic from `modules/<domain>/routes/<domain>Routes.js` (or existing controllers).
2. Create `modules/<domain>/services/<Domain>ApplicationService.js`.
3. Create/update `modules/<domain>/controllers/<Domain>Controller.js` to be orchestration only.
4. Route handlers will simply map `req` to the controller.

## 3. Constraints
- No business logic in Controllers.
- Controllers do not call Repositories or Mongoose directly.
- Preserve all existing API responses, status codes, errors, and validations.
- No DTO introduction.
- Tests will be run after each domain to ensure ZERO regression.
