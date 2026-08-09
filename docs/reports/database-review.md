# Database Review

## RBAC Related Collections

1. **Roles Collection**
   - **Indexes**: `code` (Unique), `tenantId`
   - **Performance**: High. Mostly read-heavy.

2. **AuditLog Collection**
   - **Indexes**: `correlationId`, `actorUserId`, `action`, `createdAt`
   - **Performance**: High write throughput. 

3. **Users/Teachers Collection**
   - **Legacy Fields**: `permissions` (Array), `roleId`
   - **Notes**: Needs cleanup script in future sprints.

## Concerns
- No N+1 queries found in the Authorization pipeline thanks to caching.
- `populate()` usage is restricted to necessary relations.

**Status**: Database schema is stable for Sprint 3.5.
