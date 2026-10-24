# Mobile Profile API Integration Report

## Implementation status

**PROFILE API IMPLEMENTATION READY** for authenticated Student and Teacher self-profile reads and updates.

- Branch: `feature/mobile-profile-api`
- Base: `a2493292779cf2a436ea3c3171494ce79c6f67d5`
- `EXPO_PUBLIC_MOBILE_PROFILE_API` defaults to `false`; demo Profile behavior remains the default.
- Real Profile API mode requires `EXPO_PUBLIC_MOBILE_PROFILE_API=true` and `EXPO_PUBLIC_MOBILE_AUTH_POC=true`.
- The Profile screen calls only the profile endpoints below. Other feature screens and their data remain mock-backed.
- No backend runtime contract or source was changed.

## API contract and field scope

| Role | Read endpoint | Update endpoint | Client update fields |
|---|---|---|---|
| Student | `GET /api/students/:id` | `PUT /api/students/:id` | `email`, `zalo`, `address` |
| Teacher | `GET /api/teachers/:id` | `PUT /api/teachers/:id` | `email`, `zalo`, `bio`, `voiceRegion`, `address`, `age` |

- IDs come from the authenticated user; each role uses its own endpoint, and the server enforces self-access.
- Student read data is mapped to the Profile view model; Teacher read data is likewise narrowed. Credentials, salary, ratings, tuition, payment totals, and unrelated fields are not copied into the client model. The Teacher's own bank-account number is displayed from the existing Profile response only.
- The Student update allowlist is narrower than the server allowlist: no password, avatar, or gender is sent.
- Teacher updates use only fields supported for teacher self-edit. Password changes, avatar uploads, and bank-account updates remain unconnected.
- Student course text is read from the Student profile response only; no course, learning, tuition, or payment endpoint is called.
- API failures remain errors. There is no mock-data fallback in real mode; the screen offers retry, preserves already loaded data after a failed update, and displays server/auth errors.

## Authentication and security

- The Profile client uses the Mobile Auth service's authenticated request method; it does not manage or persist tokens itself.
- Requests reuse bearer access tokens, CSRF handling, refresh rotation, single-flight refresh, retry, and revoked-session cleanup.
- `PUT` is treated as a CSRF-protected mutation by the existing Mobile Auth transport.
- Browser token persistence was not added. The prior Web memory-only session behavior remains unchanged.
- Profile API error responses are surfaced; no success-shaped fallback is used.

## Validation

| Check | Result |
|---|---|
| `npm run test:profile` | PASS — 8/8 |
| `npm run test:auth` | PASS — 16/16 |
| `npm run test:profile:integration` | PASS — actual Student/Teacher endpoints, login, CSRF mutations, self-access isolation, update allowlists, and error handling against isolated MongoDB/Redis |
| `npm run typecheck` | PASS |
| `npx expo install --check` | PASS |
| `npx expo export --platform web` | PASS |
| `git diff --check` | PASS |

The API integration used only `127.0.0.1:27019` (`dashboardthangtinhoc_mobile_auth_test`) and `127.0.0.1:6382`. `MOBILE_MULTI_SESSION_AUTH=true` was set only in the integration-test process. Runtime MongoDB/Redis ports and production APIs were not used.

## Native and release gates

- Native Profile QA: **NOT RUN**. No Android/iOS device or native runtime was used.
- Android/iOS SecureStore, native CSRF cookie behavior, native fetch credential behavior, process restart, background/foreground, and native keyboard/modal behavior remain unverified.
- Expo Web export verifies bundling; it does not certify native behavior or production readiness.
- Production readiness: **NO**.

## Out of scope

Schedules, learning, assignments, feed/news, chat, realtime notifications, finance/payment, file uploads, Socket.IO, and exams remain unintegrated. No backend runtime, website, question bank, or exam code was modified.
