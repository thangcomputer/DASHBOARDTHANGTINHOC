# HIGH_ADMIN → SUPER ADMIN DIRECTORY FIX

Date: 2026-08-11

## Root cause

**CONFIRMED (runtime + user UI)**

### A — Backend

`loadSuperAdminDocs()` only queries Teacher documents. Root SUPER (`id=admin`) often has no Teacher doc → HIGH `HIGH_SEES_ALL` gets empty SUPER candidates.

### B — Floating Messenger

Elevated viewers skipped `GET /contacts` and used presence-only directory → offline SUPER hidden.

## Backend change

`services/messagingContactsService.js`: on HIGH branch, `ensureRootSuperAdminAmongDocs()` appends in-memory synthetic `{ id: 'admin', adminRole: SUPER_ADMIN }` when missing. Preserves real Teacher SUPER; dedupe by id. No Mongo writes.

## Frontend change

- `FloatingMessenger.jsx`: always fetch `/contacts` for elevated viewers.
- `supportPresence.js`: elevated directory = contacts (WHO) + presence (online).

## Synthetic SUPER identity

`id: admin`, `role: admin`, `adminRole/productRole: SUPER_ADMIN`

## Presence/contact merge

contacts → WHO; presence → ONLINE/OFFLINE

## Discovery matrix

HIGH → SUPER VISIBLE (online/offline). STAFF/SUPPORT/TEACHER/STUDENT → SUPER HIDDEN.

## Tests

`tests/unit/high_admin_super_directory.test.js` (A–H)

## Files changed

- `services/messagingContactsService.js`
- `client/src/components/FloatingMessenger.jsx`
- `client/src/utils/supportPresence.js`
- `tests/unit/high_admin_super_directory.test.js`
- `docs/messaging/HIGH_ADMIN_SUPER_DIRECTORY_FIX_2026-08-11.md`

## Database writes

0

## Messaging data writes

0

## Auth / RBAC / Socket / Pairing changes

NO

## Final status

```text
DISCOVERY = PASS
SEND AUTHORIZATION = UNCHANGED
PAIRING = UNCHANGED
```

Final status: **PASS** (pending UI re-confirm after re-apply)
