# LMS THẮNG TIN HỌC — REMEDIATION PROGRESS

## Current baseline

- Current branch: `agents/pasted-text-processing`
- Current commit: `61c9b5a9cb19758d57df376b3c1f4a69f5a1ef4e` ("fix: show AI assistant online", 2026-09-14)
- Node version: v24.18.0
- MongoDB configuration: `MONGODB_URI=mongodb://127.0.0.1:27017/dashboardthangtinhoc` (standalone by default; `?replicaSet=rs0` only needed for CQRS strangler flags, which are all `false` in `.env.example`)
- Deployment mode: `NODE_ENV=development` by default in `.env.example`; production is a separate VPS deploy (see `deploy_scripts/`, `VPS_*` vars) — not exercised in this session
- Backup status: `BACKUP_CRON` / `BACKUP_SCHEDULE` / `BACKUP_KEEP` are commented out (disabled) by default in `.env.example`; not modified this phase
- Test status (2026-09-16, this session): `node tests/run.js unit` -> 330 tests, 329 pass, 1 pre-existing failure (`tests/unit/high_admin_teacher_manage_actions.test.js`, unrelated string-match assertion vs `AdminTeachersTab.jsx` label text -- reproduced identically on a clean `git stash` of this session's changes, i.e. pre-existing on the branch tip, not caused by Phase 1 work)

## Phases

- [x] Phase 0 - Safety baseline
- [x] Phase 1 - Disable destructive reset
- [x] Phase 2 - Secrets & environment hardening
- [ ] Phase 3 - Master Admin authentication
- [ ] Phase 4 - Financial data protection
- [ ] Phase 5 - Audit logging
- [ ] Phase 6 - Soft delete
- [ ] Phase 7 - Authorization & branch isolation
- [ ] Phase 8 - Backup/restore verification
- [ ] Phase 9 - Security/E2E tests
- [ ] Phase 10 - Cleanup/refactor

---

## Phase 0 - Safety baseline (done)

- Git status at start: clean working tree, branch `agents/pasted-text-processing`, commit `61c9b5a`.
- Runtime entry point: `server.js` (`node server.js` / `npm start`); calls `require('./config/validateEnv')()` immediately after `dotenv.config()`.
- `routes/settingsRoutes.js` is mounted at `app.use('/api/settings', settingsRoutes)` (server.js:910).
- No business logic was changed in Phase 0.

## Phase 1 - Disable destructive reset in production (done)

### BEFORE CHANGE

**Problem**: `POST /api/settings/reset-data` (routes/settingsRoutes.js) can bulk `deleteMany({})` across ~15 collections (Student, ExamResult, Submission, Evaluation, Assignment, Transaction, Invoice, PayrollLog, LedgerEntry, CreditNote, FinanceDailySnapshot, Schedule, Message, Notification, Group, ConversationVisibility, Employee, SystemLog), gated only by RBAC (`settingsGuard('reset')` -> SYSTEM_SETTINGS permission) plus a confirmation phrase (`XOA_DU_LIEU`) and Super Admin password re-entry. There was no environment-level kill switch -- a valid Super Admin in production could trigger a full data wipe with no backup step.

**Files involved**:
- `routes/settingsRoutes.js` (route definition, `settingsResponseFor`)
- `middleware/destructiveResetGuard.js` (new)
- `client/src/components/SystemSettingsTab.jsx` (Danger Zone button)
- `client/src/components/SystemResetModal.jsx` (read only, unchanged)
- `client/src/services/api.js` (read only, unchanged -- confirms `resetData()` is the only caller)
- `.env.example`

**Current behavior**: Route chain was `authMiddleware -> policyShadowSettings('reset') -> settingsCutoverGate('reset') -> handler`. No `NODE_ENV`/env-flag check existed anywhere in this path.

**Proposed change**: Add a new, RBAC-independent, fail-closed middleware `destructiveResetGuard` that runs right after `authMiddleware` and before the existing permission gates. In production (`NODE_ENV === production`), it returns HTTP 403 unless `ALLOW_DESTRUCTIVE_RESET` is exactly `true` or `1`. Outside production it is a no-op (preserves existing dev/test/staging workflow). Expose the resolved boolean via GET `/api/settings` (`destructiveResetEnabled`) so the frontend Danger Zone button can reflect it without a new endpoint, and disable (not remove) that button when the flag is off.

**Risk**: Low -- additive middleware, no changes to existing RBAC/authz logic, no changes to any deleteMany call, no DB/schema changes. Main risk is accidentally blocking reset in a legitimate non-production environment if `NODE_ENV` were ever mis-set to `production` in staging; mitigated by requiring an explicit opt-in env var rather than hardcoding.

**Tests to run**: New unit tests for `isDestructiveResetAllowed`/`destructiveResetGuard`; full `node tests/run.js unit` regression pass; `node -c` syntax check on all touched files; `npx eslint` on touched files.

### AFTER CHANGE

**Files changed**:
- `middleware/destructiveResetGuard.js` (new) -- `isDestructiveResetAllowed(env)` pure function + `destructiveResetGuard(req, res, next)` Express middleware.
- `routes/settingsRoutes.js` -- require the new guard; wire it into `POST /reset-data` right after `authMiddleware`; expose `destructiveResetEnabled` in `settingsResponseFor()`.
- `.env.example` -- documented `ALLOW_DESTRUCTIVE_RESET=false` (default OFF; has no effect outside `NODE_ENV=production`).
- `client/src/components/SystemSettingsTab.jsx` -- Danger Zone button now disables itself and swaps its label/tooltip when `settings.destructiveResetEnabled === false`; UI is not removed, only safely disabled.
- `tests/unit/destructive_reset_guard.test.js` (new) -- 8 tests covering Test A/B/C from the spec plus additional coverage (explicit opt-in, garbage-value fail-closed, non-production passthrough).

**Exact changes**: see `git diff` (summarized):
- `routes/settingsRoutes.js`: +4/-1 lines -- 1 new require, 1 new line in `settingsResponseFor`, 1 line rewritten in the route signature to insert `destructiveResetGuard`.
- `.env.example`: +4 lines -- new commented block + `ALLOW_DESTRUCTIVE_RESET=false`.
- `client/src/components/SystemSettingsTab.jsx`: +20/-6 lines -- 1 new state field default, button JSX made conditional.
- `middleware/destructiveResetGuard.js`: new file, 26 lines.
- `tests/unit/destructive_reset_guard.test.js`: new file, 8 tests.

**Tests executed**:
- `node --test tests/unit/destructive_reset_guard.test.js` -> 8/8 pass.
- `node tests/run.js unit` (full unit suite, 17 suites) -> 330 tests, 329 pass, 1 fail (pre-existing, unrelated -- verified identical failure via `git stash` of all Phase-1 changes).
- `node -c` on `middleware/destructiveResetGuard.js`, `routes/settingsRoutes.js`, `tests/unit/destructive_reset_guard.test.js` -> all OK.
- `npx eslint middleware/destructiveResetGuard.js routes/settingsRoutes.js` -> 0 errors (pre-existing `no-unused-vars` warnings only, none introduced by this change).

**Passed**: All new tests (8/8). Full regression suite 329/330.

**Failed**: `tests/unit/high_admin_teacher_manage_actions.test.js` -- pre-existing failure, reproduced on the unmodified branch tip via `git stash`; unrelated to `reset-data`/settings/auth. Not touched or hidden; not part of Phase 1 scope.

**Regression risks**: None identified for production login/settings flows -- the new guard is a no-op whenever `NODE_ENV !== production` (dev/test/CI unaffected), and when `NODE_ENV === production` with `ALLOW_DESTRUCTIVE_RESET` unset/false it only affects `POST /reset-data` (no other route touches this middleware).

**Manual QA required**:
1. In a production-like environment with `ALLOW_DESTRUCTIVE_RESET` unset, confirm `POST /api/settings/reset-data` returns 403 with `code: DESTRUCTIVE_RESET_DISABLED`, even with correct phrase + Super Admin password.
2. Confirm GET `/api/settings` now includes `destructiveResetEnabled: false` in that same environment, and that the Danger Zone button renders disabled/greyed-out with the "Da khoa (production)" label and explanatory tooltip.
3. Confirm normal (non-reset) settings read/update flows still work unaffected.
4. Confirm that with `NODE_ENV=production` and `ALLOW_DESTRUCTIVE_RESET=true` explicitly set, the endpoint still behaves exactly as before Phase 1 (reaches the existing RBAC/phrase/password checks).

**Git diff summary**:
```
 .env.example                                 |  4 ++++
 client/src/components/SystemSettingsTab.jsx  | 25 ++++++++++++++++++++-----
 routes/settingsRoutes.js                     |  4 +++-
 3 files changed, 27 insertions(+), 6 deletions(-)
 (+ 2 new untracked files: middleware/destructiveResetGuard.js, tests/unit/destructive_reset_guard.test.js)
```

**PHASE 1 STATUS: COMPLETE** -- acceptance criteria met:
- Production defaults to reset disabled (verified by test + code review).
- Missing env var also results in disabled (fail closed, verified by test).
- Existing login/settings behavior unaffected outside the `/reset-data` route.
- No real `deleteMany()` was executed and no production DB was contacted by any test in this phase (guard short-circuits with `res.status(403).json(...)` before reaching the handler; unit tests use a fake `res` object and never boot a server or connect to Mongo).

**Proposed commit message** (not committed -- awaiting explicit user request):
```
security(phase-1): fail-closed kill switch for production system reset

Add ALLOW_DESTRUCTIVE_RESET env flag (default false) and an
RBAC-independent destructiveResetGuard middleware in front of
POST /api/settings/reset-data. Production requests are rejected with
403 DESTRUCTIVE_RESET_DISABLED unless explicitly opted in. Frontend
Danger Zone button reflects the new destructiveResetEnabled flag from
GET /api/settings and disables itself (without removing the UI) when
reset is locked.
```

**Next step**: Phase 2 completed (see below). Awaiting explicit user command before starting Phase 3 (Master Admin authentication).

---

## Phase 2 - Secrets & environment hardening (done)

### BEFORE CHANGE

**Files inspected**: config/appConfig.js, config/validateEnv.js, .env.example, server.js, config/logger.js, config/db.js, utils/adminPassword.js, models/SystemSettings.js, services/settingsCache.js, routes/settingsRoutes.js, tests/integration/validateEnv.test.js, tests/integration/wave61_policy_shadow_soak.test.js, tests/run.js, .env.test.example, client/vite.config.js, client/.env.production, package.json, Dockerfile, .github/workflows/node.yml.

**Security-sensitive env variables found** (classification; no real values shown):
- SECURITY_CRITICAL: JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET, COOKIE_SECRET, SESSION_ENCRYPTION_KEY (documented, not wired anywhere).
- CREDENTIAL: MASTER_ADMIN_PASSWORD, MASTER_ADMIN_PHONE, MONGODB_URI, SEPAY_API_KEY/SEPAY_SECRET_KEY, REDIS_URL, SMTP_*, AWS/S3 creds, GOOGLE_CLIENT_SECRET, ZALO_OA_TOKEN, GEMINI_API_KEY/AI_API_KEY.
- CONFIGURATION: PORT, CLIENT_URL, FRONTEND_URL, NODE_ENV, LOG_LEVEL.

**Weak/default values found**:
- config/appConfig.js: dead-code security block with weak fallbacks for jwtSecret/jwtRefreshSecret/masterAdminPassword/sessionSecret (confirmed zero real usages repo-wide via grep, safe zero-risk removal).
- .env.example: MASTER_ADMIN_PHONE had a real-looking phone number, MASTER_ADMIN_PASSWORD had a real usable weak default -- both removed. No SESSION_SECRET line existed at all.
- config/validateEnv.js: no SESSION_SECRET check existed; no explicit known-insecure-value rejection list existed (only incidental catching via length checks).

**Environment validation currently present**: config/validateEnv.js, called synchronously in server.js immediately after dotenv.config(), before any other module/logger/app/DB setup -- confirmed already correct order, no change needed.

**Startup validation order**: server.js -> dotenv.config() -> validateEnv() -> logger/app/session/routes. Already correct; not modified.

**Proposed files to modify**: config/appConfig.js, config/validateEnv.js, .env.example, tests/integration/validateEnv.test.js, new tests/unit/env_validation.test.js.

**Regression risks**: Adding a production-required SESSION_SECRET check would break tests/integration/validateEnv.test.js production-mode cases unless its shared beforeEach also sets SESSION_SECRET (planned and applied). tests/integration/wave61_policy_shadow_soak.test.js has 2 pre-existing failures unrelated to secrets, confirmed present before any Phase 2 edit, left untouched (out of scope).

### AFTER CHANGE

**Files modified**:
- config/appConfig.js -- removed all four weak fallbacks from the (confirmed dead/unused) security block.
- config/validateEnv.js -- added a KNOWN_INSECURE_SECRET_VALUES set plus isKnownInsecureSecretValue()/assertStrongSecret() helpers; JWT_SECRET/JWT_REFRESH_SECRET now also reject known-insecure values and whitespace-only in addition to the pre-existing length/inequality checks; added a new production-required SESSION_SECRET check (same length policy as JWT, plus known-insecure-value rejection outside production too); added a new conditional check that rejects MASTER_ADMIN_PASSWORD if it is set to a known-insecure value, in any environment, without making it required.
- .env.example -- blanked MASTER_ADMIN_PHONE and MASTER_ADMIN_PASSWORD (removed real-looking phone and admin123 default); added a new SESSION_SECRET line with the same generation-command comment pattern as JWT_SECRET.
- tests/integration/validateEnv.test.js -- added SESSION_SECRET to the shared beforeEach so its 15 pre-existing tests keep passing under the new required check.
- tests/unit/env_validation.test.js (new) -- 15 tests covering the 10 mandated scenarios plus Master Admin conditional-value scenarios.

**Defaults removed**: the dead-code fallback values in appConfig.js (jwtSecret/jwtRefreshSecret/masterAdminPassword/sessionSecret); the real MASTER_ADMIN_PHONE/MASTER_ADMIN_PASSWORD values in .env.example.

**Validation added**: known-insecure-value rejection list (secret, refresh_secret, session_secret, admin, admin123, password, changeme, change-me, your-secret, your-secret-here, 123456) applied to JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET, and conditionally MASTER_ADMIN_PASSWORD; new production-required SESSION_SECRET presence and minimum-length (32+) check.

**Production behavior**: server now fails to start if JWT_SECRET, JWT_REFRESH_SECRET, or SESSION_SECRET is missing, whitespace-only, a known-insecure default, or shorter than 32 characters. MASTER_ADMIN_PASSWORD remains optional (unchanged flow in utils/adminPassword.js, not modified -- DEFERRED TO PHASE 3 for any authorization-flow change) but is rejected if explicitly set to a known-insecure value.

**Development behavior**: JWT_SECRET/JWT_REFRESH_SECRET still required (16+ chars, pre-existing behavior, now also known-value-checked); SESSION_SECRET is not required outside production (still dead code, not wired into session middleware) but is rejected if explicitly set to a known-insecure value.

**Test behavior**: NODE_ENV=test path unaffected (isProd is false; .env.test.example secrets are unique strings, none match the known-insecure list); tests/run.js full-suite boot uses its own test-only JWT fallbacks under NODE_ENV=test, untouched.

**Tests added**: tests/unit/env_validation.test.js (15 tests, new file).

**Tests executed**:
- node --test tests/unit/env_validation.test.js -> 15/15 pass.
- node --test tests/integration/validateEnv.test.js -> 15/15 pass (updated beforeEach).
- node --test tests/unit/destructive_reset_guard.test.js (Phase 1 regression check) -> 8/8 pass.
- node tests/run.js unit (full unit suite) -> 345 tests, 344 pass, 1 fail.

**Test results**: The single failure is the already-known pre-existing tests/unit/high_admin_teacher_manage_actions.test.js (unrelated UI label string-match assertion) -- unchanged from the Phase 0/1 baseline. PRE-EXISTING FAILURE -- UNCHANGED. No new regressions introduced.

**ESLint result**: npx eslint config/appConfig.js config/validateEnv.js -> 0 errors. One pre-existing warning (Unused eslint-disable directive at the forceDisableCqrs function) confirmed present in the original file before this phase's edits (verified via git show + lint) -- not introduced by Phase 2.

**Git diff summary**: .env.example (+13/-4), config/appConfig.js (+4/-4), config/validateEnv.js (+51/-12), tests/integration/validateEnv.test.js (+1), plus 1 new untracked file tests/unit/env_validation.test.js. Full working-tree diff also still includes Phase 1's SystemSettingsTab.jsx and routes/settingsRoutes.js changes, intact and unmodified this phase.

**Deferred findings** (not fixed in Phase 2, out of scope):
- SESSION_SECRET is now validated in production but is not yet wired into server.js session middleware (cookieSecret = process.env.COOKIE_SECRET || process.env.JWT_SECRET remains the actual signing secret). Rewiring this is a session/architecture change beyond Phase 2 scope -- follow-up for a later phase.
- utils/adminPassword.js (Master Admin password verification flow) was read to understand current behavior but not modified -- DEFERRED TO PHASE 3.
- FOLLOW-UP: Runtime version consistency -- package.json engines is >=20, Dockerfile uses node:22-bookworm-slim, CI uses Node 22, local runtime is v24.18.0. Not fixed in Phase 2.
- BACKUP DEFAULT DISABLED -- DEFERRED TO PHASE 8 (re-confirmed, unchanged from Phase 0 baseline).
- tests/integration/wave61_policy_shadow_soak.test.js has 2 pre-existing failures unrelated to secrets/Phase 2, confirmed present before any Phase 2 edit, left untouched.
- 28 other files referencing VITE_ env vars were found via grep but not individually inspected; the two central config files (client/vite.config.js, client/.env.production) were confirmed clean of backend secrets. Lower priority, no CRITICAL/HIGH finding surfaced.

**PHASE 2 STATUS: COMPLETE** -- acceptance criteria met:
- Production fails to start without JWT_SECRET / with JWT_SECRET=secret (verified by test).
- Production fails to start without JWT_REFRESH_SECRET / with JWT_REFRESH_SECRET=refresh_secret (verified by test).
- Production fails to start without SESSION_SECRET / with SESSION_SECRET=session_secret (verified by test, new).
- .env.example no longer has a usable Master Admin credential (both blanked).
- No secret value is logged anywhere (Pino redaction already covers auth/token fields; config/db.js logs host only; /api/settings already excludes adminPasswordHash/MFA secrets at the query level).
- No backend secret is exposed via Vite (client/vite.config.js, client/.env.production confirmed clean).
- Test environment still works (NODE_ENV=test path unaffected; full unit suite 344/345 pass).
- No new regression (345 tests vs. prior 330 baseline + 15 new; same single pre-existing failure).
- Phase 1 reset guard still passes (8/8).
- Git diff contains only expected Phase 1 + Phase 2 changes (verified via git status).

**Proposed commit message** (not committed -- awaiting explicit user request):
security: harden production secrets and environment validation

**Next step**: Phase 2 completed. Awaiting explicit user command before starting Phase 3 (Master Admin authentication).
