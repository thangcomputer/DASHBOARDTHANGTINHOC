/**
 * Wave 6.12 — Policy SHADOW for LIVE /api/analytics + /api/bi.
 * HTTP authz = MANAGE_FINANCE OR VIEW_BRANCH_REVENUE.
 * Branch/tenant = DATA FILTER (not HTTP DENY), except analytics/branches ignores filter (P2).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildAnalyticsSubject,
  evaluateLegacyAnalytics,
  evaluatePolicyAnalytics,
  compareDecisions: compareAnalytics,
  DATA_FILTER_ACTIONS,
  HANDLER_IGNORES_BRANCH_FILTER,
} = require('../../services/policyShadow/analyticsPolicy');
const {
  buildSubject: buildBISubject,
  evaluateLegacyBI,
  evaluatePolicyBI,
  compareDecisions: compareBI,
} = require('../../services/policyShadow/biPolicy');
const {
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  toPolicyPermission,
} = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const ACTOR_ID = '507f1f77bcf86cd799439011';
const ROOT = path.join(__dirname, '../..');

function analyticsSubject(opts = {}) {
  return buildAnalyticsSubject({
    user: {
      id: opts.id ?? ACTOR_ID,
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function biSubject(opts = {}) {
  return buildBISubject({
    user: {
      id: opts.id ?? ACTOR_ID,
      role: opts.role ?? 'staff',
    },
    actorDoc: {
      adminRole: opts.adminRole ?? 'STAFF',
      permissions: opts.permissions ?? [],
      role: opts.role ?? 'staff',
    },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function assertAnalyticsMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyAnalytics(subject, action, ctx);
  const policy = evaluatePolicyAnalytics(subject, action, ctx, untrusted);
  const result = compareAnalytics(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

function assertBIMatch(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyBI(subject, action, ctx);
  const policy = evaluatePolicyBI(subject, action, ctx, untrusted);
  const result = compareBI(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`,
  );
  return { legacy, policy };
}

// ── Permission ───────────────────────────────────────────────────────────────

test('Wave6.12 ANALYTICS: MANAGE_FINANCE OR VIEW_BRANCH_REVENUE ALLOW; missing/VIEW_TEACHERS DENY', () => {
  const finance = analyticsSubject({ permissions: [PERMISSIONS.MANAGE_FINANCE] });
  const viewRev = analyticsSubject({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const none = analyticsSubject({ permissions: [] });
  const viewOnly = analyticsSubject({ permissions: [PERMISSIONS.VIEW_TEACHERS] });
  for (const a of ['revenue', 'enrollment', 'branches']) {
    assert.equal(assertAnalyticsMatch(`fin-${a}`, finance, a).legacy.decision, 'ALLOW');
    assert.equal(assertAnalyticsMatch(`vr-${a}`, viewRev, a).legacy.decision, 'ALLOW');
    assert.equal(assertAnalyticsMatch(`none-${a}`, none, a).legacy.decision, 'DENY');
    assert.equal(assertAnalyticsMatch(`view-${a}`, viewOnly, a).legacy.decision, 'DENY');
  }
});

test('Wave6.12 BI: same OR permission gate for overview/export', () => {
  const finance = biSubject({ permissions: [PERMISSIONS.MANAGE_FINANCE] });
  const viewRev = biSubject({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  const none = biSubject({ permissions: [] });
  for (const a of ['overview', 'export']) {
    assert.equal(assertBIMatch(`fin-${a}`, finance, a).legacy.decision, 'ALLOW');
    assert.equal(assertBIMatch(`vr-${a}`, viewRev, a).legacy.decision, 'ALLOW');
    assert.equal(assertBIMatch(`none-${a}`, none, a).legacy.decision, 'DENY');
  }
});

test('Wave6.12: teacher/student DENY even with finance perm; SUPER/hardcoded ALLOW', () => {
  const teacher = analyticsSubject({
    id: 't1',
    role: 'teacher',
    adminRole: null,
    permissions: [PERMISSIONS.MANAGE_FINANCE],
  });
  const student = biSubject({
    id: 's1',
    role: 'student',
    adminRole: null,
    permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
  });
  const root = analyticsSubject({
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  const superDb = biSubject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(assertAnalyticsMatch('teach', teacher, 'revenue').legacy.decision, 'DENY');
  assert.equal(assertBIMatch('stud', student, 'overview').legacy.decision, 'DENY');
  assert.equal(assertAnalyticsMatch('root', root, 'revenue').legacy.decision, 'ALLOW');
  assert.equal(assertBIMatch('super', superDb, 'export').legacy.decision, 'ALLOW');
});

test('Wave6.12: HIGH_ADMIN / SUPPORT need explicit finance|view_revenue (no bypass)', () => {
  const highNo = analyticsSubject({ adminRole: 'HIGH_ADMIN', permissions: [], userBranchId: null });
  const highOk = analyticsSubject({
    adminRole: 'HIGH_ADMIN',
    permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
    userBranchId: null,
  });
  const supportNo = biSubject({ adminRole: 'SUPPORT', permissions: [], userBranchId: BRANCH_A });
  const supportOk = biSubject({
    adminRole: 'SUPPORT',
    permissions: [PERMISSIONS.MANAGE_FINANCE],
    userBranchId: BRANCH_A,
  });
  assert.equal(assertAnalyticsMatch('high-', highNo, 'enrollment').legacy.decision, 'DENY');
  assert.equal(assertAnalyticsMatch('high+', highOk, 'enrollment').legacy.decision, 'ALLOW');
  assert.equal(assertBIMatch('sup-', supportNo, 'overview').legacy.decision, 'DENY');
  assert.equal(assertBIMatch('sup+', supportOk, 'overview').legacy.decision, 'ALLOW');
});

// ── Branch / data scope (HTTP ALLOW — not convert to 403) ────────────────────

test('Wave6.12: Branch A actor ALLOW HTTP for revenue/BI (data filter, not DENY)', () => {
  const staffA = analyticsSubject({
    permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
    userBranchId: BRANCH_A,
  });
  const ctxA = { trustedBranchFilter: { branchId: BRANCH_A }, queryBranch: BRANCH_B };
  const ctxSpoof = { trustedBranchFilter: { branchId: BRANCH_A }, queryBranch: 'all' };
  // Spoofed query branch cannot widen when trusted filter already has branchId
  assert.equal(
    assertAnalyticsMatch('a-rev', staffA, 'revenue', ctxA, {
      queryBranchId: BRANCH_B,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertAnalyticsMatch('a-enr', staffA, 'enrollment', ctxSpoof).legacy.decision, 'ALLOW');
  assert.equal(
    assertBIMatch('a-bi', biSubject({
      permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
      userBranchId: BRANCH_A,
    }), 'overview', ctxA, { queryBranchId: BRANCH_B }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    DATA_FILTER_ACTIONS.has('revenue') && DATA_FILTER_ACTIONS.has('enrollment'),
    true,
  );
});

test('Wave6.12: SUPER unbound ALLOW A/B; null branch ALLOW (data scope empty)', () => {
  const superU = analyticsSubject({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    userBranchId: null,
  });
  assert.equal(
    assertAnalyticsMatch('s-a', superU, 'revenue', {
      trustedBranchFilter: {},
      queryBranch: BRANCH_A,
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertAnalyticsMatch('s-b', superU, 'revenue', {
      trustedBranchFilter: { branchId: BRANCH_B },
    }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertAnalyticsMatch('s-null', superU, 'revenue', {
      trustedBranchFilter: {},
      queryBranch: null,
    }).legacy.decision,
    'ALLOW',
  );
});

test('Wave6.12: analytics/branches ALLOW with perm but dataScope=none (handler ignores filter)', () => {
  const staffA = analyticsSubject({
    permissions: [PERMISSIONS.MANAGE_FINANCE],
    userBranchId: BRANCH_A,
  });
  const r = assertAnalyticsMatch('br-weak', staffA, 'branches', {
    trustedBranchFilter: { branchId: BRANCH_A },
  });
  assert.equal(r.legacy.decision, 'ALLOW');
  assert.equal(r.legacy.dataScope, 'none');
  assert.equal(HANDLER_IGNORES_BRANCH_FILTER.has('branches'), true);
});

// ── Spoof / tenant ───────────────────────────────────────────────────────────

test('Wave6.12: spoof role/adminRole/permissions/branch/tenant cannot widen actor', () => {
  const none = analyticsSubject({ permissions: [], userBranchId: BRANCH_A });
  assert.equal(
    assertAnalyticsMatch('spoof-a', none, 'revenue', {}, {
      clientRole: 'admin',
      clientAdminRole: 'SUPER_ADMIN',
      clientPermissions: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE],
      queryBranchId: BRANCH_B,
      bodyBranchId: BRANCH_B,
      queryTenantId: 'evil',
      bodyTenantId: 'evil',
    }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertBIMatch('spoof-b', biSubject({ permissions: [] }), 'export', {}, {
      clientRole: 'admin',
      clientPermissions: [PERMISSIONS.MANAGE_FINANCE],
      queryBranchId: 'all',
      headerTenantId: 't1',
    }).legacy.decision,
    'DENY',
  );
});

test('Wave6.12: tenant spoof does not change HTTP decision for permitted actor', () => {
  const ok = analyticsSubject({ permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE] });
  assert.equal(
    assertAnalyticsMatch('ten', ok, 'revenue', {
      trustedBranchFilter: { branchId: BRANCH_A },
    }, {
      queryTenantId: 'other',
      headerTenantId: 'spoof',
    }).legacy.decision,
    'ALLOW',
  );
});

// ── Fail-closed ──────────────────────────────────────────────────────────────

test('Wave6.12 fail-closed: analytics Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/analyticsPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowAnalytics');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/analyticsPolicy');
  policyMod.evaluatePolicyAnalytics = () => {
    throw new Error('forced analytics policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.VIEW_BRANCH_REVENUE],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const { policyShadowAnalytics } = require('../../middleware/policyShadowAnalytics');
    const mw = policyShadowAnalytics('revenue');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR_ID, role: 'staff' },
      userBranchId: BRANCH_A,
      branchFilter: { branchId: BRANCH_A },
      params: {},
      body: {},
      query: { period: '1m', branchId: BRANCH_B },
      method: 'GET',
      originalUrl: '/api/analytics/revenue',
      requestId: 'req-wave612',
      correlationId: 'corr-wave612',
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
    require('../../services/policyShadow/analyticsPolicy');
    require('../../middleware/policyShadowAnalytics');
  }
});

test('Wave6.12 fail-closed: BI Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/biPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowBI');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];
  const policyMod = require('../../services/policyShadow/biPolicy');
  policyMod.evaluatePolicyBI = () => {
    throw new Error('forced bi policy failure');
  };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_FINANCE],
          role: 'staff',
        }),
      };
    },
  });
  try {
    const { policyShadowBI } = require('../../middleware/policyShadowBI');
    const mw = policyShadowBI('overview');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR_ID, role: 'staff' },
      userBranchId: BRANCH_A,
      branchFilter: { branchId: BRANCH_A },
      params: {},
      body: {},
      query: {},
      method: 'GET',
      originalUrl: '/api/bi/overview',
      requestId: 'req-wave612-bi',
      correlationId: 'corr-wave612-bi',
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
    require('../../services/policyShadow/biPolicy');
    require('../../middleware/policyShadowBI');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.12 static: legacy middleware remains; Policy shadow-only; CQRS OFF; no money edits', () => {
  const analytics = fs.readFileSync(path.join(ROOT, 'routes/analyticsRoutes.js'), 'utf8');
  const bi = fs.readFileSync(path.join(ROOT, 'routes/biRoutes.js'), 'utf8');
  const biService = fs.readFileSync(path.join(ROOT, 'services/biService.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');

  assert.ok(analytics.includes("guard('revenue')") || analytics.includes("policyShadowAnalytics('revenue')"));
  assert.ok(analytics.includes("guard('enrollment')"));
  assert.ok(analytics.includes("guard('branches')"));
  assert.ok(analytics.includes('branchFilter'));
  assert.ok(analytics.includes('policyShadowAnalytics'));
  assert.ok(analytics.includes('analyticsCutoverGate'));
  assert.ok(analytics.includes('sumFinancialRevenue'));
  assert.ok(analytics.includes('buildBaseFilter'));
  const analyticsGate = fs.readFileSync(path.join(ROOT, 'middleware/analyticsCutoverGate.js'), 'utf8');
  assert.ok(analyticsGate.includes('checkAnyPermission'));
  assert.ok(analyticsGate.includes('MANAGE_FINANCE'));
  assert.ok(analyticsGate.includes('VIEW_BRANCH_REVENUE'));
  assert.ok(analyticsGate.includes("getAuthorizationAuthority('analytics')"));

  assert.ok(bi.includes("guard('overview')"));
  assert.ok(bi.includes("guard('export')"));
  assert.ok(bi.includes('branchFilter'));
  assert.ok(bi.includes('policyShadowBI'));
  assert.ok(bi.includes('biCutoverGate'));
  assert.ok(bi.includes('biService.getOverview'));
  const biGate = fs.readFileSync(path.join(ROOT, 'middleware/biCutoverGate.js'), 'utf8');
  assert.ok(biGate.includes('checkAnyPermission'));
  assert.ok(biGate.includes('MANAGE_FINANCE'));
  assert.ok(biGate.includes('VIEW_BRANCH_REVENUE'));
  assert.ok(biGate.includes("getAuthorizationAuthority('bi')"));

  // Aggregation/financial writers untouched in biService
  assert.ok(biService.includes('sumFinancialRevenue'));
  assert.ok(!biService.includes('policyShadow'));

  assert.ok(server.includes("app.use('/api/analytics'"));
  assert.ok(server.includes("app.use('/api/bi'"));
  assert.ok(!server.includes("require('./modules/analytics"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));

  assert.equal(toPolicyPermission(PERMISSIONS.MANAGE_FINANCE), FINANCE_WRITE_LIVE);
  assert.equal(toPolicyPermission(PERMISSIONS.VIEW_BRANCH_REVENUE), VIEW_BRANCH_REVENUE_LIVE);

  // Read-only routes — no mass-assignment patterns
  assert.ok(!/\{ \.\.\.req\.body \}/.test(analytics));
  assert.ok(!/\{ \.\.\.req\.body \}/.test(bi));
  assert.ok(!/\bio\.emit\(/.test(analytics));
  assert.ok(!/\bio\.emit\(/.test(bi));
});

test('Wave6.12 static: shadow middleware always next(); no HTTP 403', () => {
  for (const rel of [
    'middleware/policyShadowAnalytics.js',
    'middleware/policyShadowBI.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('return next()'));
    assert.ok(!/res\.status\(403\)/.test(src));
    assert.ok(src.includes('POLICY_MISMATCH') || src.includes('POLICY_SHADOW_ERROR'));
  }
});

test('Wave6.12 inventory: modules/analytics + modules/finance BiController UNMOUNTED', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(!server.includes("modules/analytics"));
  assert.ok(!server.includes('BiController'));
  assert.ok(!server.includes('AnalyticsController'));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/analytics/controllers/AnalyticsController.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/finance/controllers/BiController.js')));
});
