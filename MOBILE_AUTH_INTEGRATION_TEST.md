# Mobile Auth Multi-Device — Historical Integration Precheck

> Historical snapshot: this report records the earlier blocked precheck on Redis port `6381`. The current isolated validation used Redis `6382` and is documented in [MOBILE_AUTH_BACKEND_VALIDATION.md](./MOBILE_AUTH_BACKEND_VALIDATION.md), with the client-facing contract in [MOBILE_AUTH_INTEGRATION_CONTRACT.md](./MOBILE_AUTH_INTEGRATION_CONTRACT.md).

**Historical result: `TEST PORT CONFLICT`**
**Current readiness: see the latest validation report linked above.**

## Integration execution after Docker daemon became available

- Docker Desktop was registered as installed at `C:\Users\thang\AppData\Local\Programs\DockerDesktop`; the existing application was started without changing Docker settings.
- Docker engine became available and `docker info` reported server version `29.8.1`; Compose reports `v5.5.1`.
- The dedicated test Compose file is [docker-compose.mobile-auth-test.yml](./docker-compose.mobile-auth-test.yml). Its configuration validation passed. It uses the project-local candidate images `mongo:7` and `redis:7-alpine`, binds only Mongo `127.0.0.1:27019` and Redis `127.0.0.1:6381`, and uses a test-only named Mongo volume. These are not confirmed production versions.
- Before launching any test container, the required port check found a listener on `6381`. In accordance with the safety gate, execution stopped immediately. The listener was not inspected or stopped; no test stack was launched. Mongo test port `27019` had no listener in the same check.
- No test database was created or connected to. No Redis command was sent to either Redis endpoint.

| Test | PASS | FAIL | NOT RUN | Severity | Notes |
|---|:---:|:---:|:---:|---|---|
| Docker daemon | ✓ |  |  | — | Docker Desktop was started; Docker server `29.8.1` responded. |
| Test Compose syntax | ✓ |  |  | — | `docker compose -p thang-mobile-auth-test -f docker-compose.mobile-auth-test.yml config --quiet`. |
| Mongo test container / version / port |  |  | ✓ | HIGH | Not started because Redis test port conflict gates stack startup. Candidate image is `mongo:7`; runtime production version remains unknown. |
| Redis test container / version / port |  |  | ✓ | HIGH | Not started. Port `6381` was occupied; listener was left untouched. Candidate image is `redis:7-alpine`. |
| Mongo indexes and duplicate rejection |  |  | ✓ | HIGH | Mongo integration test not run. |
| Concurrent CAS exactly-one-winner |  |  | ✓ | HIGH | No real MongoDB test executed. |
| Student/Teacher mobile login and denied cases |  |  | ✓ | HIGH | No isolated API/database fixture. |
| Web + Android + iOS coexistence / refresh / logout isolation |  |  | ✓ | HIGH | No database-backed clients or API fixture. |
| Ownership and security-event revoke |  |  | ✓ | HIGH | No database-backed API test. |
| Socket revoke / Redis multi-instance |  |  | ✓ | HIGH | No Redis test service or two-server test. |
| CSRF integration |  |  | ✓ | MEDIUM | Prior isolated regression is not this requested database-backed test. |
| Flag OFF web legacy regression |  |  | ✓ | HIGH | Full web login/refresh/logout/`/me`/Socket.IO matrix not run. |
| Exam / presence live regression |  |  | ✓ | MEDIUM | No safe fixture or live test; exam code was not changed. |
| Cleanup | ✓ |  |  | — | No test containers or test data were created; no unrelated resource was stopped. |

## 1. Test infrastructure

Docker CLI (`29.8.1`), Docker Compose (`v5.5.1`), and Docker Desktop are installed. The daemon was initially unavailable; after starting the existing Docker Desktop application, the engine became available. The isolated test stack was not started because port `6381` was occupied at the required preflight check. The production/local `docker-compose.yml` was not started or changed.

| Component | Planned test target | Actual status |
|---|---|---|
| MongoDB | `127.0.0.1:27019` | **NOT RUN**; test container was not started because the Redis test port preflight failed. No `mongod`/`mongosh` executable is available on the host. |
| Test database | `dashboardthangtinhoc_phase15_test` | **NOT CREATED/TOUCHED**. |
| Redis | `127.0.0.1:6381` | **NOT RUN**; the required port was already occupied at preflight. A Redis executable is installed, but no separate test instance was started. |
| Existing MongoDB `27017` | Do not touch | Not connected to, queried, inspected, modified, or tested. |
| Existing Redis `6379` | Do not touch | Not connected to, queried, inspected, modified, or tested. |

The repository's local compose configuration specifies `mongo:7` and `redis:7-alpine`. The isolated test compose file uses these project-local candidate versions; no image was started, and the production deployment's exact MongoDB and Redis versions remain unverified.

## 2. Environment and safety guards

- `.env.test.example` now points Redis to `redis://127.0.0.1:6381`; it contains no production credentials.
- The mobile Mongo integration test requires `NODE_ENV=test`, loopback Mongo host `127.0.0.1`, port `27019`, database `dashboardthangtinhoc_phase15_test`, and loopback Redis host `127.0.0.1`, port `6381`. It aborts before connecting if these values differ.
- The existing database guard also requires an explicit `TEST_DATABASE_URI` and a test-named database; it does not fall back to `MONGODB_URI`.
- No integration test was started because the required Redis test port was occupied.

## 3. Results

| # | Requirement | Result | Evidence / reason |
|---:|---|---|---|
| 1 | MongoDB version and port | **NOT RUN** | No test Mongo container/process was started; actual deployment version is unknown. |
| 2 | Redis version and port | **NOT RUN** | Port `6381` was occupied, so no test Redis instance was started; actual deployment version is unknown. |
| 3 | Test database | **NOT RUN** | Database was not created or connected. |
| 4 | Unique `sessionId` index and duplicate rejection | **NOT RUN** | Requires MongoDB integration. |
| 5 | Compound and TTL indexes | **NOT RUN** | Requires MongoDB integration. |
| 6 | Expiry, owner/role scoping, list, revoke and revoke-all | **NOT RUN** | Requires MongoDB integration. |
| 7 | Concurrent refresh CAS, exactly one winner | **NOT RUN** | Requires MongoDB integration; no claim is made about real Mongo concurrency. |
| 8 | Student and Teacher mobile login; Admin/Staff denial; invalid credentials/platform/status | **NOT RUN** | No isolated API/database fixture was started. |
| 9 | Web + Android + iOS coexistence and refresh isolation | **NOT RUN** | No API integration fixture or mobile clients were run. |
| 10 | Android/iOS logout isolation and legacy web logout isolation | **NOT RUN** | Requires a database-backed API test. |
| 11 | Password/reset/lock/suspend/delete security-event revoke | **NOT RUN** | Existing unit tests of the revocation helper are not database/API integration evidence. |
| 12 | Socket revoke and Redis multi-instance fan-out | **NOT RUN** | No Redis test instance or paired Socket.IO servers were started. Redis memory fallback remains local-process-only, not distributed-safe. |
| 13 | CSRF integration | **NOT RUN in this task** | Previous isolated CSRF regression tests passed, but they were not database-backed mobile auth integration. |
| 14 | Feature-flag OFF legacy web regression | **NOT RUN in this task** | Previous unit tests covered mobile route flag-off behavior; web Student/Teacher login, refresh, logout, `/me`, and legacy Socket.IO were not exercised here. |
| 15 | Exam regression | **NOT RUN** | No safe database fixture was started; exam/camera were not changed. |
| 16 | Presence regression | **NOT RUN in this task** | Previous source-level presence tests passed; no live Socket.IO regression was run here. Multi-device aggregate presence remains a known limitation. |
| 17 | Cleanup | **NOT REQUIRED** | No test containers, database, or Redis instance were created; no other service was stopped or cleaned up. |

## 4. Remaining risks and readiness gate

- Mongo index provisioning and real compare-and-swap behavior have not been verified.
- Student/Teacher mobile login and legacy/mobile coexistence have not been verified against isolated fixtures.
- Socket disconnection across server instances is unverified. If the Redis adapter falls back to memory, room disconnection is limited to the local process.
- Presence still does not aggregate multiple devices; mobile-only online status is not fully represented.
- No critical failure was observed because the required integration tests did not run. This is **not** a passing security result.
- Do not enable `MOBILE_MULTI_SESSION_AUTH` based on this report.

## 5. Required next step

Start the Docker Desktop Linux engine or provide an approved isolated MongoDB and Redis test environment at the exact guarded endpoints. Then start only dedicated test infrastructure, run the Mongo integration test plus database-backed auth/CSRF/socket regressions, and update this report with observed versions and results.

**Final readiness: `NOT READY FOR MOBILE CLIENT POC`**
