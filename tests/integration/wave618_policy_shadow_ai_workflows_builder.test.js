/**
 * Wave 6.18 — Policy SHADOW for LIVE /api/ai + /api/workflows + /api/builder.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject: buildAiSubject,
  evaluateLegacyAi,
  evaluatePolicyAi,
  compareDecisions: compareAi,
} = require('../../services/policyShadow/aiPolicy');
const {
  buildSubject: buildWfSubject,
  evaluateLegacyWorkflow,
  evaluatePolicyWorkflow,
  compareDecisions: compareWf,
} = require('../../services/policyShadow/workflowPolicy');
const {
  buildSubject: buildBuilderSubject,
  evaluateLegacyBuilder,
  evaluatePolicyBuilder,
  compareDecisions: compareBuilder,
} = require('../../services/policyShadow/builderPolicy');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const ACTOR = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';
const ROOT = path.join(__dirname, '../..');

function aiSub(opts = {}) {
  const role = opts.role ?? 'staff';
  return buildAiSubject({
    user: { id: opts.id ?? ACTOR, role },
    actorDoc: role === 'student'
      ? null
      : {
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
          role,
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function wfSub(opts = {}) {
  const role = opts.role ?? 'staff';
  return buildWfSubject({
    user: { id: opts.id ?? ACTOR, role },
    actorDoc: role === 'student'
      ? null
      : {
          adminRole: opts.adminRole !== undefined ? opts.adminRole : 'STAFF',
          permissions: opts.permissions ?? [],
          role,
        },
    userBranchId: opts.userBranchId === undefined ? BRANCH_A : opts.userBranchId,
  });
}

function bSub(opts = {}) {
  const role = opts.role ?? 'staff';
  const defaultAdmin = role === 'teacher' || role === 'student' ? null : 'STAFF';
  return buildBuilderSubject({
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

function assertAi(label, subject, action, untrusted = {}) {
  const legacy = evaluateLegacyAi(subject, action);
  const policy = evaluatePolicyAi(subject, action, {}, untrusted);
  const result = compareAi(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

function assertWf(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyWorkflow(subject, action, ctx);
  const policy = evaluatePolicyWorkflow(subject, action, ctx, untrusted);
  const result = compareWf(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

function assertB(label, subject, action, ctx = {}, untrusted = {}) {
  const legacy = evaluateLegacyBuilder(subject, action, ctx);
  const policy = evaluatePolicyBuilder(subject, action, ctx, untrusted);
  const result = compareBuilder(legacy, policy);
  assert.equal(result, 'MATCH', `${label}: ${result} L=${legacy.decision}/${legacy.reason} P=${policy.decision}/${policy.reason}`);
  return { legacy, policy };
}

const SPOOF = {
  bodyRole: 'admin',
  clientAdminRole: 'SUPER_ADMIN',
  clientPermissions: [PERMISSIONS.MANAGE_FINANCE, 'manage_ai', 'manage_workflows', 'manage_builder'],
  bodyUserId: 'admin',
  bodyOwnerId: ACTOR,
  bodyCreatedBy: ACTOR,
  bodySubmittedBy: ACTOR,
  bodyBranchId: BRANCH_B,
  bodyTenantId: 'tenant-spoof',
};

// ── AI ───────────────────────────────────────────────────────────────────────

test('Wave6.18 AI: isAdmin gate; teacher/student DENY; no invented MANAGE_AI', () => {
  const staff = aiSub({ role: 'staff', permissions: [] });
  const admin = aiSub({ role: 'admin', permissions: [] });
  const teacher = aiSub({ id: 't1', role: 'teacher', adminRole: null, permissions: ['manage_ai'] });
  const student = aiSub({ id: 's1', role: 'student' });
  for (const action of ['status', 'quiz', 'notification_draft', 'summarize', 'complete']) {
    assert.equal(assertAi(`ai-staff-${action}`, staff, action).legacy.decision, 'ALLOW');
    assert.equal(assertAi(`ai-admin-${action}`, admin, action).legacy.decision, 'ALLOW');
    assert.equal(assertAi(`ai-t-${action}`, teacher, action).legacy.decision, 'DENY');
    assert.equal(assertAi(`ai-s-${action}`, student, action).legacy.decision, 'DENY');
  }
  assert.ok(!Object.values(PERMISSIONS).includes('manage_ai'));
});

test('Wave6.18 AI: spoof role/perm/branch ignored; branch ignored', () => {
  const teacher = aiSub({ id: 't1', role: 'teacher', adminRole: null, userBranchId: BRANCH_A });
  const staffB = aiSub({ role: 'staff', userBranchId: BRANCH_B });
  assert.equal(assertAi('spoof-t', teacher, 'quiz', SPOOF).legacy.decision, 'DENY');
  assert.equal(assertAi('branch-b', staffB, 'complete', SPOOF).legacy.decision, 'ALLOW');
  assert.equal(assertAi('branch-b', staffB, 'complete', SPOOF).legacy.branch, 'ignored');
});

test('Wave6.18 fail-closed: AI Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/aiPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowAi');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/aiPolicy');
  policyMod.evaluatePolicyAi = () => { throw new Error('forced ai policy failure'); };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({ select() { return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) }; } });
  try {
    const { policyShadowAi } = require('../../middleware/policyShadowAi');
    const mw = policyShadowAi('status');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR, role: 'staff' },
      body: {},
      method: 'GET',
      originalUrl: '/api/ai/status',
      requestId: 'req-w618-ai',
      correlationId: 'corr-w618-ai',
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
    require('../../services/policyShadow/aiPolicy');
    require('../../middleware/policyShadowAi');
  }
});

// ── Workflows ────────────────────────────────────────────────────────────────

test('Wave6.18 WF: isAdmin for list/create/advance; no ownership; missing → ALLOW', () => {
  const staff = wfSub();
  const teacher = wfSub({ id: 't1', role: 'teacher', adminRole: null });
  for (const action of ['definitions', 'list', 'sync', 'create']) {
    assert.equal(assertWf(`wf+${action}`, staff, action).legacy.decision, 'ALLOW');
    assert.equal(assertWf(`wf-${action}`, teacher, action).legacy.decision, 'DENY');
  }
  assert.equal(
    assertWf('get-miss', staff, 'get', { instance: null }).legacy.reason,
    'missing_instance_handler_404',
  );
  assert.equal(
    assertWf('adv+', staff, 'advance', { instance: { _id: OTHER, createdBy: OTHER } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertWf('adv+', staff, 'advance', { instance: { _id: OTHER, createdBy: OTHER } }).legacy.ownership, 'none_any_admin');
});

test('Wave6.18 WF: spoof createdBy/owner/branch cannot widen teacher', () => {
  const teacher = wfSub({ id: 't1', role: 'teacher', adminRole: null });
  assert.equal(
    assertWf('spoof', teacher, 'advance', { instance: { createdBy: 't1' } }, SPOOF).legacy.decision,
    'DENY',
  );
});

test('Wave6.18 fail-closed: Workflow Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/workflowPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowWorkflow');
  const teacherPath = require.resolve('../../models/Teacher');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/workflowPolicy');
  policyMod.evaluatePolicyWorkflow = () => { throw new Error('forced workflow policy failure'); };
  const Teacher = require('../../models/Teacher');
  const orig = Teacher.findById;
  Teacher.findById = () => ({ select() { return { lean: async () => ({ adminRole: 'STAFF', permissions: [], role: 'staff' }) }; } });
  try {
    const { policyShadowWorkflow } = require('../../middleware/policyShadowWorkflow');
    const mw = policyShadowWorkflow('list');
    let nextCount = 0;
    const req = {
      user: { id: ACTOR, role: 'staff' },
      params: {},
      body: {},
      method: 'GET',
      originalUrl: '/api/workflows',
      requestId: 'req-w618-wf',
      correlationId: 'corr-w618-wf',
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
    require('../../services/policyShadow/workflowPolicy');
    require('../../middleware/policyShadowWorkflow');
  }
});

// ── Builder ──────────────────────────────────────────────────────────────────

test('Wave6.18 BUILDER: admin CRUD isAdmin; public submit; submit-auth auth-only', () => {
  const staff = bSub();
  const teacher = bSub({ id: 't1', role: 'teacher', adminRole: null });
  const anon = buildBuilderSubject({ user: {}, actorDoc: null, userBranchId: null });
  assert.equal(assertB('list+', staff, 'form_list').legacy.decision, 'ALLOW');
  assert.equal(assertB('list-', teacher, 'form_list').legacy.decision, 'DENY');
  assert.equal(assertB('rep+', staff, 'report_run').legacy.decision, 'ALLOW');
  assert.equal(assertB('rep-', teacher, 'report_create').legacy.decision, 'DENY');
  assert.equal(assertB('sub-pub', anon, 'form_submit').legacy.decision, 'ALLOW');
  assert.equal(assertB('sub-auth+', teacher, 'form_submit_auth').legacy.decision, 'ALLOW');
  assert.equal(assertB('sub-auth-', anon, 'form_submit_auth').legacy.decision, 'DENY');
});

test('Wave6.18 BUILDER: form_get published public; draft admin ALLOW / other DENY-404; missing ALLOW', () => {
  const anon = buildBuilderSubject({ user: {}, actorDoc: null, userBranchId: null });
  const teacher = bSub({ id: 't1', role: 'teacher', adminRole: null });
  const staff = bSub();
  const hardAdmin = buildBuilderSubject({
    user: { id: 'admin', role: 'admin' },
    actorDoc: null,
    userBranchId: null,
  });
  assert.equal(
    assertB('pub', anon, 'form_get', { form: { status: 'published' } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertB('draft-anon', anon, 'form_get', { form: { status: 'draft' } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertB('draft-anon', anon, 'form_get', { form: { status: 'draft' } }).legacy.statusHint,
    404,
  );
  assert.equal(
    assertB('draft-t', teacher, 'form_get', { form: { status: 'draft', createdBy: 't1' } }).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertB('draft-staff', staff, 'form_get', { form: { status: 'draft', createdBy: OTHER } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(
    assertB('draft-hard', hardAdmin, 'form_get', { form: { status: 'archived' } }).legacy.decision,
    'ALLOW',
  );
  assert.equal(assertB('miss', anon, 'form_get', { form: null }).legacy.decision, 'ALLOW');
});

test('Wave6.18 BUILDER: spoof cannot widen; no ownership on update; no MANAGE_BUILDER', () => {
  const teacher = bSub({ id: 't1', role: 'teacher', adminRole: null });
  assert.equal(
    assertB('spoof-upd', teacher, 'form_update', { formMissing: false }, SPOOF).legacy.decision,
    'DENY',
  );
  assert.equal(
    assertB('spoof-get', teacher, 'form_get', { form: { status: 'draft', createdBy: 't1' } }, SPOOF).legacy.decision,
    'DENY',
  );
  assert.ok(!Object.values(PERMISSIONS).includes('manage_builder'));
  assert.ok(!Object.values(PERMISSIONS).includes('manage_workflows'));
});

test('Wave6.18 fail-closed: Builder Policy throw → ERROR; next()', async () => {
  const policyPath = require.resolve('../../services/policyShadow/builderPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowBuilder');
  delete require.cache[policyPath];
  delete require.cache[mwPath];
  const policyMod = require('../../services/policyShadow/builderPolicy');
  policyMod.evaluatePolicyBuilder = () => { throw new Error('forced builder policy failure'); };
  try {
    const { policyShadowBuilder } = require('../../middleware/policyShadowBuilder');
    const mw = policyShadowBuilder('form_submit');
    let nextCount = 0;
    const req = {
      user: {},
      params: { idOrSlug: 'x' },
      body: {},
      method: 'POST',
      originalUrl: '/api/builder/forms/x/submit',
      requestId: 'req-w618-b',
      correlationId: 'corr-w618-b',
      header() { return undefined; },
      headers: {},
    };
    const res = { statusCode: null, status(c) { this.statusCode = c; return this; }, json() { return this; } };
    await mw(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    require('../../services/policyShadow/builderPolicy');
    require('../../middleware/policyShadowBuilder');
  }
});

// ── Static ───────────────────────────────────────────────────────────────────

test('Wave6.18 static: Legacy isAdmin primary; shadow-only; CQRS OFF; modules unmounted', () => {
  const ai = fs.readFileSync(path.join(ROOT, 'routes/aiRoutes.js'), 'utf8');
  const wf = fs.readFileSync(path.join(ROOT, 'routes/workflowRoutes.js'), 'utf8');
  const builder = fs.readFileSync(path.join(ROOT, 'routes/builderRoutes.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const wfSvc = fs.readFileSync(path.join(ROOT, 'services/workflowService.js'), 'utf8');

  assert.ok(ai.includes('policyShadowAi'));
  assert.ok(ai.includes('aiCutoverGate'));
  assert.ok(ai.includes("guard('status')"));
  assert.ok(ai.includes("guard('quiz')"));
  assert.ok(ai.includes('isAdmin')); // Legacy path retained via cutover gate docs
  assert.ok(ai.includes('sensitiveFlowLimiter'));
  assert.ok(!ai.includes('MANAGE_AI'));
  assert.ok(!ai.includes('checkPermission'));
  const aiGate = fs.readFileSync(path.join(ROOT, 'middleware/aiCutoverGate.js'), 'utf8');
  assert.ok(aiGate.includes('isAdmin'));
  assert.ok(aiGate.includes("getAuthorizationAuthority('ai')"));

  assert.ok(wf.includes('policyShadowWorkflow'));
  assert.ok(wf.includes('workflowsCutoverGate'));
  assert.ok(wf.includes("guard('list')"));
  assert.ok(wf.includes("guard('advance')"));
  assert.ok(wf.includes('isAdmin')); // Legacy path retained via cutover gate docs
  assert.ok(wf.includes('workflowService.advance'));
  const wfGate = fs.readFileSync(path.join(ROOT, 'middleware/workflowsCutoverGate.js'), 'utf8');
  assert.ok(wfGate.includes('isAdmin'));
  assert.ok(wfGate.includes("getAuthorizationAuthority('workflows')"));
  assert.ok(!wfGate.includes('emitTeacherEvent'));
  assert.ok(!wfGate.includes('emitDataRefresh'));
  assert.ok(!wfGate.includes('workflowService.advance'));
  assert.ok(wfSvc.includes('emitTeacherEvent') || wfSvc.includes('emitDataRefresh'));

  assert.ok(builder.includes('policyShadowBuilder'));
  assert.ok(builder.includes("adminGuard('form_list')"));
  assert.ok(builder.includes('builderCutoverGate'));
  assert.ok(builder.includes("policyShadowBuilder('form_get')"));
  assert.ok(builder.includes("policyShadowBuilder('form_submit')"));
  assert.ok(builder.includes("adminGuard('report_run')"));
  assert.ok(builder.includes('isAdmin')); // Legacy path retained via cutover gate docs
  assert.ok(builder.includes('{ ...req.body, createdBy:'));
  const builderGate = fs.readFileSync(path.join(ROOT, 'middleware/builderCutoverGate.js'), 'utf8');
  assert.ok(builderGate.includes('isAdmin'));
  assert.ok(builderGate.includes("getAuthorizationAuthority('builder')"));
  assert.ok(builderGate.includes('404')); // draft hide statusHint
  assert.ok(!builderGate.includes('submitForm'));
  assert.ok(!builderGate.includes('createForm'));
  assert.ok(!builderGate.includes('runReport'));

  assert.ok(server.includes("app.use('/api/ai'"));
  assert.ok(server.includes("app.use('/api/workflows'"));
  assert.ok(server.includes("app.use('/api/builder'"));
  assert.ok(!server.includes("require('./modules/ai"));
  assert.ok(!server.includes("require('./modules/cms"));
  assert.ok(!/app\.use\(\s*['"]\/api\/.*policy/i.test(server));

  assert.ok(/ENABLE_CQRS_TEACHER\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_STUDENT_CREATE\s*=\s*false/.test(env));
  assert.ok(/ENABLE_CQRS_INVOICE\s*=\s*false/.test(env));
});

test('Wave6.18 static: shadow always next(); no AI/workflow/builder execution in Policy', () => {
  for (const rel of [
    'middleware/policyShadowAi.js',
    'middleware/policyShadowWorkflow.js',
    'middleware/policyShadowBuilder.js',
    'services/policyShadow/aiPolicy.js',
    'services/policyShadow/workflowPolicy.js',
    'services/policyShadow/builderPolicy.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (rel.startsWith('middleware/')) {
      assert.ok(src.includes('return next()'));
      assert.ok(!/res\.status\(403\)/.test(src));
      assert.ok(!/res\.status\(401\)/.test(src));
    }
    assert.ok(!/aiService\./.test(src));
    assert.ok(!/workflowService\.(advance|start|sync)/.test(src));
    assert.ok(!/formService\.(create|update|submit|delete)/.test(src));
    assert.ok(!/reportService\.(create|run|update|delete)/.test(src));
    assert.ok(!/\.emit\(/.test(src));
    assert.ok(!/BullMQ|bullmq/.test(src));
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/ai/routes/aiRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/cms/routes/workflowRoutes.js')));
  assert.ok(fs.existsSync(path.join(ROOT, 'modules/cms/routes/builderRoutes.js')));
});
