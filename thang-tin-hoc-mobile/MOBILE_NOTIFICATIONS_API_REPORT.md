# MOBILE NOTIFICATIONS API REPORT

## Implementation status

- Branch: `feature/mobile-notifications-api`
- Previous/base HEAD: `6769343271847ee8de99cc79fe951e70b4ee481d`
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

## Test coverage and validation evidence

### Unit/service tests

- `npm run test:notifications`: PASS (9/9). Covers mock/real flag selection, mapper/type/category/read/unread, mock and backend pagination, duplicate removal while filtering, known/unknown/Web-only destinations, all three mutations, and API error/fail-closed behavior.
- `npm run test:auth`: PASS (17/17), including authenticated PUT support and the existing refresh, CSRF, single-flight, session invalidation, and storage regression cases.
- Profile/schedule test scripts are not configured in this mobile package; no such tests were found in the mobile test directory.

### Expo Web smoke

- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS
- Expo Web export validates bundling only; it is not evidence of authenticated Notifications API integration against a running backend.

### Isolated backend integration

- Notifications endpoint integration against a running isolated backend: `NOT RUN`
- Test ports `27019`, `6382`, and `8081` were free at inspection; unrelated existing Docker services on ports `6379` and `6381` were not touched.
- Do not report `NOTIFICATIONS BACKEND INTEGRATION PASS`.

### Native

- Android/iOS Notifications QA: `BLOCKED / NOT RUN`
- Native QA is a release gate, not an implementation commit blocker by itself.

## Validation

- `npm run test:notifications`: PASS (9/9)
- `npm run test:auth`: PASS (17/17)
- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS
- `git diff --check`: PASS
- Profile/schedule tests: no mobile scripts/tests configured; not run
- Isolated Notifications backend integration: `NOT RUN`

## Readiness

- Mock Notifications mode: `PASS`
- Real Notifications REST client implementation: `PASS` (feature-flagged and uses shared authenticated transport; backend integration remains unverified)
- Mobile Notifications API implementation: `READY`
- Expo Web QA: `PASS` for build/export only; authenticated backend integration not claimed
- Native Notifications QA: `BLOCKED / NOT RUN`
- Production ready: `NO`

## Release gates

- Run disposable Student and Teacher notification integration tests against an isolated backend.
- Perform native Android/iOS QA, including CSRF cookie behavior, app restart, and real SecureStore.
- No Learning API work is included in this checkpoint.
