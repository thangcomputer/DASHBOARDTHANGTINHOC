# Service Regression Report — Batch 1

## 1. Result
**ZERO REGRESSIONS**

- `npm test`: **99 passing / 0 failing** (2 skipped — API-dependent, unchanged)

## 2. Issues Encountered and Resolved

### Issue 1: TenantApplicationService.js — getBranches appended outside module.exports
- **Root Cause**: The extraction script concatenated the `getBranches` method string directly after `module.exports = { ... }`, producing invalid syntax (a class method syntax outside any class body).
- **Fix**: Converted `getBranches` to a proper named async function and added it to the `module.exports` object.
- **Detection**: `npm test` immediately caught the SyntaxError on module load.

### Issue 2: TenantApplicationService.js — wrong relative require paths
- **Root Cause**: The original `tenantService.js` used paths relative to `modules/tenant/`. After moving to `modules/tenant/services/`, all `../` paths became stale (needed one extra `../`).
- **Fix**: Updated all `require()` paths: `./repositories` → `../repositories`, `../branch` → `../../branch`, etc.
- **Detection**: `npm test` caught MODULE_NOT_FOUND error on the first require.

### Issue 3: tenantService.test.js — stale import path
- **Root Cause**: The integration test was pointing at the old `modules/tenant/tenantService` path.
- **Fix**: Updated import to `modules/tenant/services/TenantApplicationService`.

## 3. Observability Preserved
- `RequestId` / `CorrelationId` middleware — untouched (lives in Express middleware chain).
- `AuditLogger` — calls preserved inside Application Services.
- `RBAC` / `authorize` middleware — untouched (lives in Route layer).

## 4. Conclusion
The Application Service Layer for Batch 1 domains is production-stable and regression-free.
