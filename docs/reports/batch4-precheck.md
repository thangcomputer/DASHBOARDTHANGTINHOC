# Batch 4 Migration Pre-check: Admin, AI, Settings & System Config

## Phase 1: Endpoint Analysis

### Module: Admin & System Settings (`routes/settingsRoutes.js`, `routes/systemLogRoutes.js`, `routes/backupRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `GET /settings/*`, `PUT /settings/*` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant | High |
| `POST /settings/upload-*` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant | High |
| `POST /settings/reset-data` | `checkPermission(SYSTEM_SETTINGS)` | `SETTINGS_UPDATE` | Tenant | CRITICAL |
| `GET/POST/DELETE /system-logs` | `isAdmin` | `SETTINGS_UPDATE` | Tenant | Medium |
| `GET /backup/*` | `isSuperAdmin` | `SETTINGS_UPDATE` | Tenant | High |

### Module: User Management (`routes/employeeRoutes.js`, `routes/staffRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `GET/POST/PUT/DELETE /employees/*` | `isAdmin` | `USER_MANAGE` | Tenant, Branch | High |
| `GET/POST/PUT/DELETE /staff/*` | `checkPermission('manage_staff')` | `USER_MANAGE` | Tenant, Branch | High |

### Module: Organization (`routes/branchRoutes.js`, `routes/tenantRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `POST/PUT/DELETE /branches/*` | `checkPermission(SYSTEM_SETTINGS)` | `BRANCH_MANAGE` | Tenant | High |
| `GET/POST/PUT/DELETE /tenants/*` | `isSuperAdmin` | `SETTINGS_UPDATE` | Global | High |

### Module: AI & Workflow (`routes/aiRoutes.js`, `routes/workflowRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `POST /ai/*` | `isAdmin` | `SETTINGS_UPDATE` | Tenant | Medium |
| `GET/POST/PUT/DELETE /workflows/*` | `isAdmin` | `SETTINGS_UPDATE` | Tenant | Medium |

### Module: Training & Exams (`routes/proctorRoutes.js`, `routes/teachingGuideRoutes.js`, `routes/biRoutes.js`)
| Route | Legacy Guard | Target Permission | Policy Required | Risk Level |
|---|---|---|---|---|
| `GET /proctor/events/*` | `isAdmin` | `EXAM_MANAGE` | Tenant, Branch | Low |
| `GET /teaching-guides/*` | `isAdmin` | `COURSE_UPDATE` | Tenant | Low |
| `GET /bi/*` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | Tenant, Branch | Low |
| `PUT /settings/training-data` | `checkPermission(MANAGE_TRAINING)` | `COURSE_UPDATE` / `EXAM_MANAGE` | Tenant | High |
