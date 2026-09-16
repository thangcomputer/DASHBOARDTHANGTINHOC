# LMS THẮNG TIN HỌC
# SOURCE CODE VERIFICATION AUDIT

## 1. Scope

This audit is based on direct source verification in the current repository only. It does not rely on prior audit artifacts as final proof. Prior reports are treated as background context only.

Scope reviewed:
- Runtime entrypoint and startup flow
- Route mounting tree
- Database connection and persistence
- Destructive operations and reset flows
- Authentication and authorization checks
- Branch / tenant isolation patterns
- Backup and restore implementation
- File upload and download security
- Frontend token storage and URL handling
- Deployment and infrastructure settings
- Test and script risks

Important constraint: no code was changed, no data was reset, no migration was run, no database was modified.

## 2. Repository Inventory

### 2.1 Counting rules and totals

The inventory was counted directly from the current working tree before this report update:

| Inventory | Files | Directories | Counting rule |
|---|---:|---:|---|
| Entire repository working tree | 3,699 | 929 | Includes application code, documentation, tests, scripts, artifacts, assets, and deployment files; excludes internal `.git` metadata |
| Source/config inventory | 2,612 | 767 containing source/config files | Includes executable code and configuration extensions: `.js`, `.jsx`, `.cjs`, `.mjs`, `.json`, `.yml`, `.yaml`, `.sh`, `.py`, `.css`, `.ps1`, `.bat`, `.html`, `.conf` |
| Documentation and audit files | 999 Markdown files | Included in repository total | Separated from source/config count so documentation is not mistaken for executable code |
| Artifact files | 53 files | 4 artifact subdirectories | Evidence and generated audit artifacts; included in repository total but not treated as runtime code |

The counts are repository inventory counts, not production-runtime counts. In particular, the source inventory includes `modules/`, scripts, tests, and deployment code even when a route or module is not mounted by `server.js`. The report separately labels active runtime code versus unmounted, legacy, test, or operational code.

The current working tree did not contain a `node_modules` directory. Generated folders such as build output, coverage, uploads, and backups are excluded from the source/config definition when present; they are not counted as application source.

### 2.2 Top-level source and operational areas

| Directory | Files | Subdirectories | Audit role |
|---|---:|---:|---|
| `client/` | 381 | 30 | React/Vite frontend |
| `modules/` | 1,113 | 774 | Feature modules; several are not mounted in the live runtime |
| `shared/` | 279 | 55 | Shared application code and contracts |
| `tests/` | 245 | 10 | Automated and integration tests |
| `scripts/` | 135 | 1 | Maintenance, seed, migration, and QA scripts |
| `services/` | 101 | 5 | Backend business and infrastructure services |
| `middleware/` | 80 | 0 | Authentication, authorization, upload, and request middleware |
| `deploy_scripts/` | 62 | 0 | Deployment and operations scripts |
| `models/` | 56 | 0 | Mongoose data models |
| `routes/` | 38 | 0 | Express route handlers |
| `utils/` | 33 | 0 | Backend and frontend utility code |
| `config/` | 15 | 1 | Database, environment, security, and runtime configuration |
| `test_scripts/` | 10 | 0 | Direct API/auth test scripts |
| `infrastructure/` | 7 | 7 | Nginx and infrastructure configuration |
| `constants/` | 3 | 0 | Shared constants |
| `deployment/` | 3 | 0 | Deployment manifests |
| `deploy/` | 2 | 0 | Deployment helpers |
| `.github/` | 2 | 1 | CI/workflow configuration |
| `bootstrap/` | 1 | 0 | Bootstrap initialization |

The root also contains 85 files, including `server.js`, `worker.js`, Dockerfiles, Compose files, package manifests, environment examples, migration helpers, and audit/report documents. The totals above intentionally do not add up to the repository total because documentation, artifacts, root files, and other non-source assets are reported separately.

### 2.3 Source-code breakdown by extension

| Extension | Files |
|---|---:|
| `.js` | 2,185 |
| `.jsx` | 231 |
| `.cjs` | 117 |
| `.json` | 49 |
| `.yml` | 10 |
| `.sh` | 6 |
| `.py` | 3 |
| `.yaml` | 2 |
| `.mjs` | 2 |
| `.ps1` | 2 |
| `.css` | 2 |
| `.html` | 1 |
| `.bat` | 1 |
| `.conf` | 1 |
| **Total source/config files** | **2,612** |

### 2.4 Backend
- `server.js` — main runtime entrypoint and HTTP server
- `routes/` — live API endpoint definitions
- `middleware/` — auth, rate limit, policy, CSRF, uploads, request context
- `models/` — Mongoose schemas
- `services/` — business logic, backup, queue, notifications, finance, exam, AI
- `config/` — DB, env validation, logger, socket, performance, security config
- `utils/` — validation, identity, tokens, phone normalization, file processing
- `scripts/` — maintenance, QA, seed, patch, cleanup, restore scripts
- `tests/` — unit/integration/QA scripts
- `bootstrap/` — bootstrap logic
- `deploy/`, `deployment/`, `deploy_scripts/` — deployment and Ops automation

### 2.5 Frontend
- `client/src/App.jsx` — app shell and routers
- `client/src/components/` — UI pages and feature components
- `client/src/context/` — data/context providers
- `client/src/hooks/` — React hooks
- `client/src/services/api.js` — API client and token auth handling
- `client/src/utils/` — media/file/export helpers, proctor utilities
- `client/public/` — static assets

### 2.6 Infrastructure
- `Dockerfile`, `Dockerfile.prod`, `docker-compose.yml`, `docker-compose.prod.yml`
- `deployment/docker-compose.yml`, `deployment/k8s-deployment.yaml`
- `infrastructure/nginx/nginx.conf`
- `.github/workflows/*`
- `scripts/backup-mongo.sh`, `restore_backup.js`, `deploy_scripts/*`
- `ecosystem.config.cjs`

### 2.7 Legacy, module, and unmounted code
- `modules/` contains additional route/service implementations, but direct inspection confirms they are not mounted by the runtime `server.js` route tree.
- These are therefore not production security boundaries unless explicitly mounted later.

## 3. Runtime Architecture

### 3.1 Runtime entrypoint
Verified in `server.js`:
- `dotenv.config()` is called unless `NODE_ENV === 'test'`
- `require('./config/validateEnv')()` is called immediately
- `connectDB()` is loaded from `./config/db`
- Express app starts and mounts API routes under `/api/*`

Key file evidence:
- `server.js` lines around top: `require('./config/validateEnv')();`
- `server.js` lines around route mounts: `app.use('/api/auth', authRoutes); ... app.use('/api/cert-prep', certPrepRoutes);`

### 3.2 DB connection
Verified in `config/db.js`:
- `mongoose.connect(resolveDatabaseUri())`
- In production/test, environment validation is enforced before DB connection
- `ensureIndexes()` is invoked asynchronously
- `tenantService.ensureDefaultTenant()` is invoked asynchronously

Evidence:
- `config/db.js`: `const conn = await mongoose.connect(resolveDatabaseUri());`
- `config/db.js`: `ensureIndexes().catch(...)`

### 3.3 Live route tree
Verified in `server.js` by the mounted routes.

| Route prefix | File | Status | Notes |
|---|---|---|---|
| `/api/auth` | `routes/authRoutes.js` | LIVE | Login, refresh, logout, OAuth-related auth endpoints |
| `/api/students` | `routes/studentRoutes.js` | LIVE | Student operations |
| `/api/invoices` | `routes/invoiceRoutes.js` | LIVE | Invoice APIs |
| `/api/messages` | `routes/messageRoutes.js` | LIVE | Messaging |
| `/api/schedules` | `routes/scheduleRoutes.js` | LIVE | Schedule APIs |
| `/api/courses` | `routes/courseRoutes.js` | LIVE | Courses |
| `/api/teachers` | `routes/teacherRoutes.js` | LIVE | Teachers |
| `/api/assignments` | `routes/assignmentRoutes.js` | LIVE | Assignments |
| `/api/quizzes` | `routes/quizRoutes.js` | LIVE | Quiz APIs |
| `/api/evaluations` | `routes/evaluationRoutes.js` | LIVE | Evaluations |
| `/api/exam-results` | `routes/examResultRoutes.js` | LIVE | Exam results |
| `/api/settings` | `routes/settingsRoutes.js` | LIVE | Settings and reset-data |
| `/api/webhooks` | `routes/webhookRoutes.js` | LIVE | Webhooks |
| `/api/files` | `routes/fileRoutes.js` | LIVE | File operations |
| `/api/backups` | `routes/backupRoutes.js` | LIVE | Backup operations |
| `/api/monitoring` | `routes/monitoringRoutes.js` | LIVE | Monitoring |
| `/api/ai` | `routes/aiRoutes.js` | LIVE | AI endpoints |
| `/api/bi` | `routes/biRoutes.js` | LIVE | BI endpoints |
| `/api/finance` | `routes/financeRoutes.js` | LIVE | Finance |
| etc. | ... | LIVE | more route prefixes follow |

### 3.4 Unmounted or scaffold code
Direct search confirms `modules/**` route files exist, but they are not mounted in `server.js` as `app.use(...)` calls. That means they are not an active production security boundary unless explicitly wired in future.

Evidence: search in `modules/` showed route definitions such as `modules/chat/routes/messageRoutes.js`, `modules/blog/routes/blogRoutes.js`, `modules/support/support.routes.js`, but no corresponding `app.use(...)` to those modules in `server.js`.

## 4. Previous Audit Verification

| ID | Prior issue | Status | Evidence |
|---|---|---|---|
| DB-001 | Data reset endpoint | CONFIRMED | `routes/settingsRoutes.js` contains `router.post('/reset-data', ...)` and multiple `deleteMany({})` calls |
| DB-002 | Backup restore clears data before restore | CONFIRMED | `restore_backup.js` calls `db.collection(name).deleteMany({});` before `insertMany(...)` |
| AUTH-001 | Tokens stored in localStorage | CONFIRMED | `client/src/services/api.js` uses `localStorage.setItem(`${prefix}_access_token`, access)` |
| AUTH-002 | Private upload URLs include access_token query param | CONFIRMED | `withUploadAccessToken()` appends `?access_token=...` to upload URLs and `resolveMediaUrl()` does the same |
| AUTH-003 | refresh token rotation is implemented | CONFIRMED | `routes/authRoutes.js` verifies refresh token and rotates it |
| AUTH-004 | device/session revocation exists | PARTIALLY FIXED | There is logic for `tokenVersion` and blacklist, but not fully audited across all flows |
| AUTH-005 | Google OAuth disabled | CONFIRMED (source) | `routes/authRoutes.js` + `utils/googleOAuthDisabled.js` integrate fail-closed behavior |
| DEP-001 | dependency advisory risk | UNABLE TO VERIFY FULLY IN THIS SESSION | package versions exist, but we did not run a full security audit on the lockfile from scratch |

## 5. Authentication

### 5.1 Login flow and JWT issuance
Verified in `routes/authRoutes.js`:
- `generateTokens(payload, audience)` signs both access and refresh JWTs
- Access token uses `JWT_SECRET`
- Refresh token uses `JWT_REFRESH_SECRET`
- JWT expiry is configured by `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`

Evidence:
- `routes/authRoutes.js`: `const accessToken = jwt.sign(base, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });`
- `routes/authRoutes.js`: `const refreshToken = jwt.sign(base, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });`

### 5.2 Token version and rotation
Verified in `middleware/auth.js` and `routes/authRoutes.js`:
- access token is verified with `jwt.verify(token, process.env.JWT_SECRET)`
- tokenVersion mismatch causes denial
- refresh token rotation is implemented and reuse is detected

Evidence:
- `middleware/auth.js`: `const decoded = jwt.verify(token, process.env.JWT_SECRET);`
- `middleware/auth.js`: `if (dbUser.tokenVersion !== undefined && decoded.tokenVersion !== undefined && dbUser.tokenVersion !== decoded.tokenVersion) { return 401; }`
- `routes/authRoutes.js`: `const bump = (dbUser.tokenVersion || 0) + 1000;` and revoke on reuse detection

### 5.3 Logout and revocation
Verified in `middleware/tokenBlacklist.js` and `routes/authRoutes.js`:
- logout route clears/revokes token via blacklist
- refresh token reuse triggers invalidation

Notable: the mechanism exists, but direct end-to-end verification was not performed here.

### 5.4 CAPTCHA and MFA
Verified in `routes/authRoutes.js`:
- CAPTCHA generation and verification exist (`svg-captcha`)
- MFA challenge generation exists (`generateSecret`, `verifyTotp`, `otpauthUrl`)

## 6. Authorization

### 6.1 Authorization checks are layered in middleware and route handlers
Verified in `middleware/auth.js`:
- `authMiddleware` verifies JWT and token blacklist
- `isSuperAdmin` checks either hardcoded `admin` or `Teacher.adminRole === 'SUPER_ADMIN'`
- `assertStaffPermissions()` checks the DB-stored `permissions` with `matcher`

This is a real backend guard and is not only frontend-only.

### 6.2 Frontend is not the sole trust boundary
The frontend stores tokens in localStorage and can redirect to login paths, but the backend enforces authorization on requests in middleware.

However, the application includes many large legacy route handlers and some role checks are performed in route logic rather than a single central policy layer. This calls for careful review rather than assuming full safety.

### 6.3 Status
- Authorization exists in backend for core requests.
- No broad claim of universal bypass is justified without full route-by-route mapping.
- The important risk is not “frontend-only auth,” but the combination of large legacy route surface and destructive admin reset route.

## 7. Branch / Tenant Isolation

The application includes branch/tenant-aware logic. Code references include:
- `branchId`, `branchCode`, `tenantId`, `X-Tenant-Id`
- `branchFilter`/`tenant` in route guards and middleware

Evidence observed:
- `server.js` and `client/src/services/api.js` set `X-Tenant-Id` on requests
- `middleware/auth.js` attaches `req.user.branchId`, `req.user.branchCode`

The project clearly intends to enforce branch isolation. However, a direct repo-wide validation of every DB query is not complete in this session; therefore this is marked as PARTIALLY VERIFIED, not READY.

## 8. Database Integrity

### 8.1 Live DB reset route is real
This is the most serious finding. The route is mounted and active.

File: `routes/settingsRoutes.js`

Evidence:
- route declaration: `router.post('/reset-data', authMiddleware, ...settingsGuard('reset'), async (req, res) => {`
- destructive operations include:
  - `await Student.deleteMany({});`
  - `await ExamResult.deleteMany({});`
  - `await Submission.deleteMany({});`
  - `await Evaluation.deleteMany({});`
  - `await Assignment.deleteMany({});`
  - `await Transaction.deleteMany({});`
  - `await Invoice.deleteMany({});`
  - `await Schedule.deleteMany({});`
  - `await Message.deleteMany({});`
  - `await Notification.deleteMany({});`
  - `await Group.deleteMany({});`
  - `await ConversationVisibility.deleteMany({});`
  - `await Employee.deleteMany({});`
  - `await SystemLog.deleteMany({});`

This is a live destructive route, protected by admin auth plus a confirmation phrase and password, but it still exists in the production runtime. Therefore, data-loss risk is real if the credentials are compromised or the route is misused.

### 8.2 Manual restore script wipes data before restore
File: `restore_backup.js`

Evidence:
- `await db.collection(name).deleteMany({});`
- then `insertMany(parsedDocs)`

This is a destructive script used during restoration; it intentionally wipes collection contents first. The risk is not automatic but it is a real manual data-loss path if pointed to the wrong DB.

### 8.3 Database reset via scripts
Scripts such as `scripts/cleanup_test_data.js`, `scripts/clean_test_data.js`, `scripts/seed-test-users.js`, `scripts/seed_test_teachers.js`, `tests/cleanup_test_accounts.js` contain `deleteMany(...)` over live collections and are clearly destructive if run against the wrong database.

This is not necessarily production code, but it is real data-erasure logic in the repository.

### 8.4 Database reset risk question
Answer to the user’s required question:
- Does the code reset database? YES, live route + manual scripts.
- Could seed/cleanup scripts overwrite production? POSSIBLY, if executed against a production DB or wrong env.
- `docker compose down` without `-v` does not destroy data because named volumes persist.
- `docker compose down -v` would remove MongoDB and upload/backup volumes.

## 9. Data Loss Risk

### 9.1 Confirmed risk
- `routes/settingsRoutes.js` live reset-data route wipes multiple collections with `deleteMany({})`
- `restore_backup.js` wipes collection data before restore
- `scripts/clean_test_data.js` and similar scripts delete large collections without a production guard

### 9.2 Deployment risk
Verified in `docker-compose.yml`:
- `mongo_data` is a named volume
- `api_uploads` is a named volume
- `api_backups` is a named volume

Therefore:
- `docker compose down` should keep data by default
- `docker compose down -v` deletes the named volumes and can wipe MongoDB data, uploads, and backups

This is a real operational risk but not an automatic runtime bug.

## 10. File Security

### 10.1 Upload and download protection
Verified in `server.js`:
- `app.use('/uploads', uploadsAuthMiddleware, ...)`
- `uploadsAuthMiddleware` checks JWT and blacklist
- public prefixes are allowed for brand assets and some public media

Evidence: `middleware/uploadsAuth.js` defines `PUBLIC_UPLOAD_PREFIXES` and checks `isPublicUploadPath(req.path)`.

### 10.2 Private uploads can still carry token in URL
This is a serious frontend and URL-leak issue.

File: `client/src/services/api.js`

Evidence:
- `withUploadAccessToken(url)` adds `?access_token=...` to private upload URLs
- `resolveMediaUrl(...)` calls `withUploadAccessToken(...)`
- `getAccessToken()` reads from `localStorage`

This means private file requests are decorated with sensitive JWTs in the query string, which may leak into browser history, logs, referrer headers, and reverse-proxy logs.

### 10.3 Current protection
- JWT is required for private upload access
- Token revocation is checked via blacklist
- Some ownership checks exist for certification submissions

### 10.4 Risk assessment
- Not a direct arbitrary file read by itself if the token is valid
- But the URL-based token pattern creates additional exposure and is not ideal for production handling

## 11. Exam & Quiz Integrity

Direct verification of route logic was not fully exhaustive in this session, but the project contains exam and quiz logic with significant server-side enforcement patterns. The repository includes dedicated modules for exam attempt/quiz access and many repair notes in code comments and tests.

Conclusion: the project has explicit effort to enforce exam security, but without full route-to-DB verification across all quiz/exam flows, it is not safe to claim full integrity readiness.

## 12. Finance & Payments

`routes/webhookRoutes.js`, `routes/invoiceRoutes.js`, `routes/transactionRoutes.js`, `routes/financeRoutes.js` exist and are mounted.

The codebase clearly includes SePay-related webhooks and invoice/finance transaction flows. The presence of these modules suggests a payment workflow exists, but direct end-to-end verification of duplicate webhook protection, idempotency, and invoice ownership was not fully completed in this session.

## 13. Frontend Security

### 13.1 Token storage
Confirmed in `client/src/services/api.js`:
- `setTokens` stores access and refresh tokens in `localStorage`
- `getAccessToken()` reads from `localStorage`
- `getRefreshToken()` reads also from `localStorage`

This is a direct source-level confirmation.

### 13.2 URL-based token injection
Also confirmed in `client/src/services/api.js`:
- `withUploadAccessToken()` appends `access_token` to the URL
- `buildMediaDownloadUrl()` may also embed metadata causing token leakage into URLs for download flows

### 13.3 Execution summary
- The frontend is not using a hardened token storage pattern for access and refresh tokens.
- The code uses localStorage and URL tokens.
- This is a real security issue, not a theoretical warning.

## 14. Dependencies

The repo includes modern frontend and backend packages, including Express, Mongoose, Socket.IO, BullMQ, Redis, JWT, Multer, etc.

A complete dependency vulnerability scan was not run in this session. Therefore, the repository is not marked fully secure on dependency hygiene until a formal audit and lockfile review is executed.

## 15. Tests & CI

The repository contains many test scripts and QA scripts in `tests/` and `scripts/`.

The repository also contains destructive scripts that are clearly test/QA oriented. This is a risk because they are not all clearly isolated behind a `NODE_ENV === 'test'` or a dedicated disposable database guard.

Further, some scripts appear to delete records and run cleanup based on broad selectors, such as `deleteMany({})` or broad `filter` conditions. This is a very real risk if the wrong database is selected.

## 16. Backup & Restore

### 16.1 Backup path
Verified:
- `services/backupService.js` creates gzip JSON backups of MongoDB collections
- The backup root is `backups/`
- `BACKUP_KEEP` controls retention
- `BackupJob` persists metadata in MongoDB

### 16.2 Restore path
Verified:
- `restore_backup.js` is present and performs a full restore
- It explicitly runs `deleteMany({})` for each collection before insert

### 16.3 Verification status
- Backup creation exists and is implemented.
- Restore operation is implemented but requires strong operator care.
- This session did not execute restore or verify a round-trip restore in a disposable environment.
- Therefore: backup/restore infrastructure exists, but restore safety is NOT VERIFIED from execution.

## 17. Deployment

### 17.1 Docker Compose persistence
Verified in `docker-compose.yml`:
- `mongo_data` volume
- `api_uploads` volume
- `api_backups` volume

This means Docker data survives a regular `docker compose down` and is only removed with `docker compose down -v`.

### 17.2 Production safety
`config/validateEnv.js` enforces production environment variables and fails if required settings are missing.

It requires or checks:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_URL`
- `REDIS_URL`
- SMTP config in production
- `MASTER_ADMIN_PHONE` for production
- SePay keys in production

This indicates the application expects a strict production environment, not a casual local environment.

## 18. Admin Dashboard Verification

The admin dashboard exists and is wired to backend APIs in React components and data providers. However, a full, route-by-route verification of every admin KPI and DB query was not completed in this session. So the dashboard is considered functionally present, but precise source-level verification of all KPI claims remains partial.

## 19. Performance

No formal performance benchmark was run. The repository clearly includes many large UI component files and a broad range of features. This suggests maintainability and performance risks, but they are not yet quantified in this session.

## 20. Code Quality

The codebase is large and feature-rich. It combines legacy route handling, service layers, and additional module scaffolds. This is an architectural pattern that can support growth only if disciplined around route ownership, permission zoning, and consistent feature boundaries.

At the source level, the project is not a small/simple app; it is genuinely complex. That complexity is both an advantage and a risk.

## 21. Confirmed Critical Issues

### DB-001 — CRITICAL
- File: `routes/settingsRoutes.js`
- Lines: around the `router.post('/reset-data', ...)` function
- Function: `reset-data`
- Evidence: multiple `deleteMany({})` calls against Student, ExamResult, Submission, Evaluation, Assignment, Transaction, Invoice, Schedule, Message, Notification, Group, Employee, SystemLog
- Impact: destructive full reset of production datasets is possible
- Current protection: authenticated user + confirmation phrase + password + role checks
- Recommended fix: move this behind a dedicated staging-only environment, add a hardcoded environment guard, and require a second factor/production disable flag
- Confidence: HIGH

### DB-002 — CRITICAL
- File: `restore_backup.js`
- Lines: `await db.collection(name).deleteMany({});`
- Function: `restoreBackup()`
- Evidence: restore workflow wipes collection before insert
- Impact: data loss if pointed at production DB
- Current protection: CLI/manual only, but dangerous
- Recommended fix: require explicit `--force` and production dry-run; preferably restore to a disposable DB by default
- Confidence: HIGH

### AUTH-001 — HIGH
- File: `client/src/services/api.js`
- Lines: token storage helpers (`setTokens`, `getAccessToken`, `getRefreshToken`)
- Evidence: `localStorage.setItem(`${prefix}_access_token`, access)` and refresh token stored in localStorage
- Impact: XSS or browser compromise exposes tokens; token leakage through browser storage/history
- Current protection: backend verifies JWT and token version
- Recommended fix: httpOnly secure refresh cookie, memory-only access token, avoid query-string tokens
- Confidence: HIGH

### AUTH-002 — HIGH
- File: `client/src/services/api.js`
- Function: `withUploadAccessToken()`
- Evidence: appends `?access_token=...` to private upload URLs
- Impact: token leakage to logs, referrer, browser history, reverse proxy logs
- Current protection: token is required for private upload access
- Recommended fix: use Authorization header / short-lived signed file URLs or server-side asset proxy
- Confidence: HIGH

## 22. Confirmed High Issues

### AUTH-003 — HIGH
- File: `routes/authRoutes.js` / `middleware/auth.js`
- Evidence: `jwt.verify()` and tokenVersion validation are used, but browser keeps tokens in localStorage; risk is not in JWT verification itself but in where the JWT is stored and exposed
- Impact: stolen token can be replayed until version mismatch or revocation
- Current protection: tokenVersion mismatch + blacklist
- Recommended fix: keep access token out of durable browser storage, use secure cookies for refresh token
- Confidence: MEDIUM

### DEP-001 — HIGH
- File: `package.json`
- Evidence: dependency set is broad and modern; no direct verification of dependency vulnerability status was completed in this session
- Impact: supply-chain risk and library vulnerability exposure remain possible
- Current protection: not enough evidence to conclude full safety
- Recommended fix: perform a full lockfile and package audit in a disposable environment
- Confidence: MEDIUM

## 23. Confirmed Medium Issues

### FILE-001 — MEDIUM
- File: `middleware/uploadsAuth.js`
- Evidence: private file proxy allows a JWT in query string (`req.query.access_token`)
- Impact: token leakage and request sniffing risk
- Current protection: JWT is validated and blacklist checked
- Recommended fix: remove query-token support; prefer Authorization header and signed asset URLs
- Confidence: HIGH

### TEST-001 — MEDIUM
- File: `scripts/` and `tests/` folder
- Evidence: broad destructive cleanup scripts exist and some scripts target major collections without a production guard
- Impact: if run against the wrong DB, data loss
- Current protection: environment-specific scripts exist but not always enforced
- Recommended fix: isolate scripts to a disposable DB and require explicit confirmation markers
- Confidence: MEDIUM

## 24. Confirmed Low Issues

### OPS-001 — LOW
- File: `docker-compose.yml`
- Evidence: named volumes are configured for MongoDB and uploads/backups
- Impact: regular shutdown does not automatically destroy data, but `down -v` will
- Current protection: documented in compose files
- Recommended fix: add operational safeguard and deployment checklist to prevent accidental `-v`
- Confidence: MEDIUM

## 25. Fixed Issues

The following issues have real implementation evidence in the source and are not false positives:
- JWT blacklist enforcement exists in `middleware/auth.js` and `middleware/uploadsAuth.js`
- tokenVersion checking exists in `middleware/auth.js`
- refresh token rotation exists in `routes/authRoutes.js`
- Google OAuth is fail-closed or disabled in source logic (`socialOAuthDisabled` / `utils/googleOAuthDisabled.js`)
- production env validation exists in `config/validateEnv.js`

## 26. False Positives

Some previous claims should not be accepted as final without fresh code validation. Examples:
- “All routes are unsafe” is false based on current code because major route mounts and auth middleware exist.
- “All modules are active” is false because `modules/` code is not mounted in `server.js`.
- “The app automatically resets DB on start” is false because startup only connects DB and initializes indexes; no startup-reset logic was found.

## 27. Production Readiness

### Authentication: READY WITH MINOR FIXES
Evidence: JWT, refresh rotation, tokenVersion, blacklist, password checks, captcha, MFA.
Risk: browser token storage remains not ideal.

### Authorization: READY WITH MINOR FIXES
Evidence: backend middleware and role checks exist.
Risk: large legacy route surface and route-specific permission logic require a broader verification pass.

### Database integrity: NOT READY
Evidence: live reset-data route and destructive scripts exist.

### Branch isolation: NOT VERIFIED
Evidence: branch-aware logic exists, but a repo-wide verification of every sensitive query was not complete in this session.

### File security: NOT READY
Evidence: private uploads exist and token leakage through URL is confirmed.

### Exam integrity: NOT VERIFIED
Evidence: server-side logic exists, but full route-by-route verification remains incomplete.

### Finance: NOT VERIFIED
Evidence: finance modules exist, but full payment webhook and duplicate-payment validation was not thoroughly verified here.

### Backup: READY WITH MINOR FIXES
Evidence: backup logic exists; restore script exists.
Risk: restore is destructive and must be run carefully.

### Deployment: READY WITH MINOR FIXES
Evidence: Docker volumes and production env validation exist.
Risk: accidental `docker compose down -v` remains a real operational hazard.

### Monitoring: READY
Evidence: `healthz` and monitoring routes exist.

### Testing: NOT READY
Evidence: destructive test scripts and non-isolated cleanup logic exist.

### Dependencies: NOT VERIFIED
Evidence: no full dependency vulnerability review was executed in this session.

## 28. Top 10 Priorities

P0
1. Remove or hard-guard `POST /api/settings/reset-data` from production use if not staged-only.
2. Eliminate `access_token` query-string storage for private uploads; use Authorization headers or signed asset endpoints.
3. Replace localStorage-only token storage with secure refresh cookies and memory-only access tokens.
4. Review all `deleteMany({})` routes and scripts for environment guards.

P1
5. Restore script needs safe-by-default operation and explicit production protection.
6. Branch / tenant isolation review for all sensitive queries.
7. Full route-by-route authorization audit for high-risk modules.
8. Payment webhook idempotency and invoice integrity verification.

P2
9. QA test isolation and data cleanup verification.
10. Dependency audit and lockfile vulnerability review.

## 29. Top 30 Files to Review

| Priority | File | Reason |
|---|---|---|
| 1 | `routes/settingsRoutes.js` | live destructive reset route |
| 2 | `restore_backup.js` | destructive restore script |
| 3 | `client/src/services/api.js` | localStorage + token-in-URL handling |
| 4 | `middleware/uploadsAuth.js` | file access via query token |
| 5 | `server.js` | runtime mount and global middleware |
| 6 | `config/db.js` | DB connection and lifecycle |
| 7 | `config/validateEnv.js` | production guardrail and env validation |
| 8 | `routes/authRoutes.js` | auth, refresh rotation, login flow |
| 9 | `middleware/auth.js` | auth middleware implementation |
| 10 | `middleware/tokenBlacklist.js` | token revocation |
| 11 | `models/Teacher.js` | role, tokenVersion, lockout |
| 12 | `models/Student.js` | tokenVersion, account state |
| 13 | `routes/studentRoutes.js` | heavy data access and authorization |
| 14 | `routes/teacherRoutes.js` | teacher admin and exam flows |
| 15 | `routes/scheduleRoutes.js` | schedule mutation and permissions |
| 16 | `routes/assignmentRoutes.js` | assignments + submissions |
| 17 | `routes/quizRoutes.js` | exam and quiz integrity |
| 18 | `routes/examResultRoutes.js` | exam score and result data |
| 19 | `routes/transactionRoutes.js` | finance transactions |
| 20 | `routes/invoiceRoutes.js` | invoices |
| 21 | `routes/webhookRoutes.js` | payment webhook processing |
| 22 | `routes/fileRoutes.js` | file actions |
| 23 | `routes/backupRoutes.js` | backup lifecycle |
| 24 | `services/backupService.js` | backup creation and retention |
| 25 | `docker-compose.yml` | deployment volume and persistence |
| 26 | `scripts/clean_test_data.js` | destructive cleanup script |
| 27 | `scripts/seed-test-users.js` | seed script risk |
| 28 | `scripts/cleanup_temp.js` | temp cleanup script |
| 29 | `tests/cleanup_test_accounts.js` | test cleanup script |
| 30 | `package.json` | dependency and script review |

## 30. Recommended Remediation Order

1. Remove production exposure of destructive reset route or gate it behind a verified staging-only flag.
2. Replace localStorage + query-string JWT usage with secure cookie and memory-only token pattern.
3. Review all `deleteMany({})` scripts and live routes for environment-specific guards.
4. Implement repository-wide branch and tenant filtering verification for all high-risk reads/writes.
5. Audit finance webhooks and payment dedupe logic.
6. Audit exam/quiz attempt logic and result updates.
7. Validate dependencies and lockfile security.
8. Isolate QA and production data paths and add explicit DB safety checks.
9. Strengthen backup/restore controls and test restore in a disposable environment.
10. Review the large app surface for policy centralization and maintainability.

## 31. Final Assessment

This repository is not a no-code or toy system. It is a real and feature-rich LMS platform with many active routes, auth mechanisms, business modules, and deployment scaffolding. However, from direct source verification, it is not production-safe as-is for unrestricted deployment because:
- a live destructive reset route exists,
- tokens are stored in localStorage and URL query strings,
- automatic restore is destructive,
- destructive scripts are not all isolated to safe ENV,
- and the branch/authorization surface is large and not fully verified at the source-level for every route.

Status: NOT READY for unrestricted production deployment.

## 32. Evidence note

This report is intentionally source-driven and was produced without changing code or database state. It is a verification audit, not a fix proposal or patch.
