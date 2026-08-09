# Batch 1 Foundation Modules Precheck

## 1. Overview
Sprint 4.1 focuses strictly on physical code relocation to establish the Domain-Driven structure. Batch 1 covers the foundational domains: `auth`, `branch`, `tenant`, `system` (formerly Settings/Config). The `shared` and `config` directories are already positioned correctly at the repository root and require no file movement.

## 2. File Verification & Target Mapping

### Domain: `auth`
| Current Path | Target Path | Imports (Dependencies) | Exports |
|---|---|---|---|
| `routes/authRoutes.js` | `modules/auth/authRoutes.js` | `express`, `jsonwebtoken`, `bcryptjs`, `passport`, `../models/Teacher`, `../models/Student`, `../shared/middleware/authMiddleware`, etc. | `router` |
| `models/Employee.js` | `modules/auth/models/Employee.js` | `mongoose` | `Employee` (Mongoose Model) |

*(Note: `authenticate.js` and `authorize.js` belong to `shared/middleware/` and are not moving.)*

### Domain: `branch`
| Current Path | Target Path | Imports (Dependencies) | Exports |
|---|---|---|---|
| `routes/branchRoutes.js` | `modules/branch/branchRoutes.js` | `express`, `../shared/middleware/authMiddleware`, `../shared/middleware/authorize`, `../controllers/branchController` | `router` |
| `controllers/branchController.js`| `modules/branch/branchController.js` | `../models/Branch`, `../models/Teacher`, `../models/Student`, `../services/tenantService` | Route Handlers (e.g., `getAllBranches`) |
| `models/Branch.js` | `modules/branch/models/Branch.js` | `mongoose` | `Branch` (Mongoose Model) |

### Domain: `tenant`
| Current Path | Target Path | Imports (Dependencies) | Exports |
|---|---|---|---|
| `routes/tenantRoutes.js` | `modules/tenant/tenantRoutes.js` | `express`, `../shared/middleware/authMiddleware`, `../services/tenantService` | `router` |
| `services/tenantService.js` | `modules/tenant/tenantService.js` | `../models/Tenant`, `../models/Branch`, `../config/logger`, etc. | Service Methods (e.g., `getCurrentTenant`) |
| `models/Tenant.js` | `modules/tenant/models/Tenant.js` | `mongoose` | `Tenant` (Mongoose Model) |

### Domain: `system` (formerly Settings)
| Current Path | Target Path | Imports (Dependencies) | Exports |
|---|---|---|---|
| `routes/settingsRoutes.js` | `modules/system/settingsRoutes.js` | `express`, `../models/SystemSettings`, `../services/settingsCache`, `mongoose`, etc. | `router` |
| `controllers/settingsController.js`| `modules/system/settingsController.js`| `../models/SystemSettings`, `../services/settingsCache` | Route Handlers |
| `services/settingsCache.js` | `modules/system/settingsCache.js` | `../models/SystemSettings`, `../utils/cache` | Cache Methods |
| `models/SystemSettings.js` | `modules/system/models/SystemSettings.js`| `mongoose` | `SystemSettings` (Mongoose Model) |

## 3. Dependency Risk Assessment
Moving these files will break relative paths in two directions:
1. **Internal Imports**: The relocated files themselves contain `require('../...')` which must be adjusted (e.g., `routes/authRoutes.js` importing `../models/Teacher` becomes `../../models/Teacher` when moved to `modules/auth/authRoutes.js`).
2. **External Imports**: Other files across the legacy architecture that currently import the relocated models or services (e.g., `server.js` importing `routes/authRoutes`, or `controllers/someController` importing `services/tenantService`) must have their paths updated to `modules/<domain>/...`.

## 4. Execution Readiness
The dependencies are fully mapped. Relocation is safe to proceed under Phase 2.
