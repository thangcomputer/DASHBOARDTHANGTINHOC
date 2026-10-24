# Mobile Auth Client POC Report

## Scope

- Branch: `feature/mobile-auth-client-poc`
- Base commit: `9489d00e7e5112d72d54e8e3a3fcddb3a9f2aae2`
- Target platforms: Android and iOS. Expo Web is a development/smoke-test surface, not a production auth target.
- Mobile Auth remains behind `EXPO_PUBLIC_MOBILE_AUTH_POC`; the default is OFF and demo login remains available.
- No business API, Mobile Socket.IO client, payment, push, file-transfer, or native-exam integration was added.
- The backend auth contract was not changed.

## Implementation status

**READY**

- Auth client unit tests: PASS — 16/16.
- Mongo session integration: PASS — 1/1.
- HTTP/Socket.IO backend integration: PASS — 11/11.
- Student and active Teacher real login: PASS.
- Invalid credentials, CSRF, refresh/rotation, refresh race/replay, session isolation, session revoke, and logout: PASS.
- Single-flight refresh: multiple concurrent expired requests share exactly one refresh call.
- AuthProvider starts in `initializing` when real auth is enabled and leaves that state only when restore completes; the navigator renders a loading screen during initialization.
- Auth-only states are labeled `AUTH = REAL · FEATURE DATA = MOCK`; business feature data remains mock data.
- No Mobile Socket.IO client or business API integration is present.

## Expo Web smoke status

**PASS WITH MEMORY-ONLY SESSION**

- Student login, active Teacher login, invalid-password rejection, and Teacher logout were exercised in the browser against the isolated local POC backend.
- Demo auth mode was exercised with the POC flag disabled and still opened the existing sample Student dashboard.
- CSRF token acquisition and retry after one `CSRF_INVALID` were verified in Web smoke/unit coverage.
- A Web full-page reload loses the auth session and returns to Login. This is **SESSION LOST BY DESIGN** for the Web POC; Web is not the persistent-auth target.

## Native QA status

**BLOCKED / NOT RUN**

- `adb`, Android SDK environment paths, emulator command, and native device/emulator are unavailable in this environment. No SDK or emulator was installed.
- Real SecureStore behavior on Android/iOS, app restart and process-death restore, native cookie persistence, and native navigation/input behavior have not been verified.
- `NATIVE CSRF COOKIE FLOW = NOT VERIFIED`. The client sends `credentials: 'include'` and `X-CSRF-Token`; passing browser cookie behavior does not establish React Native cookie-jar behavior.

### Native auth checklist

Run on Android and iOS when devices/builds are available:

1. Clean install.
2. Student login.
3. Kill and reopen the app.
4. Confirm session restore.
5. Access a protected auth endpoint.
6. Confirm refresh-token rotation and persisted replacement.
7. Background and foreground the app.
8. Logout.
9. Reopen after logout and confirm Login is shown.
10. Confirm logging out one session does not invalidate a second session.
11. Confirm invalid/revoked sessions are cleared and return to unauthenticated state.
12. Verify CSRF cookie/header flow after app restart.

## Security/storage status

- Native auth storage is abstracted behind `saveAuth()`, `loadAuth()`, and `clearAuth()`; screens and auth service do not call SecureStore directly.
- Native uses `expo-secure-store` for the refresh token, session ID, and minimal user identity. Access token and CSRF token remain in memory; passwords are never persisted.
- Expo Web stores auth session data in memory only. No `localStorage`, `sessionStorage`, or plain AsyncStorage token persistence is used.
- SecureStore mock tests cover missing values, write/read, replacement after refresh rotation, clear, corrupted JSON, invalid state, restore, invalid refresh cleanup, secure-write failure, and native runtime selection when a `window` global is present.
- Restore flow test covers stored refresh → CSRF acquisition → refresh → rotated refresh persisted → protected request authenticated with the new access token.
- Refresh commits the new access token and in-memory session only after the rotated refresh token has been saved. If secure persistence fails, local auth is cleared and no authenticated state is retained.
- Single-flight refresh behavior remains covered by a concurrent-request test.
- Logout clears local auth even if the server logout request fails.

### Remaining release gates

- Real SecureStore on Android and iOS.
- Restore after app restart and process death.
- Android/iOS cookie-jar behavior for CSRF, including native `fetch` credentials and CSRF after restart.
- Keyboard and login UX on native devices.
- Background/foreground and platform-specific lifecycle behavior.
- Native second-session isolation and revoked-session behavior.

## Validation

| Check | Result |
|---|---|
| `npm run test:auth` | PASS — 16/16 |
| Mongo session integration | PASS — 1/1 |
| HTTP/Socket.IO integration | PASS — 11/11 |
| `npm run typecheck` | PASS |
| `npx expo install --check` | PASS |
| `npx expo export --platform web` | PASS |
| `git diff --check` | PASS |

TypeScript excludes Expo's generated `dist` and `web-build` folders so Web export bundles are not included in source typechecking.

Backend integration used only the dedicated loopback Mongo `127.0.0.1:27019`, database `dashboardthangtinhoc_mobile_auth_test`, and Redis `127.0.0.1:6382`. `MOBILE_MULTI_SESSION_AUTH=true` was scoped to the isolated POC process. Disposable fixtures were removed. The POC backend, Expo server, and dedicated test containers were stopped afterward; the Mongo test volume was preserved. Protected ports 27017, 6379, and 6381 were not used.

## Final readiness

**MOBILE AUTH CLIENT IMPLEMENTATION READY — NATIVE QA BLOCKED**

**EXPO WEB AUTH SMOKE PASS**

**PRODUCTION READY = NO**
