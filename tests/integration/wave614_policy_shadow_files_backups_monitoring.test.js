/**
 * Wave 6.14 — Policy SHADOW for LIVE files / backups / monitoring.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildFileSubject,
  evaluateLegacyFile,
  evaluatePolicyFile,
  compareDecisions: compareFile,
  OPEN_UPLOAD_CATEGORIES,
} = require('../../services/policyShadow/filePolicy');
const {
  buildSubject: buildBackupSubject,
  evaluateLegacyBackup,
  evaluatePolicyBackup,
  compareDecisions: compareBackup,
} = require('../../services/policyShadow/backupPolicy');
const {
  buildSubject: buildMonSubject,
  evaluateLegacyMonitoring,
  evaluatePolicyMonitoring,
  compareDecisions: compareMon,
} = require('../../services/policyShadow/monitoringPolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const ACTOR = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';
const ROOT = path.join(__dirname, '../..');

function fileSub(opts = {}) {
  return buildFileSubject({
    user: { id: opts.id ?? ACTOR, role: opts.role ?? 'staff' },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function backupSub(opts = {}) {
  return buildBackupSubject({
    user: { id: opts.id ?? ACTOR, role: opts.role ?? 'admin' },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'admin',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function monSub(opts = {}) {
  return buildMonSubject({
    user: { id: opts.id ?? ACTOR, role: opts.role ?? 'staff' },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertFile(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyFile(subject, action, ctx);
  const policy = evaluatePolicyFile(subject, action, ctx, untrusted);
  const result = compareFile(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

function assertBackup(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyBackup(subject, action);
  const policy = evaluatePolicyBackup(subject, action, {}, untrusted);
  const result = compareBackup(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

function assertMon(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyMonitoring(subject, action);
  const policy = evaluatePolicyMonitoring(subject, action, {}, untrusted);
  const result = compareMon(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

// ── Files ────────────────────────────────────────────────────────────────────

test('Wave6.14 FILE: open upload categories ALLOW any authenticated role', () => {
  const teacher = fileSub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] });
  const student = fileSub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  for (const cat of OPEN_UPLOAD_CATEGORIES) {
    assert.equal(assertFile(`t-${cat}`, teacher, 'upload', { category: cat }).legacy.decision, 'ALLOW');
    assert.equal(assertFile(`s-${cat}`, student, 'upload', { category: cat }).legacy.decision, 'ALLOW');
  }
});

test('Wave6.14 FILE: general upload needs SYSTEM_SETTINGS; training any of three perms', () => {
  const staffNo = fileSub({ permissions: [] });
  const staffOk = fileSub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const trainOk = fileSub({ permissions: [PERMISSIONS.MANAGE_TRAINING] });
  const teacherTrain = fileSub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_TRAINING],
  });
  assert.equal(assertFile('gen-', staffNo, 'upload', { category: 'general' }).legacy.decision, 'DENY');
  assert.equal(assertFile('gen+', staffOk, 'upload', { category: 'general' }).legacy.decision, 'ALLOW');
  assert.equal(assertFile('tr+', trainOk, 'upload', { category: 'training' }).legacy.decision, 'ALLOW');
  assert.equal(assertFile('tr-t', teacherTrain, 'upload', { category: 'training' }).legacy.decision, 'DENY');
});

test('Wave6.14 FILE: list/stats/purge SYSTEM_SETTINGS; categories auth-only', () => {
  const ok = fileSub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const view = fileSub({ permissions: [PERMISSIONS.VIEW_LOGS] });
  const teacher = fileSub({ id: 't1', role: 'teacher', adminRole: null, permissions: [] });
  assert.equal(assertFile('list+', ok, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertFile('list-', view, 'list').legacy.decision, 'DENY');
  assert.equal(assertFile('stats-', view, 'stats').legacy.decision, 'DENY');
  assert.equal(assertFile('purge+', ok, 'purge_expired').legacy.decision, 'ALLOW');
  assert.equal(assertFile('cat-t', teacher, 'categories').legacy.decision, 'ALLOW');
});

test('Wave6.14 FILE: delete owner ALLOW; other DENY; SYSTEM_SETTINGS bypass; empty owner ALLOW; missing 404 ALLOW', () => {
  const owner = fileSub({ id: ACTOR, permissions: [] });
  const other = fileSub({ id: OTHER, permissions: [] });
  const manager = fileSub({ permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const teacherMgr = fileSub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.SYSTEM_SETTINGS],
  });
  assert.equal(
    assertFile('own', owner, 'delete', { asset: { uploadedBy: ACTOR } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFile('oth', other, 'delete', { asset: { uploadedBy: ACTOR } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertFile('mgr', manager, 'delete', { asset: { uploadedBy: OTHER } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFile('tmgr', teacherMgr, 'delete', { asset: { uploadedBy: OTHER } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertFile('empty', other, 'delete', { asset: { uploadedBy: '' } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertFile('miss', owner, 'delete', { asset: null }).legacy.decision, 'ALLOW');
});

test('Wave6.14 FILE: spoof cannot widen list/delete', () => {
  const none = fileSub({ permissions: [] });
  assert.equal(
    assertFile('spoof-list', none, 'list', {}, {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
      queryUploadedBy: ACTOR,
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertFile('spoof-del', none, 'delete', { asset: { uploadedBy: OTHER } }, {
      bodyUserId: OTHER,
      bodyOwnerId: OTHER,
    }).legacy.decision,
    'DENY',
  );
});

// ── Backups ──────────────────────────────────────────────────────────────────

test('Wave6.14 BACKUP: SUPER ALLOW all; HIGH/STAFF/teacher DENY', () => {
  const root = backupSub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] });
  const superDb = backupSub({ adminRole: 'SUPER_ADMIN', permissions: [] });
  const high = backupSub({ adminRole: 'HIGH_ADMIN', permissions: [PERMISSIONS.SYSTEM_SETTINGS] });
  const staff = backupSub({ role: 'staff', adminRole: 'STAFF', permissions: Object.values(PERMISSIONS) });
  for (const a of ['stats', 'list', 'create', 'download', 'delete']) {
    assert.equal(assertBackup(`r-${a}`, root, a).legacy.decision, 'ALLOW');
    assert.equal(assertBackup(`s-${a}`, superDb, a).legacy.decision, 'ALLOW');
    assert.equal(assertBackup(`h-${a}`, high, a).legacy.decision, 'DENY');
    assert.equal(assertBackup(`st-${a}`, staff, a).legacy.decision, 'DENY');
  }
});

test('Wave6.14 BACKUP: spoof role/perm/branch/tenant cannot widen', () => {
  const high = backupSub({ adminRole: 'HIGH_ADMIN', permissions: [] });
  assert.equal(
    assertBackup('spoof', high, 'create', {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
      bodyBranchId: BRANCH_A,
      bodyTenantId: 't1',
    }).legacy.decision,
    'DENY',
  );
});

// ── Monitoring ───────────────────────────────────────────────────────────────

test('Wave6.14 MON: isAdmin allows admin/staff roles; teacher/student DENY', () => {
  const staff = monSub({ role: 'staff', adminRole: 'STAFF' });
  const admin = monSub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  const teacher = monSub({ id: 't1', role: 'teacher', adminRole: null });
  const student = monSub({ id: 's1', role: 'student', adminRole: null });
  for (const a of ['health', 'metrics', 'overview']) {
    assert.equal(assertMon(`st-${a}`, staff, a).legacy.decision, 'ALLOW');
    assert.equal(assertMon(`ad-${a}`, admin, a).legacy.decision, 'ALLOW');
    assert.equal(assertMon(`t-${a}`, teacher, a).legacy.decision, 'DENY');
    assert.equal(assertMon(`s-${a}`, student, a).legacy.decision, 'DENY');
  }
});

test('Wave6.14 MON: metrics_reset SUPER only after isAdmin', () => {
  const high = monSub({ role: 'admin', adminRole: 'HIGH_ADMIN' });
  const staff = monSub({ role: 'staff', adminRole: 'STAFF' });
  const superDb = monSub({ role: 'admin', adminRole: 'SUPER_ADMIN' });
  const root = monSub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' });
  assert.equal(assertMon('reset-h', high, 'metrics_reset').legacy.decision, 'DENY');
  assert.equal(assertMon('reset-st', staff, 'metrics_reset').legacy.decision, 'DENY');
  assert.equal(assertMon('reset-s', superDb, 'metrics_reset').legacy.decision, 'ALLOW');
  assert.equal(assertMon('reset-r', root, 'metrics_reset').legacy.decision, 'ALLOW');
});

test('Wave6.14 MON: spoof cannot widen teacher to health', () => {
  const teacher = monSub({ id: 't1', role: 'teacher', adminRole: null });
  assert.equal(
    assertMon('spoof', teacher, 'health', {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
    }).legacy.decision,
    'DENY',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.14 fail-closed: file Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/filePolicy');
  const mwPath = require.resolve('../../middleware/policyShadowFile');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/filePolicy');
  policyMod.evaluatePolicyFile = () => { throw new Error('forced file policy failure'); };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [PERMISSIONS.SYSTEM_SETTINGS], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowFile } = require('../../middleware/policyShadowFile');
    const mw = policyShadowFile('categories');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR, role: 'staff' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/files/categories',
      requestId: 'req-wave614',
      correlationId: 'corr-wave614',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/filePolicy');
    require('../../middleware/policyShadowFile');
  }
});

test('Wave6.14 fail-closed: backup Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/backupPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowBackup');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/backupPolicy');
  policyMod.evaluatePolicyBackup = () => { throw new Error('forced backup policy failure'); };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'SUPER_ADMIN', permissions: [], role: 'admin' }) };
    },
  });
  try {
    const { policyShadowBackup } = require('../../middleware/policyShadowBackup');
    const mw = policyShadowBackup('list');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR, role: 'admin' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/backups',
      requestId: 'req-wave614-b',
      correlationId: 'corr-wave614-b',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/backupPolicy');
    require('../../middleware/policyShadowBackup');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.14 static: legacy gates remain; Policy shadow-only; CQRS OFF; modules unmounted', () => {
  const files = fs.readFileSync(path.join(ROOT, 'routes/fileRoutes.js'), 'utf8');
  const backups = fs.readFileSync(path.join(ROOT, 'routes/backupRoutes.js'), 'utf8');
  const monitoring = fs.readFileSync(path.join(ROOT, 'routes/monitoringRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');

  assert.ok(files.includes("filesGuard('upload')") || files.includes("policyShadowFile('upload')"));
  assert.ok(files.includes("filesGuard('stats')") || files.includes("policyShadowFile('stats')"));
  assert.ok(files.includes("filesGuard('categories')") || files.includes("policyShadowFile('categories')"));
  assert.ok(files.includes("filesGuard('list')") || files.includes("policyShadowFile('list')"));
  assert.ok(files.includes("filesGuard('purge_expired')") || files.includes("policyShadowFile('purge_expired')"));
  assert.ok(files.includes("filesGuard('delete')") || files.includes("policyShadowFile('delete')"));
  assert.ok(files.includes('filesCutoverGate') || files.includes('filesGuard'));
  assert.ok(
    files.includes('requireUploadCategoryPermission')
    || fs.readFileSync(path.join(ROOT, 'middleware/filesCutoverGate.js'), 'utf8').includes('requireUploadCategoryPermission'),
  );
  assert.ok(
    files.includes('checkPermission(PERMISSIONS.SYSTEM_SETTINGS)')
    || fs.readFileSync(path.join(ROOT, 'middleware/filesCutoverGate.js'), 'utf8').includes('SYSTEM_SETTINGS'),
  );
  assert.ok(files.includes('fileService.deleteById'));
  const filesGate = fs.readFileSync(path.join(ROOT, 'middleware/filesCutoverGate.js'), 'utf8');
  assert.ok(filesGate.includes("getAuthorizationAuthority('files')"));
  assert.ok(filesGate.includes('legacyFilesGate'));
  assert.ok(!filesGate.includes('fs.unlink'));
  assert.ok(!filesGate.includes('.emit('));

  for (const a of ['stats', 'list', 'create', 'download', 'delete']) {
    assert.ok(backups.includes(`guard('${a}')`) || backups.includes(`policyShadowBackup('${a}')`), a);
  }
  assert.ok(backups.includes('isSuperAdmin') || backups.includes('backupsCutoverGate'));
  assert.ok(backups.includes('backupsCutoverGate'));
  assert.ok(backups.includes('policyShadowBackup'));

  for (const a of ['health', 'metrics', 'overview', 'metrics_reset']) {
    assert.ok(monitoring.includes(`guard('${a}')`) || monitoring.includes(`policyShadowMonitoring('${a}')`), a);
  }
  assert.ok(monitoring.includes('isAdmin') || monitoring.includes('monitoringCutoverGate'));
  assert.ok(monitoring.includes('monitoringCutoverGate'));
  assert.ok(monitoring.includes("req.user?.adminRole === 'SUPER_ADMIN'"));

  assert.ok(server.includes("app.use('/api/files'"));
  assert.ok(server.includes("app.use('/api/backups'"));
  assert.ok(server.includes("app.use('/api/monitoring'"));
  assert.ok(!server.includes("require('./modules/file"));
  assert.ok(!server.includes("require('./modules/report"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.ok(!/MANAGE_FILES|MANAGE_BACKUPS|VIEW_MONITORING|manage_files/.test(perms));
  assert.ok(!/\bio\.emit\(/.test(files));
  assert.ok(!/\bio\.emit\(/.test(backups));
  assert.ok(!/\bio\.emit\(/.test(monitoring));
});

test('Wave6.14 static: shadow middleware always next(); no HTTP 403', () => {
  for (const rel of [
    'middleware/policyShadowFile.js',
    'middleware/policyShadowBackup.js',
    'middleware/policyShadowMonitoring.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
  }
});
