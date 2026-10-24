# MOBILE NOTIFICATIONS API CONTRACT

## Backend source of truth

Contract verified against:

- `routes/notificationRoutes.js`
- `services/notificationCenter.js`
- `models/Notification.js`
- Web caller `client/src/components/NotificationCenterPage.jsx`
- Web API wrapper `client/src/services/api.js`

No backend or Web files were modified in this phase.

## List

- Method: `GET`
- Endpoint: `/api/notifications`
- Authentication: `authMiddleware` is required.
- Query parameters:
  - `page` (default `1`)
  - `limit` (default `20`, maximum `100`)
  - `type` (optional; accepted values are `SYSTEM`, `COURSE`, `FINANCE`, `EVALUATION`, `MESSAGE`, `EXAM`, `SCHEDULE`)
  - `unreadOnly` (`1` or `true` enables the unread filter)
- Response: `{ success, data, pagination: { page, limit, total, pages }, unread }`
- Rows are scoped to the authenticated `req.user`; no client-supplied recipient ID is used.
- Rows are sorted newest first by `createdAt`.

## Item fields

Persisted schema fields:

- `_id`
- `type`
- `title`
- `content`
- `sender_id`
- `receivers`
- `read_by`
- `dismissed_by`
- `payload`
- `path`
- `createdAt`
- `updatedAt`

The list service also returns:

- `id` (string form of `_id`)
- `message` (alias of `content`)
- `time` (alias of `createdAt`)
- `read` (per-current-user read state)
- `dismissed` (per-current-user dismissed state)

`category`, `targetPath`, `target`, and `link` are not persisted schema fields in this contract. The supported navigation value is `path`; `payload` is an untyped `Mixed` field and its contents must not be guessed.

## Mutations and counts

- Mark one read: `PUT /api/notifications/mark-read`, body `{ notificationId }`
- Mark all read: `PUT /api/notifications/mark-read`, body `{ markAll: true }`
- Hide/dismiss for current user: `DELETE /api/notifications/:id`
- Unread count: `GET /api/notifications/count`, response `{ success, count }`
- Compatibility unread endpoint: `GET /api/notifications/unread`, returns up to 50 recent rows and `count`

Read and dismissed state is per-user; dismiss marks the notification read and adds the current user to `dismissed_by`. A missing mark-read ID returns HTTP 400; an unavailable/out-of-scope ID returns HTTP 404.

## Error behavior

- Unauthenticated requests are guarded by the backend auth middleware.
- Mutation handlers return the service error status when present.
- List/count route exceptions return HTTP 500.
- The complete auth error-code contract is owned by the mobile authenticated API client and must be reused rather than reimplemented here.

## Mobile implementation status

`EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API=false` remains the default. Mock mode continues to use the existing mock fixtures. If the flag is enabled on this branch, the mobile service fails explicitly because this branch does not contain the authenticated mobile API transport. It does not call an unauthenticated endpoint or silently fall back to mock data.

The real REST repository, authenticated transport wiring, mapper, mutations, pagination UI, and route resolver are not yet implemented on this branch. The auth client exists on `feature/mobile-auth-client-poc`, but is not an ancestor of the required schedule base commit `6769343271847ee8de99cc79fe951e70b4ee481d`.

## Out of scope

- Socket.IO realtime notifications
- Push / FCM / APNs
- Background notification behavior
- Native badge behavior
