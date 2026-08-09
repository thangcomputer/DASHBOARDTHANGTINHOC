# Legacy Dependency Analysis (Static)

## 1. Overview
A full static dependency scan was executed across the backend repository (`routes/`, `controllers/`, `services/`, `modules/`, `workers/`, `queues/`, `cron/`, `socket/`, `scripts/`, `middleware/`, `utils/`, `shared/`, `bootstrap/`, `config/`). The goal was to detect any remaining usages of legacy authorization mechanisms before their scheduled deletion.

## 2. Scan Target Artifacts
- `isAdmin`, `isTeacher`, `isSuperAdmin`
- `checkPermission`, `checkAnyPermission`
- `guard arrays`
- `req.currentUser.role`, `req.currentUser.adminRole`, `roleCode` (when used for hardcoded auth checks)

## 3. Findings

### 3.1 Business Logic & Services
**STATUS: CLEAN**
- **0** occurrences of legacy authorization middleware wrappers found in any Controller, Service, Worker, Cron, or Queue file.
- Business rules relying on roles (e.g., Chat mailbox routing via `isAdminLevelAccount`) do not import or depend on legacy `authMiddleware` components; they evaluate data payloads directly.

### 3.2 Routing Layer
**STATUS: CLEAN**
- **0** occurrences of `isAdmin`, `isSuperAdmin`, `isTeacher`, `checkPermission`, or `checkAnyPermission` used as route guards.
- 100% of routes use the Enterprise RBAC `authorize()`, `authorizeAny()`, or `authorizeAll()` middleware.

### 3.3 Core Middleware & Shared Modules
**STATUS: ISOLATED**
- **`shared/middleware/authMiddleware.js`**: Contains the physical declarations of the legacy wrappers. These are isolated and explicitly marked for deletion.
- **`shared/middleware/authenticate.js`**: Translates JWT payloads into standard `roleCode` values (e.g., `STUDENT`, `TEACHER`, `SUPER_ADMIN`). This is essential identity infrastructure, not an authorization guard.
- **`shared/middleware/authorize.js`**: The new RBAC engine. Evaluates `roleCode` properly against policies.
- **`shared/middleware/branchFilter.js`**: Uses `req.currentUser.role` to determine data isolation boundaries (Tenant/Branch logic). This is a Data Scope filter, not an auth guard.

## 4. Conclusion
The backend architecture is 100% decoupled from the legacy authorization layer. The legacy wrappers exist purely as dead code within `authMiddleware.js`.
