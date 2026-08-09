/**
 * Wave 6.16 — Policy SHADOW for LIVE /api/system-logs + /api/webhooks (SePay).
 * JWT webhook session/status already shadowed by financePolicy (Wave 6.6) — not re-wired.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildLogSubject,
  evaluateLegacySystemLog,
  evaluatePolicySystemLog,
  compareDecisions: compareLog,
} = require('../../services/policyShadow/systemLogsPolicy');
const {
  buildSubject: buildWhSubject,
  evaluateLegacyWebhook,
  evaluatePolicyWebhook,
  compareDecisions: compareWh,
} = require('../../services/policyShadow/webhookPolicy');
const {
  buildSubject: buildFinSubject,
  evaluateLegacyFinance,
  evaluatePolicyFinance,
  compareDecisions: compareFin,
} = require('../../services/policyShadow/financePolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const ACTOR = '507f1f77bcf86cd799439011';
const STUDENT_A = '507f1f77bcf86cd7994390s1';
const ROOT = path.join(__dirname, '../..');

function logSub(opts = {}) {
  return buildLogSubject({
    user: { id: opts.id ?? ACTOR, role: opts.role ?? 'staff' },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function whSub() {
  return buildWhSubject({
    user: { id: 'sepay', role: 'system' },
    actorDoc: null,
    userBranchId: null,
  });
}

function assertLog(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacySystemLog(subject, action, ctx);
  const policy = evaluatePolicySystemLog(subject, action, ctx, untrusted);
  const result = compareLog(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertWh(label, ctx = {}, untrusted = {}) {
  const subject = whSub();
  const legacy = evaluateLegacyWebhook(subject, 'sepay', ctx);
  const policy = evaluatePolicyWebhook(subject, 'sepay', ctx, untrusted);
  const result = compareWh(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

// ── System logs ──────────────────────────────────────────────────────────────

test('Wave6.16 LOG: isAdmin admin/staff ALLOW; teacher/student DENY; VIEW_LOGS unused', () => {
  const staff = logSub({ role: 'staff', permissions: [] });
  const admin = logSub({ role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [] });
  const support = logSub({ role: 'staff', adminRole: 'SUPPORT', permissions: [PERMISSIONS.VIEW_LOGS] });
  const teacher = logSub({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.VIEW_LOGS, PERMISSIONS.SYSTEM_SETTINGS],
  });
  const student = logSub({ id: 's1', role: 'student', adminRole: null, permissions: [] });
  for (const a of ['list', 'create', 'delete']) {
    assert.equal(assertLog(`st-${a}`, staff, a).legacy.decision, 'ALLOW');
    assert.equal(assertLog(`ad-${a}`, admin, a).legacy.decision, 'ALLOW');
    assert.equal(assertLog(`sup-${a}`, support, a).legacy.decision, 'ALLOW');
    assert.equal(assertLog(`t-${a}`, teacher, a).legacy.decision, 'DENY');
    assert.equal(assertLog(`s-${a}`, student, a).legacy.decision, 'DENY');
  }
});

test('Wave6.16 LOG: SUPER/HIGH with admin role ALLOW; platform scope (no branch deny)', () => {
  const superDb = logSub({
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const staffA = logSub({ role: 'staff', userBranchId: BRANCH_A });
  assert.equal(assertLog('super', superDb, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertLog('staff-a', staffA, 'list').legacy.decision, 'ALLOW');
  assert.equal(assertLog('staff-a', staffA, 'list').legacy.dataScope, 'platform');
});

test('Wave6.16 LOG: missing delete resource ALLOW(404); spoof cannot widen teacher', () => {
  const staff = logSub({ role: 'staff' });
  const teacher = logSub({ id: 't1', role: 'teacher', adminRole: null, permissions: [PERMISSIONS.VIEW_LOGS] });
  assert.equal(assertLog('miss', staff, 'delete', { log: null }).legacy.decision, 'ALLOW');
  assert.equal(
    assertLog('spoof', teacher, 'list', {}, {
      bodyRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.VIEW_LOGS],
      bodyBranchId: BRANCH_A,
      bodyTenantId: 't1',
      bodyUserId: 'admin',
      bodyAction: 'EXPORT_REPORT',
    }).legacy.decision,
    'DENY',
  );
});

// ── SePay webhook verification matrix ────────────────────────────────────────

test('Wave6.16 SEPAY: verified / dev_skip ALLOW; invalid/missing/not_configured DENY', () => {
  assert.equal(assertWh('ok', { verificationStatus: 'verified' }).legacy.decision, 'ALLOW');
  assert.equal(assertWh('dev', { verificationStatus: 'dev_skip' }).legacy.decision, 'ALLOW');
  assert.equal(assertWh('miss', { verificationStatus: 'missing_signature' }).legacy.decision, 'DENY');
  assert.equal(assertWh('bad', { verificationStatus: 'invalid_signature' }).legacy.decision, 'DENY');
  assert.equal(assertWh('key', { verificationStatus: 'invalid_api_key' }).legacy.decision, 'DENY');
  assert.equal(assertWh('cred', { verificationStatus: 'invalid_credentials' }).legacy.decision, 'DENY');
  assert.equal(
    assertWh('prod', { verificationStatus: 'not_configured_production' }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertWh('prod', { verificationStatus: 'not_configured_production' }).legacy.statusHint,
    503,
  );
});

test('Wave6.16 SEPAY: spoof body/header fields ignored — decision follows trusted ctx only', () => {
  assert.equal(
    assertWh('spoof-deny', { verificationStatus: 'invalid_signature' }, {
      bodyRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_FINANCE],
      bodyUserId: 'admin',
      bodyTenantId: 't1',
      spoofedSignature: 'evil',
      bodyProvider: 'sepay',
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertWh('spoof-allow', { verificationStatus: 'verified' }, {
      spoofedSignature: 'wrong',
      bodyUserId: STUDENT_A,
    }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.16 JWT webhooks still finance-shadowed (auth / self_or_staff) MATCH', () => {
  const student = buildFinSubject({
    user: { id: STUDENT_A, role: 'student' },
    actorDoc: null,
    userBranchId: null,
  });
  const staff = buildFinSubject({
    user: { id: ACTOR, role: 'staff' },
    actorDoc: { adminRole: 'STAFF', permissions: [], role: 'staff' },
    userBranchId: BRANCH_A,
  });
  const l1 = evaluateLegacyFinance(student, 'wh_payment_session', {});
  const p1 = evaluatePolicyFinance(student, 'wh_payment_session', {}, {});
  assert.equal(compareFin(l1, p1), 'MATCH');
  assert.equal(l1.decision, 'ALLOW');

  const l2 = evaluateLegacyFinance(student, 'wh_payment_status_student', { selfId: STUDENT_A });
  const p2 = evaluatePolicyFinance(student, 'wh_payment_status_student', { selfId: STUDENT_A }, {});
  assert.equal(compareFin(l2, p2), 'MATCH');
  assert.equal(l2.decision, 'ALLOW');

  const l3 = evaluateLegacyFinance(student, 'wh_payment_status_student', { selfId: 'other' });
  const p3 = evaluatePolicyFinance(student, 'wh_payment_status_student', { selfId: 'other' }, {});
  assert.equal(compareFin(l3, p3), 'MATCH');
  assert.equal(l3.decision, 'DENY');

  const l4 = evaluateLegacyFinance(staff, 'wh_payment_status_student', { selfId: STUDENT_A });
  const p4 = evaluatePolicyFinance(staff, 'wh_payment_status_student', { selfId: STUDENT_A }, {});
  assert.equal(compareFin(l4, p4), 'MATCH');
  assert.equal(l4.decision, 'ALLOW');
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.16 fail-closed: systemLog Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/systemLogsPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowSystemLog');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/systemLogsPolicy');
  policyMod.evaluatePolicySystemLog = () => {
    throw new Error('forced system_log policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) };
    },
  });
  try {
    const { policyShadowSystemLog } = require('../../middleware/policyShadowSystemLog');
    const mw = policyShadowSystemLog('list');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR, role: 'staff' },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/system-logs',
      requestId: 'req-wave616',
      correlationId: 'corr-wave616',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = orig;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/systemLogsPolicy');
    require('../../middleware/policyShadowSystemLog');
  }
});

test('Wave6.16 fail-closed: SePay Policy throw → ERROR; next(); no finance mutation', async () => {
  const policyPath = require.resolve('../../services/policyShadow/webhookPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowWebhook');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/webhookPolicy');
  policyMod.evaluatePolicyWebhook = () => {
    throw new Error('forced sepay policy failure');
  };
  try {
    const { policyShadowWebhook } = require('../../middleware/policyShadowWebhook');
    const mw = policyShadowWebhook('sepay');
    let nextCount = 0;
    const req = {
      user: null,
      sepayVerificationStatus: 'verified',
      params: {},
      body: { transferAmount: 1000, content: 'test' },
      headers: {},
      method: 'POST',
      originalUrl: '/api/webhooks/sepay',
      requestId: 'req-wave616-w',
      correlationId: 'corr-wave616-w',
    };
    const res = {
      statusCode: null,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
    };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    require('../../services/policyShadow/webhookPolicy');
    require('../../middleware/policyShadowWebhook');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.16 static: Legacy gates remain; SePay after verify; JWT finance shadow; CQRS OFF', () => {
  const logs = fs.readFileSync(path.join(ROOT, 'routes/systemLogRoutes.js'), 'utf8');
  const webhooks = fs.readFileSync(path.join(ROOT, 'routes/webhookRoutes.js'), 'utf8');
  const whPolicy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/webhookPolicy.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const perms = fs.readFileSync(path.join(ROOT, 'constants/permissions.js'), 'utf8');

  assert.ok(logs.includes("guard('list')") || logs.includes("policyShadowSystemLog('list')"));
  assert.ok(logs.includes("guard('create')"));
  assert.ok(logs.includes("guard('delete')"));
  assert.ok(logs.includes('systemLogsCutoverGate'));
  assert.ok(logs.includes('isAdmin')); // Legacy path retained via cutover gate docs
  assert.ok(logs.includes('policyShadowSystemLog'));
  assert.ok(!logs.includes('VIEW_LOGS'));
  assert.ok(!logs.includes('checkPermission'));
  assert.ok(!logs.includes('branchFilter'));
  const logGate = fs.readFileSync(path.join(ROOT, 'middleware/systemLogsCutoverGate.js'), 'utf8');
  assert.ok(logGate.includes('isAdmin'));
  assert.ok(logGate.includes("getAuthorizationAuthority('system-logs')"));

  assert.ok(webhooks.includes('verifySepaySignature'));
  assert.ok(webhooks.includes("policyShadowWebhook('sepay')"));
  assert.ok(/verifySepaySignature,\s*policyShadowWebhook\('sepay'\)/.test(webhooks.replace(/\n/g, ' ')));
  assert.ok(webhooks.includes("policyShadowFinance('wh_payment_session')"));
  assert.ok(webhooks.includes("policyShadowFinance('wh_payment_status_student')"));
  assert.ok(webhooks.includes('settlePayment'));
  assert.ok(webhooks.includes('emitFinanceEvent'));

  // Policy must not call financial writers / crypto verify
  assert.ok(!whPolicy.includes('settlePayment'));
  assert.ok(!whPolicy.includes('PaymentSession'));
  assert.ok(!whPolicy.includes('createHmac'));
  assert.ok(!whPolicy.includes('SEPAY_SECRET'));
  assert.ok(!whPolicy.includes('io.emit'));

  assert.ok(server.includes("app.use('/api/system-logs'"));
  assert.ok(server.includes("app.use('/api/webhooks'"));
  assert.ok(!server.includes("require('./modules/report"));
  assert.ok(!server.includes("require('./modules/payment"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.ok(perms.includes('VIEW_LOGS'));
  assert.ok(!/MANAGE_SYSTEM_LOGS|MANAGE_AUDIT|manage_system_logs/.test(perms));
});

test('Wave6.16 static: shadow middleware always next(); no secrets logged', () => {
  for (const rel of [
    'middleware/policyShadowSystemLog.js',
    'middleware/policyShadowWebhook.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
    assert.ok(!/SEPAY_SECRET|SEPAY_API_KEY|password|rawBody/.test(src));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/report/routes/systemLogRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/payment/routes/webhookRoutes.js')));
});
