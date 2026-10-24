# Mobile Auth Git Isolation Report

## Source and destination

- Source worktree: `DASHBOARDTHANGTINHOC-fresh`
- Source branch: `feature/mobile-native-qa`
- Source HEAD/base: `6d4b182ef79fc22891effcac2fe05239e04db926`
- Destination worktree: `DASHBOARDTHANGTINHOC-auth-clean`
- Destination branch: `feature/mobile-auth-backend-validation`
- Destination base: `6d4b182ef79fc22891effcac2fe05239e04db926`

The source worktree was not switched, reset, stashed, cleaned, committed, or staged. Its existing staged Native QA report was left untouched.

## Isolation manifest

### Existing tracked files reconstructed by reviewed diff hunks (8)

| File | Mobile Auth scope |
| --- | --- |
| `.env.example` | Add `MOBILE_MULTI_SESSION_AUTH=false` default |
| `.env.test.example` | Isolated mobile-auth test database, Redis 6382, flag OFF |
| `middleware/auth.js` | Gate and validate mobile `sid` sessions |
| `middleware/socketAuth.js` | Validate mobile sessions/accounts at Socket.IO handshake |
| `routes/authRoutes.js` | Mobile login, refresh rotation, logout, session list/revoke, security-event revocation |
| `routes/studentRoutes.js` | Revoke mobile sessions on account disable/delete/lock |
| `routes/teacherRoutes.js` | Revoke mobile sessions on account disable/suspend/delete |
| `server.js` | Join `session:<sid>` and keep mobile sockets from overwriting legacy single-socket presence |

Each changed hunk in these files was reviewed. The existing-file diffs contained no unrelated feature hunks. The login-attempt lines removed from `authRoutes.js` were the old direct increment calls replaced by the feature's helper, which increments attempts and revokes mobile sessions on Teacher lockout.

### Reviewed new files copied whole (13)

1. `config/mobileMultiSessionAuth.js`
2. `models/AuthSession.js`
3. `services/mobileAuthSessionService.js`
4. `services/mobileAuthSessionSecurity.js`
5. `docker-compose.mobile-auth-test.yml`
6. `tests/integration/mobile_auth_session_mongo.test.js`
7. `tests/integration/mobile_auth_backend.test.js`
8. `tests/unit/mobile_auth_session_routes.test.js`
9. `tests/unit/mobile_auth_session_security.test.js`
10. `tests/unit/mobile_auth_session_service.test.js`
11. `MOBILE_AUTH_BACKEND_VALIDATION.md`
12. `MOBILE_AUTH_INTEGRATION_CONTRACT.md`
13. `MOBILE_AUTH_INTEGRATION_TEST.md` (explicitly marked historical)

The 13 files were content-hash compared with their reviewed source copies after transfer.

## Excluded changes and dependencies

- `client/src/components/FloatingMessenger.jsx` — pre-existing unrelated UI change; excluded.
- `thang-tin-hoc-mobile/MOBILE_NATIVE_QA_REPORT.md` — pre-existing staged Mobile Native QA report; excluded and not unstaged.
- `routes/studentRoutes.js` / `routes/teacherRoutes.js` — only the session-revocation hunks were transferred; all surrounding feature changes were excluded.
- No exam-bank source, Phase15 exam tests, Mobile client, unrelated web/runtime source, or secrets were copied.
- No unrelated dirty-code dependency was found in the transferred Auth hunks.

## Test environment

- MongoDB: isolated Docker test service at `127.0.0.1:27019`, database `dashboardthangtinhoc_mobile_auth_test`.
- Redis: isolated Docker test service at `127.0.0.1:6382`.
- Redis ports `6379` and `6381`, and MongoDB port `27017`, are out of bounds and must not be contacted.
- `MOBILE_MULTI_SESSION_AUTH` remains false by default; tests enable it only within their test process.
- Test services are defined in `docker-compose.mobile-auth-test.yml`. Do not use or reset production services.

## Results

Clean-worktree rerun completed on 2026-10-24:

| Gate | Result |
| --- | --- |
| Mobile-auth unit tests | 12/12 PASS |
| MongoDB session integration | 1/1 PASS |
| HTTP/Socket.IO backend integration | 11/11 PASS |
| Focused ESLint for mobile-auth implementation files | PASS |
| ESLint regression check for modified existing files | No new diagnostics versus base |
| `node --check routes/teacherRoutes.js` | PASS |
| `git diff --check` | PASS |
| Targeted secret scan | No matches |

Node dependencies were reused from the source worktree through `NODE_PATH`; no package manifest or lockfile was changed. The dedicated MongoDB and Redis services were used only on loopback ports `27019` and `6382`.

The Phase15 result remains a historical, out-of-scope precheck: 27/28 PASS, one exam-bank-dependent test returned `EXAM_BANK_UNAVAILABLE` (503). No exam-bank code or tests were changed or rerun.
