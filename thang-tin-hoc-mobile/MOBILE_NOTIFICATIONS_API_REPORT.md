# MOBILE NOTIFICATIONS API REPORT

## Implementation status

- Branch: `feature/mobile-notifications-api`
- Starting HEAD for this integration checkpoint: `9765cfb73e380429fb3bd28ca6558b5d94ad59df`
- Scope: Mobile REST Notifications only; no Learning work started
- Feature flag: `EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API=false` by default
- Backend/Web/exam-bank files modified: none
- Socket.IO / push / FCM / APNs: not connected
- Production ready: `NO`

## Architecture findings

- Before the refactor, `mockService.ts` contained unauthenticated Notifications `fetch()` logic, silent mock fallback, and fake-success mutation handlers; those paths were removed.
- Screen: `NotificationsScreen` and the Home unread badge.
- Coordinator: `src/features/notifications/notificationService.ts` chooses the repository centrally using the default-off feature flag.
- Mock path: `notificationMockRepository` in `src/services/mockService.ts` reads Student/Teacher fixtures and applies local pagination/filters.
- `mockService.ts` still contains the pre-existing Schedule API integration; that Schedule code was not refactored as part of Notifications.
- Real path: `src/features/notifications/notificationApiRepository.ts` sends REST requests through the AuthContext request function; it does not call `fetch()` directly.
- Shared Auth transport: `mobileAuthService.request()` calls the existing `MobileAuthApi`, preserving bearer tokens, refresh/single-flight, CSRF for PUT/DELETE, and revoked-session handling.
- Real mode also requires `EXPO_PUBLIC_MOBILE_AUTH_POC=true` and a configured API base URL; otherwise the Auth Client fails explicitly without a mock fallback.
- Mapper: `src/features/notifications/notificationMapper.ts` maps backend rows to `AppNotification`; raw DB rows do not enter UI.
- Destination resolver: `src/features/notifications/notificationRouting.ts` routes only supported destinations; unknown and Web-only exam destinations stay in detail.
- API errors are surfaced; real mode does not silently fall back to mock.
- Expo Web QA found that `AppHeader` hid supplied right-side controls for Student notification screens. The header now shows those screen actions on `Notifications` and `NotificationCenter`, preserving the notification shortcut elsewhere.

## Test coverage and validation evidence

### Unit/service tests

- `npm run test:notifications`: PASS (9/9). Covers mock/real flag selection, mapper/type/category/read/unread, mock and backend pagination, duplicate removal while filtering, known/unknown/Web-only destinations, all three mutations, and API error/fail-closed behavior.
- `npm run test:auth`: PASS (17/17), including authenticated PUT support and the existing refresh, CSRF, single-flight, session invalidation, and storage regression cases.
- Profile/schedule test scripts are not configured in this mobile package; no such tests were found in the mobile test directory.

### Expo Web smoke

- Authenticated Expo Web QA used the real feature-flagged Notifications repository and the isolated test API (not mock notifications).
- Student: real login, Notifications and page navigation (20 + 4 visible after the integration suite's user-specific dismiss; backend pagination independently passed at 20 + 5), unread filter, mark-one, mark-all, dismiss, notification detail, known Schedule route, unknown-route detail retention, and EXAM Web-only messaging: PASS.
- Teacher: real login, 25-fixture pagination (20 + 5), and Schedule category filter: PASS.
- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS

### Isolated backend integration

- Command: `npm run test:notifications:integration` (with `MOBILE_TEST_BACKEND_ROOT` pointing to the separate auth-backend source worktree and `NODE_PATH` pointing to installed dependencies).
- Result: PASS; real Auth and Notifications route/middleware/model/service modules were mounted in an isolated Express test app. This was not a launch of production `server.js`.
- Test database: `dashboardthangtinhoc_mobile_notifications_test`; Mongo `127.0.0.1:27019`; Redis `127.0.0.1:6382`, database 15.
- Only the isolated test process enabled `MOBILE_MULTI_SESSION_AUTH=true`; disposable generated credentials were not written to the report.
- Fixtures: 3 disposable users (Student A, Student B for ownership isolation, Teacher) and 50 notifications (25 each for Student A and Teacher; one Student notification was shared with Student B).
- Student and Teacher login/list isolation: PASS. Pagination: page 1 = 20, page 2 = 5 with no duplicates or gaps; custom limit and totals/pages: PASS.
- All seven backend-supported type filters (`SYSTEM`, `COURSE`, `FINANCE`, `EVALUATION`, `MESSAGE`, `EXAM`, `SCHEDULE`): PASS. Student/Teacher unread filters and user-scoped count: PASS.
- Mark-one, mark-all, and dismiss mutations: PASS. Cross-user mark-read/dismiss returned 404; dismiss did not affect the other recipient: PASS.
- Missing CSRF rejected with 403; shared Auth refresh/retry with expired access token and revoked-session invalidation: PASS.
- Known Schedule route, unknown-path safe detail, and EXAM Web-only mapping: PASS.
- No requests were sent to protected Mongo/Redis ports `27017`, `6379`, or `6381`; no existing unrelated containers were changed.

### Native

- Android/iOS Notifications QA: `BLOCKED / NOT RUN`
- Native QA is a release gate, not an implementation commit blocker by itself.
- Socket.IO, push, FCM/APNs: not connected.

## Validation

- `npm run test:notifications`: PASS (9/9)
- `npm run test:auth`: PASS (17/17)
- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS
- `git diff --check`: PASS
- Profile/schedule tests: no mobile scripts/tests configured; not run
- `npm run test:notifications:integration`: PASS (isolated backend route/Auth integration and interactive Student/Teacher Expo Web QA)

## Readiness

- Mock Notifications mode: `PASS`
- Real Notifications REST client implementation and isolated backend integration: `PASS`
- Mobile Notifications API implementation: `READY`
- Expo Web authenticated Notifications QA: `PASS`
- Native Notifications QA: `BLOCKED / NOT RUN`
- Production ready: `NO`

## Release gates

- Perform native Android/iOS QA, including CSRF cookie behavior, app restart, and real SecureStore.
- This integration used a local isolated route/Auth harness, not the production `server.js`; full deployment/runtime validation remains outstanding.
- No Learning API work is included in this checkpoint.
