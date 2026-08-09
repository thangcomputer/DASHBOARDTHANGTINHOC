/**
 * Phase 7.1 — Policy cutover toggle infrastructure (no route cutover).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AUTHORITY,
  KNOWN_FAMILIES,
  RECOMMENDED_FIRST_CUTOVER_FAMILY,
  getAuthorizationAuthority,
  shouldPolicyBeAuthoritative,
  isAnyCutoverFamilyActive,
  parseEnabledFlag,
  parseRouteAllowlist,
  normalizeFamily,
  readCutoverConfigFromEnv,
} = require('../../services/policyShadow/cutoverAuthority');

const ROOT = path.join(__dirname, '../..');

function auth(family, env, reqCtx) {
  return getAuthorizationAuthority(family, reqCtx, env);
}

// ── Configuration ────────────────────────────────────────────────────────────

test('Phase7.1 config: default / missing env → LEGACY', () => {
  assert.equal(auth('monitoring', {}), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', { POLICY_CUTOVER_ENABLED: undefined }), AUTHORITY.LEGACY);
  assert.equal(isAnyCutoverFamilyActive({}), false);
});

test('Phase7.1 config: POLICY_CUTOVER_ENABLED=false → LEGACY', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', env), AUTHORITY.LEGACY);
  assert.equal(shouldPolicyBeAuthoritative('monitoring', null, env), false);
});

test('Phase7.1 config: empty route allowlist → LEGACY even if enabled', () => {
  assert.equal(auth('monitoring', { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '' }), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', { POLICY_CUTOVER_ENABLED: '1', POLICY_CUTOVER_ROUTES: '   ' }), AUTHORITY.LEGACY);
});

test('Phase7.1 config: monitoring not selected → LEGACY', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups,tenants' };
  assert.equal(auth('monitoring', env), AUTHORITY.LEGACY);
  assert.equal(auth('backups', env), AUTHORITY.POLICY);
});

test('Phase7.1 config: monitoring selected while global flag false → LEGACY', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', env), AUTHORITY.LEGACY);
});

test('Phase7.1 config: monitoring selected + global true → POLICY in helper ONLY', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', env), AUTHORITY.POLICY);
  assert.equal(shouldPolicyBeAuthoritative('monitoring', {}, env), true);
  // Does not imply HTTP wiring — routes must still use Legacy gates (static test below)
});

test('Phase7.1 config: unknown route family → LEGACY', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring,not-a-real-family,*' };
  assert.equal(auth('unknown-family', env), AUTHORITY.LEGACY);
  assert.equal(auth('*', env), AUTHORITY.LEGACY);
  assert.equal(normalizeFamily('not-a-real-family'), null);
  assert.equal(normalizeFamily('*'), null);
});

test('Phase7.1 config: malformed configuration → LEGACY', () => {
  assert.equal(parseEnabledFlag('maybe'), false);
  assert.equal(parseEnabledFlag({ oops: true }), false);
  assert.deepEqual(parseRouteAllowlist(123), []);
  assert.deepEqual(parseRouteAllowlist(null), []);
  assert.equal(
    auth('monitoring', { POLICY_CUTOVER_ENABLED: 'YESSS', POLICY_CUTOVER_ROUTES: 'monitoring' }),
    AUTHORITY.LEGACY,
  );
  assert.equal(
    auth('monitoring', { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: { monitoring: true } }),
    AUTHORITY.LEGACY,
  );
});

test('Phase7.1 config: duplicated route names → deterministic unique allowlist', () => {
  const routes = parseRouteAllowlist('monitoring, monitoring, MONITORING, /api/monitoring');
  assert.deepEqual(routes, ['monitoring']);
  const env = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring,monitoring,/api/monitoring' };
  assert.equal(auth('monitoring', env), AUTHORITY.POLICY);
});

test('Phase7.1 config: whitespace/format normalization', () => {
  assert.equal(normalizeFamily('  /api/monitoring/  '), 'monitoring');
  assert.equal(normalizeFamily('api/monitoring'), 'monitoring');
  assert.equal(normalizeFamily('system_logs'), 'system-logs');
  const env = {
    POLICY_CUTOVER_ENABLED: ' true ',
    POLICY_CUTOVER_ROUTES: '  monitoring ; backups\n',
  };
  assert.equal(auth('monitoring', env), AUTHORITY.POLICY);
  assert.equal(auth('backups', env), AUTHORITY.POLICY);
  assert.equal(parseEnabledFlag(' TRUE '), true);
});

// ── Security: request cannot enable ──────────────────────────────────────────

test('Phase7.1 security: query/body/header/role/permissions/branch/tenant cannot enable', () => {
  const env = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
  const poison = {
    query: { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring' },
    body: { POLICY_CUTOVER_ENABLED: true, role: 'admin', permissions: ['*'], branchId: 'x', tenantId: 'y' },
    headers: { 'x-policy-cutover': 'true', 'x-policy-cutover-routes': 'monitoring' },
    user: { role: 'admin', adminRole: 'SUPER_ADMIN', permissions: ['manage_all'] },
  };
  assert.equal(auth('monitoring', env, poison), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', env, poison.query), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', env, poison.body), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', env, poison.headers), AUTHORITY.LEGACY);
  assert.equal(auth('monitoring', env, poison.user), AUTHORITY.LEGACY);
});

// ── Rollback ─────────────────────────────────────────────────────────────────

test('Phase7.1 rollback: enabled → POLICY; disabled / removed route / invalid → LEGACY', () => {
  const on = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', on), AUTHORITY.POLICY);

  const off = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', off), AUTHORITY.LEGACY);

  const removed = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: 'backups' };
  assert.equal(auth('monitoring', removed), AUTHORITY.LEGACY);

  const invalid = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'monitoring' };
  assert.equal(auth('monitoring', invalid), AUTHORITY.LEGACY);
});

// ── Runtime / static: still SHADOW ONLY ──────────────────────────────────────

test('Phase7.1 runtime: committed env may activate ONLY via explicit allowlist; helper still fail-safe', () => {
  const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  // Phase 7.4 may set ENABLED=true + ROUTES=backups; never wildcard / never monitoring alone as accidental global
  assert.ok(!/\*/.test((envFile.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1]));
  assert.ok(!/POLICY_CUTOVER_ROUTES\s*=\s*.*\*/.test(envFile));

  const parsed = {};
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) parsed[m[1].trim()] = m[2].trim();
  }
  // Request poison cannot enable; env file controls authority
  assert.equal(RECOMMENDED_FIRST_CUTOVER_FAMILY, 'monitoring');
  assert.ok(KNOWN_FAMILIES.has('monitoring'));
  assert.ok(KNOWN_FAMILIES.has('backups'));
  // Spoof request context ignored
  assert.equal(
    getAuthorizationAuthority('auth', { body: { POLICY_CUTOVER_ENABLED: 'true' } }, parsed),
    AUTHORITY.LEGACY,
  );
});

test('Phase7.1 static: cutover defaults OFF; monitoring gate uses helper only via cutover middleware', () => {
  const mon = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const helper = fs.readFileSync(path.join(ROOT, 'services/policyShadow/cutoverAuthority.js'), 'utf8');
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowMonitoring.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/monitoringCutoverGate.js'), 'utf8');

  assert.ok(mon.includes('policyShadowMonitoring(action)'));
  assert.ok(mon.includes('monitoringCutoverGate(action)'));
  assert.ok(mon.includes('isAdmin')); // documented Legacy path
  assert.ok(gate.includes('getAuthorizationAuthority'));
  assert.ok(gate.includes('isAdmin'));
  assert.ok(shadow.includes('return next()'));
  assert.ok(!/res\.status\(403\)/.test(shadow));
  assert.ok(!/res\.status\(401\)/.test(shadow));

  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));
  assert.ok(!helper.includes('.save('));
  assert.ok(!helper.includes('jwt.sign'));
  assert.ok(!helper.includes('.emit('));
  assert.ok(!/\.create\(/.test(helper));

  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
  // Phase 7.6: allowlist may be backups/monitoring/tenants — never wildcard
  const routesLine = (env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [,''])[1].trim();
  assert.ok(!routesLine.includes('*'));
  if (/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env)) {
    const allowed = new Set(['backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows', 'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers']);
    const parts = routesLine.split(',').map((s) => s.trim()).filter(Boolean).sort();
    assert.ok(parts.every((p) => allowed.has(p)));
    assert.ok(parts.includes('backups'));
  }
});

test('Phase7.1 static: cutoverAuthority is pure env reader; readCutoverConfigFromEnv exposed', () => {
  const cfg = readCutoverConfigFromEnv({
    POLICY_CUTOVER_ENABLED: 'true',
    POLICY_CUTOVER_ROUTES: 'monitoring',
  });
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.routes, ['monitoring']);
  assert.equal(AUTHORITY.LEGACY, 'LEGACY');
  assert.equal(AUTHORITY.POLICY, 'POLICY');
});
