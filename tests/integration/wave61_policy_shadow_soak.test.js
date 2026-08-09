/**
 * Wave 6.1 — Policy shadow soak matrix + CQRS config freeze.
 * READ-ONLY validation. Policy remains shadow-only; CQRS must stay OFF.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS } = require('../../constants/permissions');
const {
  buildSubject,
  evaluateLegacyTeacherWrite,
  evaluatePolicyTeacherWrite,
  compareDecisions,
} = require('../../services/policyShadow/teacherMutationPolicy');
const { TEACHER_WRITE_LIVE } = require('../../services/policyShadow/livePermissionAdapter');

const BRANCH_A = '507f1f77bcf86cd7994390aa';
const BRANCH_B = '507f1f77bcf86cd7994390bb';
const ROOT = path.join(__dirname, '../..');

function assertMatch(label, subject, resource, action = 'score', untrusted = {}) {
  const legacy = evaluateLegacyTeacherWrite(subject, resource);
  const policy = evaluatePolicyTeacherWrite(subject, resource, action, untrusted);
  const result = compareDecisions(legacy, policy);
  assert.equal(
    result,
    'MATCH',
    `${label}: expected MATCH got ${result} (legacy=${legacy.decision}/${legacy.reason} policy=${policy.decision}/${policy.reason})`,
  );
  return { legacy, policy, result };
}

function subjectOf({
  id = '507f1f77bcf86cd799439001',
  role = 'staff',
  adminRole = 'STAFF',
  permissions = [],
  userBranchId = BRANCH_A,
} = {}) {
  return buildSubject({
    user: { id, role },
    actorDoc: { adminRole, permissions, role },
    userBranchId,
  });
}

// ── Expanded permission matrix ───────────────────────────────────────────────

const PERMISSION_CASES = [
  {
    name: 'SUPER_ADMIN',
    subject: subjectOf({
      id: '507f1f77bcf86cd799439099',
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      userBranchId: null,
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN + MANAGE_TEACHERS',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN - MANAGE_TEACHERS',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.VIEW_TEACHERS],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'STAFF + MANAGE_TEACHERS',
    subject: subjectOf({
      adminRole: 'STAFF',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'STAFF - MANAGE_TEACHERS',
    subject: subjectOf({
      adminRole: 'STAFF',
      permissions: [],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'SUPPORT + MANAGE_TEACHERS',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'SUPPORT - MANAGE_TEACHERS',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_MESSAGES],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'VIEW_TEACHERS only',
    subject: subjectOf({
      permissions: [PERMISSIONS.VIEW_TEACHERS],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'no permission',
    subject: subjectOf({ permissions: [] }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'teacher',
    subject: subjectOf({
      role: 'teacher',
      adminRole: null,
      permissions: [],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
  {
    name: 'student',
    subject: subjectOf({
      role: 'student',
      adminRole: null,
      permissions: [],
    }),
    resource: { branchId: BRANCH_A },
    expect: 'DENY',
  },
];

for (const c of PERMISSION_CASES) {
  test(`Wave6.1 permission: ${c.name} → MATCH ${c.expect}`, () => {
    const { legacy } = assertMatch(c.name, c.subject, c.resource, 'approve');
    assert.equal(legacy.decision, c.expect);
  });
}

// ── Branch matrix ────────────────────────────────────────────────────────────

const BRANCH_CASES = [
  {
    name: 'SUPER / no branch → teacher Branch A',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      permissions: [],
      userBranchId: null,
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN Branch A → teacher Branch A',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'HIGH_ADMIN Branch A → teacher Branch B',
    subject: subjectOf({
      role: 'admin',
      adminRole: 'HIGH_ADMIN',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_B },
    expect: 'DENY',
  },
  {
    name: 'STAFF Branch A → teacher Branch A',
    subject: subjectOf({
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'STAFF Branch A → teacher Branch B',
    subject: subjectOf({
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_B },
    expect: 'DENY',
  },
  {
    name: 'SUPPORT Branch A → teacher Branch A',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_A },
    expect: 'ALLOW',
  },
  {
    name: 'SUPPORT Branch A → teacher Branch B',
    subject: subjectOf({
      adminRole: 'SUPPORT',
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: BRANCH_B },
    expect: 'DENY',
  },
  {
    name: 'STAFF Branch A → teacher null branch',
    subject: subjectOf({
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: BRANCH_A,
    }),
    resource: { branchId: null },
    expect: 'ALLOW',
  },
  {
    name: 'STAFF userBranchId null → teacher Branch B',
    subject: subjectOf({
      permissions: [PERMISSIONS.MANAGE_TEACHERS],
      userBranchId: null,
    }),
    resource: { branchId: BRANCH_B },
    expect: 'ALLOW',
  },
];

for (const c of BRANCH_CASES) {
  test(`Wave6.1 branch: ${c.name} → MATCH ${c.expect}`, () => {
    const { legacy } = assertMatch(c.name, c.subject, c.resource, 'score');
    assert.equal(legacy.decision, c.expect);
  });
}

// ── Client spoof matrix ──────────────────────────────────────────────────────

test('Wave6.1 spoof: body/query/params/tenant hints ignored — cross-branch still DENY MATCH', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TEACHERS],
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_B };
  const untrusted = {
    bodyBranchId: BRANCH_A,
    queryBranchId: BRANCH_A,
    paramsBranchId: BRANCH_A,
    bodyTenantId: 'tenant-spoof',
    queryTenantId: 'tenant-spoof',
  };
  const { legacy, policy } = assertMatch('spoof', subject, resource, 'reject', untrusted);
  assert.equal(legacy.decision, 'DENY');
  assert.equal(policy.decision, 'DENY');
});

test('Wave6.1 spoof: same-branch ALLOW unaffected by spoofed foreign branch/tenant', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TEACHERS],
    userBranchId: BRANCH_A,
  });
  const resource = { branchId: BRANCH_A };
  const { legacy } = assertMatch('spoof-allow', subject, resource, 'score', {
    bodyBranchId: BRANCH_B,
    queryBranchId: BRANCH_B,
    bodyTenantId: 'evil',
  });
  assert.equal(legacy.decision, 'ALLOW');
});

// ── Ownership / resource matrix ──────────────────────────────────────────────

test('Wave6.1 resource: missing teacher → MATCH DENY (branch layer)', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TEACHERS],
    userBranchId: BRANCH_A,
  });
  // Legacy assertTeacherBranchAccess: teacher null → 404 DENY when userBranchId set
  const { legacy } = assertMatch('missing', subject, null, 'approve');
  assert.equal(legacy.decision, 'DENY');
  assert.equal(legacy.reason, 'teacher_not_found');
});

test('Wave6.1 resource: teacher Branch A / B / null — MATCH legacy', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.MANAGE_TEACHERS],
    userBranchId: BRANCH_A,
  });
  assert.equal(assertMatch('A', subject, { branchId: BRANCH_A }).legacy.decision, 'ALLOW');
  assert.equal(assertMatch('B', subject, { branchId: BRANCH_B }).legacy.decision, 'DENY');
  assert.equal(assertMatch('null', subject, { branchId: null }).legacy.decision, 'ALLOW');
});

test('Wave6.1 resource: client input alone cannot authorize — needs MANAGE_TEACHERS', () => {
  const subject = subjectOf({
    permissions: [PERMISSIONS.VIEW_TEACHERS],
    userBranchId: BRANCH_A,
  });
  const { legacy } = assertMatch('no-authz', subject, { branchId: BRANCH_A }, 'score', {
    bodyBranchId: BRANCH_A,
  });
  assert.equal(legacy.decision, 'DENY');
});

// ── Fail-closed middleware ───────────────────────────────────────────────────

test('Wave6.1 fail-closed: Policy eval throw → ERROR; next(); no res mutation', async () => {
  const policyPath = require.resolve('../../services/policyShadow/teacherMutationPolicy');
  const mwPath = require.resolve('../../middleware/policyShadowTeacherWrite');
  const teacherPath = require.resolve('../../models/Teacher');

  delete require.cache[policyPath];
  delete require.cache[mwPath];
  delete require.cache[teacherPath];

  const policyMod = require('../../services/policyShadow/teacherMutationPolicy');
  policyMod.evaluatePolicyTeacherWrite = () => {
    throw new Error('forced policy failure');
  };

  // Avoid real DB: stub Teacher.findById
  const Teacher = require('../../models/Teacher');
  const origFind = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return {
        lean: async () => ({
          adminRole: 'STAFF',
          permissions: [PERMISSIONS.MANAGE_TEACHERS],
          role: 'staff',
          branchId: BRANCH_A,
        }),
      };
    },
  });

  try {
    const { policyShadowTeacherWrite } = require('../../middleware/policyShadowTeacherWrite');
    const mw = policyShadowTeacherWrite('score');
    let nextCount = 0;
    const req = {
      user: { id: '507f1f77bcf86cd799439001', role: 'staff' },
      userBranchId: BRANCH_A,
      params: { id: '507f1f77bcf86cd7994390aa' },
      body: {},
      query: {},
      method: 'PUT',
      originalUrl: '/api/teachers/x/score',
      requestId: 'req-wave61',
      correlationId: 'corr-wave61',
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    await mw(req, res, () => {
      nextCount += 1;
    });
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, null);
    assert.equal(res.body, null);
    assert.equal(req.policyShadow.comparison, 'ERROR');
  } finally {
    Teacher.findById = origFind;
    delete require.cache[policyPath];
    delete require.cache[mwPath];
    delete require.cache[teacherPath];
    require('../../services/policyShadow/teacherMutationPolicy');
    require('../../middleware/policyShadowTeacherWrite');
  }
});

// ── Shadow logging contract (static) ─────────────────────────────────────────

test('Wave6.1 logging: POLICY_MISMATCH / ERROR include security metadata; no secrets', () => {
  const src = fs.readFileSync(
    path.join(ROOT, 'middleware/policyShadowTeacherWrite.js'),
    'utf8',
  );
  for (const field of [
    'route',
    'method',
    'action',
    'userRole',
    'adminRole',
    'permission',
    'userBranchId',
    'resourceBranchId',
    'legacyDecision',
    'policyDecision',
    'requestId',
    'correlationId',
  ]) {
    assert.ok(src.includes(field), `missing log field ${field}`);
  }
  assert.ok(src.includes('POLICY_MISMATCH'));
  assert.ok(src.includes('POLICY_SHADOW_ERROR'));
  assert.ok(src.includes('return next()'));
  // Must not log secrets / full body
  assert.ok(!/password|refreshToken|JWT_SECRET|payment/i.test(src));
  assert.ok(!src.includes('JSON.stringify(req.body)'));
  assert.ok(!src.includes('req.headers.authorization'));
});

// ── Static guards ────────────────────────────────────────────────────────────

test('Wave6.1 static: score/approve/reject keep legacy guards + shadow', () => {
  const src = fs.readFileSync(path.join(ROOT, 'routes/teacherRoutes.js'), 'utf8');
  const gate = fs.readFileSync(path.join(ROOT, 'middleware/teachersCutoverGate.js'), 'utf8');
  for (const action of ['score', 'approve', 'reject']) {
    const start = src.indexOf(`router.put('/:id/${action}'`);
    assert.ok(start >= 0, `missing route ${action}`);
    const end = src.indexOf('], async', start);
    const block = src.slice(start, end);
    assert.ok(block.includes(`teacherWriteGuard('${action}')`), action);
    assert.ok(block.includes('branchFilter'), action);
  }
  assert.ok(src.includes('policyShadowTeacherWrite'));
  assert.ok(src.includes('teachersCutoverGate'));
  assert.ok(gate.includes('checkPermission(PERMISSIONS.MANAGE_TEACHERS)'));
  assert.ok(gate.includes('assertTeacherBranchAccess'));
});

// ── CQRS config freeze ───────────────────────────────────────────────────────

function parseEnvCqrs(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const key of [
    'ENABLE_CQRS_TEACHER',
    'ENABLE_CQRS_STUDENT_CREATE',
    'ENABLE_CQRS_INVOICE',
  ]) {
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\r\\n#]+)`, 'm'));
    out[key] = m ? m[1].trim() : undefined;
  }
  return out;
}

function isOff(v) {
  if (v === undefined || v === '') return true;
  const s = String(v).toLowerCase();
  return s === 'false' || s === '0' || s === 'off' || s === 'no';
}

test('Wave6.1 config: .env CQRS flags ALL OFF', () => {
  const flags = parseEnvCqrs(path.join(ROOT, '.env'));
  assert.ok(flags, '.env missing');
  for (const key of Object.keys(flags)) {
    assert.ok(isOff(flags[key]), `${key}=${flags[key]} must be OFF`);
  }
});

test('Wave6.1 config: .env.example documents CQRS flags as false', () => {
  const flags = parseEnvCqrs(path.join(ROOT, '.env.example'));
  assert.ok(flags);
  assert.equal(flags.ENABLE_CQRS_TEACHER, 'false');
  assert.equal(flags.ENABLE_CQRS_STUDENT_CREATE, 'false');
  assert.equal(flags.ENABLE_CQRS_INVOICE, 'false');
});

test('Wave6.1 config: docker/CI/deploy manifests do not enable CQRS', () => {
  const roots = [
    path.join(ROOT, 'docker-compose.yml'),
    path.join(ROOT, 'docker-compose.prod.yml'),
    path.join(ROOT, 'deployment/docker-compose.yml'),
    path.join(ROOT, 'deployment/k8s-deployment.yaml'),
    path.join(ROOT, '.github/workflows/node.yml'),
    path.join(ROOT, '.github/workflows/production.yml'),
    path.join(ROOT, '.env.deploy.example'),
  ];
  for (const file of roots) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(
      !/ENABLE_CQRS_[A-Z_]+\s*[:=]\s*['"]?true['"]?/i.test(text),
      `${path.relative(ROOT, file)} enables CQRS`,
    );
  }
});

test('Wave6.1 config: production validateEnv rejects CQRS without ALLOW opt-in', () => {
  delete require.cache[require.resolve('../../config/validateEnv')];
  const validateEnv = require('../../config/validateEnv');
  const keys = [
    'NODE_ENV',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CLIENT_URL',
    'SEPAY_API_KEY',
    'REDIS_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'ENABLE_CQRS_INVOICE',
    'MONGODB_URI',
    'ALLOW_CQRS_IN_PRODUCTION',
  ];
  const prev = {};
  for (const k of keys) prev[k] = process.env[k];
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    process.env.CLIENT_URL = 'https://example.com';
    process.env.SEPAY_API_KEY = 'k';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.SMTP_HOST = 'h';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    process.env.ENABLE_CQRS_INVOICE = 'true';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
    delete process.env.ALLOW_CQRS_IN_PRODUCTION;
    assert.throws(() => validateEnv(), /ALLOW_CQRS_IN_PRODUCTION/);
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    delete require.cache[require.resolve('../../config/validateEnv')];
  }
});

test('Wave6.1 config: live permission authority remains constants/permissions.js', () => {
  const adapter = fs.readFileSync(
    path.join(ROOT, 'services/policyShadow/livePermissionAdapter.js'),
    'utf8',
  );
  assert.ok(adapter.includes("require('../../constants/permissions')"));
  assert.ok(!adapter.includes("require('../../shared/constants/permissions')"));
  assert.ok(!adapter.includes("require('../shared/constants/permissions')"));
  assert.equal(TEACHER_WRITE_LIVE, PERMISSIONS.MANAGE_TEACHERS);
});
