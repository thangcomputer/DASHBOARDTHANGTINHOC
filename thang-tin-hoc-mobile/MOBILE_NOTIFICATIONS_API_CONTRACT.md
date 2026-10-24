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

`EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API=false` remains the default. Mock mode continues to use the existing mock fixtures. If real mode is enabled without the authenticated request callback, the service fails explicitly; it does not call an unauthenticated endpoint or silently fall back to mock data.

The Notifications REST repository now uses the authenticated request exposed by the integrated Mobile Auth Client. Real mode also requires `EXPO_PUBLIC_MOBILE_AUTH_POC=true` and a configured API base URL; otherwise the Auth Client fails explicitly without a mock fallback. The Auth Client supplies bearer access tokens, refresh/single-flight behavior, CSRF for mutations, and revoked-session cleanup. List, server pagination, type/unread filters, read-only pagination, mark-one, mark-all, and per-user dismiss are implemented in the mobile feature layer.

Backend rows are mapped from the actual response fields (`id`, `type`, `title`, `content`, `createdAt`, `read`, `payload`, and `path`). Unknown types map to `Khác`; unknown routes remain in notification detail. `EXAM` destinations remain Web-only.

## Out of scope

- Socket.IO realtime notifications
- Push / FCM / APNs
- Background notification behavior
- Native badge behavior
