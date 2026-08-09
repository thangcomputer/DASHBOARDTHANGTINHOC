/**
 * Phase 7.18 — Controlled cutover + production activation for /api/files
 *
 * LIVE: auth → policyShadowFile → filesCutoverGate → handler/uploadMiddleware.
 * upload: open cats auth-only; training any-perm; else SYSTEM_SETTINGS.
 * categories: auth-only.
 * list/stats/purge: SYSTEM_SETTINGS.
 * delete: ownership in service (Policy mirrors; missing → ALLOW/404).
 * Storage I/O remains handler/service-owned.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AUTHORITY,
  getAuthorizationAuthority,
  readCutoverConfigFromEnv,
} = require('../../services/policyShadow/cutoverAuthority');
const {
  buildSubject,
  evaluateLegacyFile,
  evaluatePolicyFile,
  compareDecisions,
  ACTIONS,
  OPEN_UPLOAD_CATEGORIES,
} = require('../../services/policyShadow/filePolicy');
const {
  filesCutoverGate,
  SETTINGS_ACTIONS,
} = require('../../middleware/filesCutoverGate');
const { PERMISSIONS } = require('../../constants/permissions');

const ROOT = path.join(__dirname, '../..');
const ACTOR = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';
const PROD = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files',
};
const NO_FILES = {
  POLICY_CUTOVER_ENABLED: 'true',
  POLICY_CUTOVER_ROUTES:
    'backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed',
};
const ALL_OFF = { POLICY_CUTOVER_ENABLED: 'false', POLICY_CUTOVER_ROUTES: '' };
const WILDCARD = { POLICY_CUTOVER_ENABLED: 'true', POLICY_CUTOVER_ROUTES: '*' };
const MALFORMED = { POLICY_CUTOVER_ENABLED: 'banana', POLICY_CUTOVER_ROUTES: 'files' };

function parseDotEnvFile() {
  const envFile = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const parsed = {};
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) parsed[m[1].trim()] = m[2].trim();
  }
  return parsed;
}

function sub(opts = {}) {
  const role = opts.role ?? 'staff';
  return buildSubject({
    user: { id: opts.id ?? ACTOR, role, adminRole: opts.adminRole },
    actorDoc: role === 'student'
      ? null
      : {
          role,
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
        },
    userBranchId: opts.userBranchId ?? null,
  });
}

function parity(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyFile(subject, action, ctx);
  const policy = evaluatePolicyFile(subject, action, ctx, untrusted);
  assert.equal(compareDecisions(legacy, policy), 'MATCH', action);
  return { legacy, policy };
}

function withEnv(env, fn) {
  const prevE = process.env.POLICY_CUTOVER_ENABLED;
  const prevR = process.env.POLICY_CUTOVER_ROUTES;
  process.env.POLICY_CUTOVER_ENABLED = env.POLICY_CUTOVER_ENABLED;
  process.env.POLICY_CUTOVER_ROUTES = env.POLICY_CUTOVER_ROUTES;
  try {
    return fn();
  } finally {
    if (prevE === undefined) delete process.env.POLICY_CUTOVER_ENABLED;
    else process.env.POLICY_CUTOVER_ENABLED = prevE;
    if (prevR === undefined) delete process.env.POLICY_CUTOVER_ROUTES;
    else process.env.POLICY_CUTOVER_ROUTES = prevR;
  }
}

function shadowFrom(action, subject, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyFile(subject, action, ctx);
  const policy = evaluatePolicyFile(subject, action, ctx, untrusted);
  return {
    comparison: compareDecisions(legacy, policy),
    policyDecision: policy.decision,
    policyReason: policy.reason,
    policyStatusHint: policy.statusHint,
    legacyDecision: legacy.decision,
  };
}

function runGate(action, { user, policyShadow, query = {}, body = {} }, env) {
  return withEnv(env, () => new Promise((resolve) => {
    const mw = filesCutoverGate(action);
    let nextCount = 0;
    let statusCode = null;
    let bodyOut = null;
    let settled = false;
    const req = {
      user,
      body,
      query,
      headers: {},
      policyShadow,
      originalUrl: `/api/files/${action}`,
      method: 'GET',
      requestId: 'p718',
      correlationId: 'p718',
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ nextCount, statusCode, bodyOut, req });
    };
    const res = {
      status(c) { statusCode = c; return this; },
      json(b) { bodyOut = b; finish(); return this; },
    };
    mw(req, res, () => { nextCount += 1; finish(); });
  }));
}

// ── Config ───────────────────────────────────────────────────────────────────

test('Phase7.18 config OFF → Legacy', () => {
  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);
});

test('Phase7.18 config ON + files allowlisted → Policy', () => {
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('files')), AUTHORITY.POLICY);
});

test('Phase7.18 allowlist exclusion → Legacy', () => {
  assert.equal(withEnv(NO_FILES, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);
});

test('Phase7.18 malformed / wildcard / unknown → Legacy', () => {
  assert.equal(withEnv(MALFORMED, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);
  assert.equal(withEnv(WILDCARD, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);
  assert.equal(withEnv(PROD, () => getAuthorizationAuthority('not-a-family')), AUTHORITY.LEGACY);
});

test('Phase7.18 activation .env includes files + prior Policy families', () => {
  const parsed = parseDotEnvFile();
  assert.equal(parsed.POLICY_CUTOVER_ENABLED, 'true');
  const routes = String(parsed.POLICY_CUTOVER_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const required of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files',
  ]) {
    assert.ok(routes.includes(required), required);
  }
  assert.ok(routes.every((r) => [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications', 'blog', 'feed', 'files', 'settings', 'messages', 'schedules', 'quizzes', 'assignments', 'proctor', 'evaluations', 'bi', 'analytics', 'staff', 'employees', 'exam-results', 'teachers',
  ].includes(r)));
  for (const fam of [
    'files', 'feed', 'blog', 'notifications', 'branches', 'training-lms', 'training', 'courses',
    'builder', 'workflows', 'ai', 'backups', 'monitoring', 'tenants', 'system-logs',
  ]) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.POLICY, fam);
  }
  for (const fam of ['auth', 'finance', 'students']) {
    assert.equal(getAuthorizationAuthority(fam, null, parsed), AUTHORITY.LEGACY, fam);
  }
  assert.ok(!readCutoverConfigFromEnv(parsed).routes.includes('*'));
});

// ── Parity ───────────────────────────────────────────────────────────────────

test('Phase7.18 categories: authenticated ALLOW; unauthenticated DENY', () => {
  const cases = [
    [sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }), 'ALLOW'],
    [sub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'STAFF', permissions: [] }), 'ALLOW'],
    [sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [] }), 'ALLOW'],
    [sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] }), 'ALLOW'],
    [sub({ id: 's1', role: 'student', adminRole: null, permissions: [] }), 'ALLOW'],
    [buildSubject({ user: {}, actorDoc: null }), 'DENY'],
  ];
  for (const [subject, expected] of cases) {
    assert.equal(parity('categories', subject).policy.decision, expected);
  }
});

test('Phase7.18 upload: open categories any auth; general needs SYSTEM_SETTINGS; training any-perm', () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] });
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  const staffNo = sub({ permissions: [] });
  const staffOk = sub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const trainOk = sub({ permissions: [PERMISSIONS.MANAGE_TRAINING] });

  for (const cat of OPEN_UPLOAD_CATEGORIES) {
    assert.equal(parity('upload', teacher, { category: cat }).policy.decision, 'ALLOW');
    assert.equal(parity('upload', student, { category: cat }).policy.decision, 'ALLOW');
  }
  assert.equal(parity('upload', staffNo, { category: 'general' }).policy.decision, 'DENY');
  assert.equal(parity('upload', staffOk, { category: 'general' }).policy.decision, 'ALLOW');
  assert.equal(parity('upload', trainOk, { category: 'training' }).policy.decision, 'ALLOW');
  assert.equal(
    parity('upload', teacher, { category: 'training' }).policy.decision,
    'DENY',
  );
});

test('Phase7.18 list/stats/purge: SYSTEM_SETTINGS; actor matrix', () => {
  const ok = sub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const none = sub({ permissions: [] });
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  for (const action of SETTINGS_ACTIONS) {
    assert.equal(parity(action, ok).policy.decision, 'ALLOW', action);
    assert.equal(parity(action, none).policy.decision, 'DENY', action);
    assert.equal(parity(action, teacher).policy.decision, 'DENY', action);
  }
});

test('Phase7.18 delete: owner/manage ALLOW; stranger DENY; missing → ALLOW(404)', () => {
  const owner = sub({ id: ACTOR, permissions: [] });
  const other = sub({ id: OTHER, permissions: [] });
  const manager = sub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const teacherMgr = sub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
  });

  assert.equal(parity('delete', owner, { asset: { uploadedBy: ACTOR } }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', other, { asset: { uploadedBy: ACTOR } }).policy.decision, 'DENY');
  assert.equal(parity('delete', manager, { asset: { uploadedBy: OTHER } }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', teacherMgr, { asset: { uploadedBy: OTHER } }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', other, { asset: { uploadedBy: '' } }).policy.decision, 'ALLOW');
  assert.equal(parity('delete', owner, { asset: null }).policy.decision, 'ALLOW');
});

test('Phase7.18 spoof resistance: body/query identity cannot elevate', () => {
  const none = sub({ permissions: [] });
  const spoof = {
    bodyRole: 'admin',
    clientAdminRole: 'SUPER_ADMIN',
    clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
    bodyUserId: OTHER,
    bodyOwnerId: OTHER,
    bodyBranchId: 'b1',
    bodyTenantId: 't1',
    queryUploadedBy: ACTOR,
  };
  assert.equal(parity('list', none, {}, spoof).policy.decision, 'DENY');
  assert.equal(
    parity('delete', none, { asset: { uploadedBy: OTHER } }, spoof).policy.decision,
    'DENY',
  );
});

// ── Gate decisions ───────────────────────────────────────────────────────────

test('Phase7.18 Policy ALLOW categories → next()', async () => {
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  const shadow = shadowFrom('categories', student);
  const r = await runGate('categories', {
    user: { id: 's1', role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 1);
  assert.equal(r.statusCode, null);
});

test('Phase7.18 Policy DENY list → 403 Legacy message', async () => {
  const none = sub({ permissions: [] });
  const shadow = shadowFrom('list', none);
  const r = await runGate('list', {
    user: { id: ACTOR, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.req.authzAuthority, AUTHORITY.POLICY);
  assert.equal(r.nextCount, 0);
  assert.equal(r.statusCode, 403);
  assert.match(r.bodyOut.message, /không có quyền|Yêu cầu quyền/i);
});

test('Phase7.18 Policy DENY delete → 403 ownership message', async () => {
  const other = sub({ id: OTHER, permissions: [] });
  const shadow = shadowFrom('delete', other, { asset: { uploadedBy: ACTOR } });
  const r = await runGate('delete', {
    user: { id: OTHER, role: 'staff' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(r.statusCode, 403);
  assert.equal(r.bodyOut.message, 'Khong co quyen xoa file nay');
});

test('Phase7.18 Policy DENY unauthenticated → 401', async () => {
  const shadow = {
    comparison: 'MATCH',
    policyDecision: 'DENY',
    policyReason: 'policy_unauthenticated',
    policyStatusHint: 401,
  };
  const r = await runGate('categories', { user: undefined, policyShadow: shadow }, PROD);
  assert.equal(r.statusCode, 401);
  assert.equal(r.nextCount, 0);
});

test('Phase7.18 Policy ERROR / UNKNOWN → Legacy fallback', async () => {
  for (const comparison of ['ERROR', 'UNKNOWN']) {
    const r = await runGate('categories', {
      user: { id: ACTOR, role: 'staff' },
      policyShadow: {
        comparison,
        policyDecision: comparison === 'ERROR' ? undefined : 'WEIRD',
        policyReason: 'test',
      },
    }, PROD);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY, comparison);
    assert.equal(r.nextCount, 1, comparison);
  }
});

test('Phase7.18 cutover OFF / exclusion / wildcard / malformed → Legacy', async () => {
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  const shadow = shadowFrom('categories', student);
  for (const env of [ALL_OFF, NO_FILES, WILDCARD, MALFORMED]) {
    const r = await runGate('categories', {
      user: { id: 's1', role: 'student' },
      policyShadow: shadow,
    }, env);
    assert.equal(r.req.authzAuthority, AUTHORITY.LEGACY);
    assert.equal(r.nextCount, 1);
  }
});

// ── Rollback / isolation / static ────────────────────────────────────────────

test('Phase7.18 rollback: remove files → LEGACY; prior stay POLICY; restore → POLICY', async () => {
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  const shadow = shadowFrom('categories', student);

  assert.equal(withEnv(NO_FILES, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);
  assert.equal(withEnv(NO_FILES, () => getAuthorizationAuthority('feed')), AUTHORITY.POLICY);
  assert.equal(withEnv(NO_FILES, () => getAuthorizationAuthority('blog')), AUTHORITY.POLICY);

  const rolled = await runGate('categories', {
    user: { id: 's1', role: 'student' },
    policyShadow: shadow,
  }, NO_FILES);
  assert.equal(rolled.req.authzAuthority, AUTHORITY.LEGACY);

  assert.equal(withEnv(ALL_OFF, () => getAuthorizationAuthority('files')), AUTHORITY.LEGACY);

  const restored = await runGate('categories', {
    user: { id: 's1', role: 'student' },
    policyShadow: shadow,
  }, PROD);
  assert.equal(restored.req.authzAuthority, AUTHORITY.POLICY);

  const parsed = parseDotEnvFile();
  assert.ok(String(parsed.POLICY_CUTOVER_ROUTES).split(',').map((s) => s.trim()).includes('files'));
});

test('Phase7.18 cross-family isolation', () => {
  const legacyFamilies = [
    'auth', 'finance', 'invoices', 'transactions', 'webhooks', 'students', 'teachers',
    'employees', 'exam-results', 'quizzes', 'assignments', 'evaluations', 
    'proctor', 'schedules', 'messages', 'settings',
  ];
  for (const fam of legacyFamilies) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.LEGACY, fam);
  }
  for (const fam of [
    'backups', 'monitoring', 'tenants', 'system-logs', 'ai', 'workflows',
    'builder', 'courses', 'training', 'training-lms', 'branches', 'notifications',
    'blog', 'feed', 'files',
  ]) {
    assert.equal(withEnv(PROD, () => getAuthorizationAuthority(fam)), AUTHORITY.POLICY, fam);
  }
});

test('Phase7.18 middleware order + only fileRoutes uses filesCutoverGate', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'routes/fileRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/filesCutoverGate.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.ok(server.includes("app.use('/api/files'"));
  assert.ok(routes.includes('filesGuard'));
  assert.ok(routes.includes("filesGuard('upload')"));
  assert.ok(routes.includes("filesGuard('delete')"));
  assert.ok(routes.includes('authMiddleware'));
  assert.ok(routes.includes('uploadMiddleware'));
  assert.ok(gate.includes("getAuthorizationAuthority('files')"));
  assert.ok(gate.includes('legacyFilesGate'));
  assert.ok(gate.includes('SYSTEM_SETTINGS'));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  for (const name of fs.readdirSync(path.join(ROOT, 'routes'))) {
    if (!name.endsWith('.js') || name === 'fileRoutes.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'routes', name), 'utf8');
    assert.ok(!src.includes('filesCutoverGate'), name);
  }
  for (const a of ACTIONS) {
    assert.ok(routes.includes(`filesGuard('${a}')`), a);
  }
});

test('Phase7.18 side-effect audit: gate/policy/shadow have no storage mutations', () => {
  const files = [
    'middleware/filesCutoverGate.js',
    'services/policyShadow/filePolicy.js',
  ];
  const banned = [
    '.save(', '.create(', '.update(', '.delete(', '.findOneAndUpdate(',
    'fs.unlink', 'fs.writeFile', 'enqueue', '.emit(', 'NotificationService', 'BullMQ',
    'createReadStream', 'registerUploadedFile', 'purgeExpired',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const b of banned) {
      assert.ok(!src.includes(b), `${rel} must not contain ${b}`);
    }
  }
  const shadow = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowFile.js'), 'utf8');
  for (const b of ['.save(', '.create(', 'fs.unlink', 'enqueue', '.emit(', 'NotificationService']) {
    assert.ok(!shadow.includes(b), `shadow must not contain ${b}`);
  }
  assert.ok(shadow.includes('.lean()'));
  assert.ok(shadow.includes('policyStatusHint'));
});

test('Phase7.18 functional smoke: categories authz; mutations NOT EXECUTED', () => {
  const student = sub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  assert.equal(parity('categories', student).policy.decision, 'ALLOW');
  assert.equal(
    'NOT EXECUTED — upload/delete/purge production storage mutation',
    'NOT EXECUTED — upload/delete/purge production storage mutation',
  );
});

test('Phase7.18 static final authority + CQRS OFF + .env.example disabled', () => {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*true/.test(env));
  assert.ok(
    /POLICY_CUTOVER_ROUTES\s*=\s*backups,monitoring,tenants,system-logs,ai,workflows,builder,courses,training,training-lms,branches,notifications,blog,feed,files(?:,settings(?:,messages(?:,schedules(?:,quizzes(?:,assignments(?:,proctor(?:,evaluations(?:,bi(?:,analytics(?:,staff(?:,employees(?:,exam-results(,teachers)?)?)?)?)?)?)?)?)?)?)?)?)?\s*$/m.test(env),
  );
  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/POLICY_CUTOVER_ENABLED\s*=\s*false/.test(example));
  assert.ok(!/\*/.test((env.match(/^POLICY_CUTOVER_ROUTES=(.*)$/m) || [, ''])[1]));
});
