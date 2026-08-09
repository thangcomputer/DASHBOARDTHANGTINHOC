# Legacy Authorization Cleanup Analysis

## 1. Overview
Following the successful migration of all four batches in Sprint 3.6, the Enterprise RBAC middleware is now the sole authority for route protection. This document inventories the deprecated legacy authorization infrastructure and provides a controlled retirement plan.

## 2. Artifact Inventory & Classification

### 2.1 `shared/middleware/authMiddleware.js`
This file previously acted as the primary authorization gatekeeper.
- **`isAdmin`, `isSuperAdmin`, `isTeacher`**: 
  - **Classification**: READY TO DELETE
  - **Reason**: Completely replaced by `authorize(NEW_PERMISSIONS.XXX)` across all modules.
- **`checkPermission`, `checkAnyPermission`**: 
  - **Classification**: READY TO DELETE
  - **Reason**: The RBAC `authorizeAny()` and `authorizeAll()` functions have entirely assumed this responsibility.
- **`userHasPermission`**: 
  - **Classification**: KEEP TEMPORARILY
  - **Reason**: Occasionally used inside Service and Controller layers to implement complex business rules (e.g., conditionally formatting UI payloads). Requires a deeper Service Layer audit before removal.
- **`branchFilter`, `requireInternalToken`**:
  - **Classification**: KEEP TEMPORARILY / DO NOT DELETE
  - **Reason**: `branchFilter` is a Data Scope middleware, not an authorization policy. It attaches the `req.branchFilter` object used extensively by MongoDB queries to enforce tenant isolation at the data layer.

### 2.2 `constants/permissions.js` (Legacy Strings)
- **Classification**: BLOCKED
- **Reason**: While the backend no longer relies on these strings for authorization logic, the Frontend SPA may still expect these exact string keys in the `/api/auth/me` payload to render UI components. Deleting this file or halting the issuance of these strings will break the frontend until the UI RBAC migration (Sprint 4) is complete.

### 2.3 `shared/constants/legacyPermissionMapping.js`
- **Classification**: KEEP TEMPORARILY
- **Reason**: Currently vital for mapping legacy string requests (and potentially legacy database roles) into the new RBAC catalog dynamically. Must remain active until the database roles and frontend clients are fully migrated to the new schema.

## 3. Action Plan
1. **Sprint 3.7**: Safely purge `isAdmin`, `isSuperAdmin`, `isTeacher`, `checkPermission`, and `checkAnyPermission` from `authMiddleware.js`.
2. **Sprint 4.0**: Execute Frontend RBAC migration, deprecating `constants/permissions.js`.
3. **Sprint 4.1**: Execute Database Schema Migration, deprecating `legacyPermissionMapping.js`.
