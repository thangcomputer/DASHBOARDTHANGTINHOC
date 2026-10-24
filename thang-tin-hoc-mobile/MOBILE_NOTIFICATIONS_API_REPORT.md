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

- `NotificationsScreen` calls `notificationService` from `src/services/mockService.ts`.
- Before this review, `mockService.ts` contained a direct unauthenticated `fetch()` for real notifications and caught errors by falling back to mock data. It also exposed mutation methods that returned success without making requests.
- The required shared authenticated mobile API client is not present on the schedule base commit. The mobile Auth Client files exist on `feature/mobile-auth-client-poc`, which is not an ancestor of this branch.
- The direct fetch, silent fallback, and fake-success mutation methods have been removed from `mockService.ts`.
- Current behavior:
  - Flag OFF: mock notifications and mock UI interactions remain available.
  - Flag ON: the service fails explicitly with an authenticated-transport-unavailable error; no request is made and no mock fallback occurs.
- There is no functioning Notifications REST path on this branch yet. The API contract is documented separately in [MOBILE_NOTIFICATIONS_API_CONTRACT.md](./MOBILE_NOTIFICATIONS_API_CONTRACT.md).

## Test coverage and validation evidence

### Unit/service tests

- `npm run test:notifications`: PASS (1/1). Covers mock mode selection and explicit failure when real mode is enabled without authenticated transport.
- No mapper, route resolver, API repository, or real mutation service remains implemented here to test.
- `npm run test:auth`, `npm run test:profile`, and schedule test scripts are not defined in this mobile package.
- No backend integration test was run for the Notifications endpoints.

### Expo Web smoke

Validation of the mobile project is reported separately below. Expo Web export is not evidence that authenticated Notifications REST requests work.

### Native

- Android/iOS Notifications QA: `BLOCKED / NOT RUN`
- Native QA is a release gate, not an implementation commit blocker by itself.

## Validation

- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS
- `git diff --check`: PASS
- Auth/profile/schedule test commands: not configured in the mobile package; not run
- Notification service regression: `1/1 PASS` (mock/default and fail-closed real flag behavior only)
- Isolated Notifications backend integration: `NOT RUN`

## Readiness

- Mock Notifications mode: `PASS` (mock-data path retained; no focused regression test available)
- Real Notifications REST mode: `NOT READY` (authenticated mobile transport absent on this base)
- Mobile Notifications API implementation: `NOT READY`
- Expo Web QA: `PASS` for export/build only; not authenticated API integration evidence
- Native Notifications QA: `BLOCKED / NOT RUN`
- Production ready: `NO`

## Required next prerequisite

Integrate the already validated mobile Auth Client into this schedule-based branch (or create a new base that contains it), expose/reuse its authenticated request method, and then implement Notifications API/mock repositories, service selection, mutations, route resolution, and focused tests. Do not reintroduce direct `fetch()` in `mockService.ts` or mock success responses for real mutations.
