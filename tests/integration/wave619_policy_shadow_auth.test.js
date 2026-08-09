/**
 * Wave 6.19 — Policy SHADOW for LIVE /api/auth + final LIVE coverage freeze guards.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  ACTIONS,
  PUBLIC_ACTIONS,
  buildSubject,
  evaluateLegacyAuth,
  evaluatePolicyAuth,
  compareDecisions,
} = require('../../services/policyShadow/authPolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const ACTOR = '507f1f77bcf86cd799439011';
const ROOT = path.join(__dirname, '../..');

function sub(opts = {}) {
  const role = opts.role ?? 'staff';
  const defaultAdmin = role === 'teacher' || role === 'student' ? null : (opts.adminRole !== undefined ? opts.adminRole : 'STAFF');
  return buildSubject({
    user: { id: opts.id ?? ACTOR, role },
    actorDoc: role === 'student'
      ? null
      : {
          adminRole: opts.adminRole !== undefined ? opts.adminRole : defaultAdmin,
          permissions: opts.permissions ?? [],
          role,
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertAuth(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyAuth(subject, action);
  const policy = evaluatePolicyAuth(subject, action, {}, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

const SPOOF = {
  bodyRole: 'admin',
  clientAdminRole: 'SUPER_ADMIN',
  clientPermissions: Object.values(PERMISSIONS),
  bodyUserId: 'admin',
  bodyActorId: 'admin',
  bodyOwnerId: ACTOR,
  bodyBranchId: BRANCH_B,
  bodyTenantId: 'tenant-spoof',
};

const ANON = buildSubject({ user: {}, actorDoc: null, userBranchId: null });

// ── Public routes ────────────────────────────────────────────────────────────

test('Wave6.19 AUTH: all PUBLIC actions ALLOW for anon + any role (AUTH=PUBLIC)', () => {
  const roles = [
    ANON,
    sub({ role: 'student', id: 's1' }),
    sub({ role: 'teacher', id: 't1', adminRole: null }),
    sub({ role: 'staff', adminRole: 'STAFF' }),
    sub({ role: 'admin', adminRole: 'HIGH_ADMIN' }),
    sub({ id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' }),
    sub({ role: 'staff', adminRole: 'SUPPORT', permissions: [] }),
  ];
  for (const action of PUBLIC_ACTIONS) {
    for (const s of roles) {
      assert.equal(assertAuth(`pub-${action}`, s, action).legacy.decision, 'ALLOW');
      assert.equal(assertAuth(`pub-${action}`, s, action).legacy.auth, 'PUBLIC');
    }
  }
});

test('Wave6.19 AUTH: login/refresh/logout/oauth/captcha are public — spoof body.role is operation param, ignored as actor', () => {
  for (const action of ['login', 'login_public', 'login_internal', 'refresh', 'logout', 'mfa_verify', 'check_role', 'google', 'zalo']) {
    assert.equal(assertAuth(`spoof-${action}`, ANON, action, SPOOF).legacy.decision, 'ALLOW');
  }
});

// ── Authenticated self ───────────────────────────────────────────────────────

test('Wave6.19 AUTH: me/change-password/avatar require auth; self-scope; missing actor DENY', () => {
  const student = sub({ id: 's1', role: 'student' });
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const staff = sub({ role: 'staff' });
  for (const action of ['me', 'change_password', 'avatar']) {
    assert.equal(assertAuth(`anon-${action}`, ANON, action).legacy.decision, 'DENY');
    assert.equal(assertAuth(`s-${action}`, student, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`t-${action}`, teacher, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`st-${action}`, staff, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`st-${action}`, staff, action).legacy.ownership, 'self');
  }
});

// ── MFA internal ─────────────────────────────────────────────────────────────

test('Wave6.19 AUTH: MFA setup/enable/disable/status — internal admin|staff|hardcoded admin only', () => {
  const hard = buildSubject({ user: { id: 'admin', role: 'admin' }, actorDoc: null, userBranchId: null });
  const staff = sub({ role: 'staff', adminRole: 'STAFF' });
  const admin = sub({ role: 'admin', adminRole: 'SUPER_ADMIN' });
  const support = sub({ role: 'staff', adminRole: 'SUPPORT' });
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null });
  const student = sub({ id: 's1', role: 'student' });
  for (const action of ['mfa_setup', 'mfa_enable', 'mfa_disable', 'mfa_status']) {
    assert.equal(assertAuth(`mfa-hard-${action}`, hard, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`mfa-staff-${action}`, staff, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`mfa-admin-${action}`, admin, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`mfa-support-${action}`, support, action).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`mfa-t-${action}`, teacher, action).legacy.decision, 'DENY');
    assert.equal(assertAuth(`mfa-s-${action}`, student, action).legacy.decision, 'DENY');
    assert.equal(assertAuth(`mfa-anon-${action}`, ANON, action).legacy.decision, 'DENY');
  }
});

// ── Admin ops ────────────────────────────────────────────────────────────────

test('Wave6.19 AUTH: admin generate-otp/reset-password/profile — role admin|staff; body.userId is target param', () => {
  const staff = sub({ role: 'staff', permissions: [] });
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null, permissions: Object.values(PERMISSIONS) });
  const student = sub({ id: 's1', role: 'student' });
  for (const action of ['admin_generate_otp', 'admin_reset_password', 'admin_profile']) {
    assert.equal(assertAuth(`adm+${action}`, staff, action, SPOOF).legacy.decision, 'ALLOW');
    assert.equal(assertAuth(`adm-t-${action}`, teacher, action, SPOOF).legacy.decision, 'DENY');
    assert.equal(assertAuth(`adm-s-${action}`, student, action, SPOOF).legacy.decision, 'DENY');
  }
});

test('Wave6.19 AUTH: spoof cannot widen teacher to MFA/admin; branch/tenant ignored', () => {
  const teacher = sub({ id: 't1', role: 'teacher', adminRole: null, userBranchId: BRANCH_A });
  assert.equal(assertAuth('spoof-mfa', teacher, 'mfa_setup', SPOOF).legacy.decision, 'DENY');
  assert.equal(assertAuth('spoof-adm', teacher, 'admin_reset_password', SPOOF).legacy.decision, 'DENY');
  const staffB = sub({ role: 'staff', userBranchId: BRANCH_B });
  assert.equal(assertAuth('branch-b', staffB, 'admin_profile', SPOOF).legacy.branch, 'ignored');
});

test('Wave6.19 AUTH: no invented MANAGE_AUTH permissions in constants', () => {
  const vals = Object.values(PERMISSIONS);
  assert.ok(!vals.includes('manage_auth'));
  assert.ok(!vals.includes('view_auth'));
  assert.ok(!vals.includes('manage_sessions'));
  assert.equal(ACTIONS.size, PUBLIC_ACTIONS.size + 3 + 4 + 3); // public + auth-only + mfa + admin
});

test('Wave6.19 fail-closed: Auth Policy throw → ERROR; next(); no 401/403', async () => {
  const policyPath = require.resolve('../../services/policyShadow/authPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowAuth');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/authPolicy');
  policyMod.evaluatePolicyAuth = () => { throw new Error('forced auth policy failure'); };
  try {
    const { policyShadowAuth } = require('../../middleware/policyShadowAuth');
    const mw = policyShadowAuth('login');
    let nextCount = 0;
    const req = {
      user: {},
      body: { role: 'admin', permissions: ['manage_auth'] },
      method: 'POST',
      originalUrl: '/api/auth/login',
      requestId: 'req-w619',
      correlationId: 'corr-w619',
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    require('../../services/policyShadow/authPolicy');
    require('../../middleware/policyShadowAuth');
  }
});

// ── Static + coverage freeze ─────────────────────────────────────────────────

test('Wave6.19 static: Legacy auth primary; shadow-only; limiters preserved; CQRS OFF', () => {
  const auth = fs.readFileSync(path.join(ROOT, 'routes/authRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const policy = fs.readFileSync(path.join(ROOT, 'services/policyShadow/authPolicy.js'), 'utf8');
  const mw = fs.readFileSync(path.join(ROOT, 'middleware/policyShadowAuth.js'), 'utf8');

  for (const a of [
    'csrf_token', 'captcha', 'refresh', 'check_role', 'google', 'google_callback',
    'zalo', 'zalo_callback', 'login', 'login_public', 'login_internal', 'mfa_verify',
    'mfa_setup', 'mfa_enable', 'mfa_disable', 'mfa_status', 'logout', 'register_teacher',
    'change_password', 'me', 'avatar', 'forgot_password_request', 'forgot_password_verify',
    'admin_generate_otp', 'reset_password_request', 'admin_reset_password', 'admin_profile',
  ]) {
    assert.ok(auth.includes(`policyShadowAuth('${a}')`), `missing shadow ${a}`);
  }

  assert.ok(auth.includes('loginLimiter'));
  assert.ok(auth.includes('captchaLimiter'));
  assert.ok(auth.includes('refreshTokenLimiter'));
  assert.ok(auth.includes('sensitiveFlowLimiter'));
  assert.ok(auth.includes('authMiddleware'));
  assert.ok(auth.includes('generateTokens'));
  assert.ok(auth.includes('verifyTotp'));
  assert.ok(auth.includes('verifyCaptcha'));
  assert.ok(auth.includes('passport.authenticate'));

  // Shadow must not perform auth side effects
  assert.ok(!/generateTokens|jwt\.sign|bcrypt|verifyTotp|verifyCaptcha|blacklist\.add|enqueueOtp|enqueuePassword/.test(policy));
  assert.ok(!/generateTokens|jwt\.sign|bcrypt|verifyTotp|verifyCaptcha|blacklist\.add|enqueueOtp|enqueuePassword/.test(mw));
  assert.ok(mw.includes('return next()'));
  assert.ok(!/res\.status\(401\)/.test(mw));
  assert.ok(!/res\.status\(403\)/.test(mw));
  assert.ok(!/\.emit\(/.test(policy + mw));

  assert.ok(server.includes("app.use('/api/auth'"));
  assert.ok(!server.includes("require('./modules/auth"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
});

test('Wave6.19 coverage freeze: every LIVE /api mount in server.js has Policy shadow (except none remaining)', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const mounts = [...server.matchAll(/app\.use\(\s*['"](\/api\/[^'"]+)['"]\s*,\s*(\w+)/g)]
    .map((m) => ({ path: m[1], varName: m[2] }));

  const expected = {
    '/api/auth': 'authRoutes',
    '/api/students': 'studentRoutes',
    '/api/invoices': 'invoiceRoutes',
    '/api/messages': 'messageRoutes',
    '/api/schedules': 'scheduleRoutes',
    '/api/courses': 'courseRoutes',
    '/api/teachers': 'teacherRoutes',
    '/api/assignments': 'assignmentRoutes',
    '/api/quizzes': 'quizRoutes',
    '/api/evaluations': 'evaluationRoutes',
    '/api/exam-results': 'examResultRoutes',
    '/api/system-logs': 'systemLogRoutes',
    '/api/training': 'teachingGuideRoutes',
    '/api/training-lms': 'trainingRoutes',
    '/api/transactions': 'transactionRoutes',
    '/api/settings': 'settingsRoutes',
    '/api/webhooks': 'webhookRoutes',
    '/api/staff': 'staffRoutes',
    '/api/branches': 'branchRoutes',
    '/api/analytics': 'analyticsRoutes',
    '/api/employees': 'employeeRoutes',
    '/api/notifications': 'notificationRoutes',
    '/api/files': 'fileRoutes',
    '/api/backups': 'backupRoutes',
    '/api/monitoring': 'monitoringRoutes',
    '/api/proctor': 'proctorRoutes',
    '/api/ai': 'aiRoutes',
    '/api/bi': 'biRoutes',
    '/api/finance': 'financeRoutes',
    '/api/workflows': 'workflowRoutes',
    '/api/builder': 'builderRoutes',
    '/api/tenants': 'tenantRoutes',
    '/api/feed': 'feedRoutes',
    '/api/blog': 'blogRoutes',
  };

  for (const [p, v] of Object.entries(expected)) {
    const hit = mounts.find((m) => m.path === p);
    assert.ok(hit, `missing mount ${p}`);
    assert.equal(hit.varName, v);
  }

  // Every routes/*.js used above must reference policyShadow (auth now included)
  const routeFiles = {
    authRoutes: 'routes/authRoutes.js',
    studentRoutes: 'routes/studentRoutes.js',
    invoiceRoutes: 'routes/invoiceRoutes.js',
    messageRoutes: 'routes/messageRoutes.js',
    scheduleRoutes: 'routes/scheduleRoutes.js',
    courseRoutes: 'routes/courseRoutes.js',
    teacherRoutes: 'routes/teacherRoutes.js',
    assignmentRoutes: 'routes/assignmentRoutes.js',
    quizRoutes: 'routes/quizRoutes.js',
    evaluationRoutes: 'routes/evaluationRoutes.js',
    examResultRoutes: 'routes/examResultRoutes.js',
    systemLogRoutes: 'routes/systemLogRoutes.js',
    teachingGuideRoutes: 'routes/teachingGuideRoutes.js',
    trainingRoutes: 'routes/trainingRoutes.js',
    transactionRoutes: 'routes/transactionRoutes.js',
    settingsRoutes: 'routes/settingsRoutes.js',
    webhookRoutes: 'routes/webhookRoutes.js',
    staffRoutes: 'routes/staffRoutes.js',
    branchRoutes: 'routes/branchRoutes.js',
    analyticsRoutes: 'routes/analyticsRoutes.js',
    employeeRoutes: 'routes/employeeRoutes.js',
    notificationRoutes: 'routes/notificationRoutes.js',
    fileRoutes: 'routes/fileRoutes.js',
    backupRoutes: 'routes/backupRoutes.js',
    monitoringRoutes: 'routes/monitoringRoutes.js',
    proctorRoutes: 'routes/proctorRoutes.js',
    aiRoutes: 'routes/aiRoutes.js',
    biRoutes: 'routes/biRoutes.js',
    financeRoutes: 'routes/financeRoutes.js',
    workflowRoutes: 'routes/workflowRoutes.js',
    builderRoutes: 'routes/builderRoutes.js',
    tenantRoutes: 'routes/tenantRoutes.js',
    feedRoutes: 'routes/feedRoutes.js',
    blogRoutes: 'routes/blogRoutes.js',
  };

  for (const [varName, rel] of Object.entries(routeFiles)) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(/policyShadow/.test(src), `${varName} (${rel}) missing policyShadow`);
  }

  assert.ok(fs.existsSync(path.join(ROOT, 'modules/auth/authRoutes.js')));
  assert.ok(!server.includes("require('./modules/"));
});
