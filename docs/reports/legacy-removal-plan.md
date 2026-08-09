# Legacy Removal Plan

## 1. Overview
This document outlines the systematic classification and removal strategy for the legacy authorization infrastructure. In adherence with the ARB's strict directive, **no deletions are authorized automatically**. This plan prepares the system for Sprint 3.7.

## 2. Component Classifications

### 2.1 READY_TO_DELETE
These artifacts have been empirically proven as dead code. They are 100% decoupled from the routing, controller, service, and runtime layers.
- **Components**: 
  - `isAdmin`, `isSuperAdmin`, `isTeacher`, `isStaff` (from `shared/middleware/authMiddleware.js`)
  - `checkPermission`, `checkAnyPermission` (from `shared/middleware/authMiddleware.js`)
  - Internal helper functions `requireRole` and `requirePermission` (from `shared/middleware/authMiddleware.js`)
- **Action**: Safely remove from `authMiddleware.js` in Sprint 3.7.
- **Risk**: Low (Verified Dead Code).

### 2.2 KEEP_TEMPORARILY
These artifacts are no longer used for routing or API protection, but remain embedded in specific business logic workflows or data-scoping middleware.
- **Components**:
  - `userHasPermission`: Still exported from `authMiddleware.js` and potentially utilized in edge-case service-level conditional rendering.
  - `shared/constants/legacyPermissionMapping.js`: Absolutely critical. This is the translation matrix that allows legacy database roles/strings to map dynamically into the new RBAC catalog.
- **Action**: Do not delete in Sprint 3.7. Requires a dedicated Database Schema Migration (Sprint 4.1) to update all MongoDB documents to use the new `NEW_PERMISSIONS` array format before this mapping logic can be safely dropped.
- **Risk**: High (Deletion would break API access for un-migrated database entities).

### 2.3 BLOCKED
These artifacts cannot be deleted without breaking upstream or downstream clients.
- **Components**:
  - `shared/constants/permissions.js` (The legacy string formats exported alongside the new ones, or if the frontend explicitly expects strings like `"system_settings"`).
  - Legacy `roleCode` assignments mapped during authentication.
- **Why it is blocked**: The React Single Page Application (SPA) currently reads the `/api/auth/me` payload to dynamically render UI menus (e.g., Admin Sidebar, CMS controls). The frontend UI is hardcoded to expect legacy strings (e.g., `"manage_students"`).
- **What depends on it**: `client/src/App.jsx`, `client/src/components/DashboardLayout.jsx`, etc.
- **How to migrate**: A dedicated Frontend RBAC Migration Sprint (Sprint 4.0) must be executed. The frontend needs to be refactored to consume the new `PERMISSIONS.XXX` constants and evaluate policies identically to the backend.
- **Estimated Risk**: CRITICAL. Deleting these payloads now will immediately result in a locked, unnavigable User Interface for all users.

## 3. Conclusion
Sprint 3.7 may safely proceed with the deletion of the components listed under `READY_TO_DELETE`. All other components remain under a strict preservation order.
