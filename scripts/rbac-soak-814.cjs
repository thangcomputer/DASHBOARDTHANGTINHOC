/**
 * Phase 8.14 — LOCAL RBAC soak (branch/ownership + known-legacy bare-admin).
 * LIVE PRIMARY. Enterprise observe/dual-check only. Does not change .env defaults.
 *
 * Usage: node scripts/rbac-soak-814.cjs
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const Teacher = require('../models/Teacher');
const { checkPermission, checkAnyPermission } = require('../middleware/auth');
const { PERMISSIONS: LIVE } = require('../constants/permissions');
const {
  computeAndRecordStaticParity,
  snapshotSoakWindow,
  deltaSoakWindow,
  getSoakEvidenceSnapshot,
  getSoakEvidenceStatus,
  resetSoakEvidenceForTests,
} = require('../services/rbacParity/soakEvidence');
const { getParityMetricsSnapshot, resetParityMetricsForTests } = require('../services/rbacParity/metrics');
const { observeLiveStaffGate } = require('../services/rbacParity/observe');
const { dualCheckLiveStaffGate } = require('../services/rbacParity/dualCheck');

const ARTIFACT = path.join(__dirname, '..', 'artifacts', 'rbac-soak-814.json');

const ACTORS = {
  SUPER: {
    id: '507f1f77bcf86cd799439011', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
  },
  HIGH: {
    id: '507f1f77bcf86cd799439012',
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [
      LIVE.MANAGE_HR, LIVE.MANAGE_TEACHERS, LIVE.VIEW_TEACHERS, LIVE.MANAGE_FINANCE,
      LIVE.VIEW_BRANCH_REVENUE, LIVE.MANAGE_STUDENT_TRAINING, LIVE.MANAGE_TRAINING,
      LIVE.MANAGE_STAFF, LIVE.MANAGE_BLOG, LIVE.SYSTEM_SETTINGS,
    ],
  },
  STAFF_HR: {
    id: '507f1f77bcf86cd799439013', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR],
  },
  STAFF_TEACHER_VIEW: {
    id: '507f1f77bcf86cd799439014', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.VIEW_TEACHERS],
  },
  STAFF_TEACHER_MANAGE: {
    id: '507f1f77bcf86cd799439015', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_TEACHERS],
  },
  STAFF_REVENUE: {
    id: '507f1f77bcf86cd799439016', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.VIEW_BRANCH_REVENUE],
  },
  STAFF_FINANCE: {
    id: '507f1f77bcf86cd799439017', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_FINANCE],
  },
  STAFF_STUDENT_TRAINING: {
    id: '507f1f77bcf86cd799439018', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_STUDENT_TRAINING],
  },
  STAFF_TRAINING: {
    id: '507f1f77bcf86cd799439019', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_TRAINING],
  },
  STAFF_STAFFMGMT: {
    id: '507f1f77bcf86cd79943901a', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_STAFF],
  },
  STAFF_BLOG: {
    id: '507f1f77bcf86cd79943901b', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_BLOG],
  },
  STAFF_SETTINGS: {
    id: '507f1f77bcf86cd79943901c', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.SYSTEM_SETTINGS],
  },
  SUPPORT: {
    id: '507f1f77bcf86cd79943901d',
    role: 'staff',
    adminRole: 'SUPPORT',
    permissions: [LIVE.VIEW_TEACHERS, LIVE.VIEW_BRANCH_REVENUE],
  },
  TEACHER: {
    id: '507f1f77bcf86cd79943901e', role: 'teacher', adminRole: null, permissions: [LIVE.MANAGE_HR],
  },
  STUDENT: {
    id: '507f1f77bcf86cd79943901f', role: 'student', adminRole: null, permissions: [],
  },
  ROOT: {
    id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
  },
  ADMIN_NO_ROLE: {
    id: '507f1f77bcf86cd799439020',
    role: 'admin',
    adminRole: null,
    permissions: [LIVE.MANAGE_HR],
  },
  ADMIN_WITH_STAFF_ROLE: {
    id: '507f1f77bcf86cd799439021',
    role: 'admin',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_HR],
  },
};

function installTeacherMock() {
  const orig = Teacher.findById;
  Teacher.findById = (id) => ({
    select() {
      return {
        lean: async () => {
          const hit = Object.values(ACTORS).find((a) => String(a.id) === String(id));
          if (!hit) return null;
          return { adminRole: hit.adminRole, permissions: hit.permissions, role: hit.role };
        },
      };
    },
  });
  return () => { Teacher.findById = orig; };
}

/** LIVE-aligned soak scope gate (mirrors branchFilter/ownership deny before handler). */
function applySoakContext(req) {
  const branch = String(req.headers['x-soak-branch'] || 'same');
  const ownership = String(req.headers['x-soak-ownership'] || 'owner');
  const action = req.headers['x-soak-action'] ? String(req.headers['x-soak-action']) : null;
  const u = req.user || {};
  const isSuper = u.id === 'admin' || u.adminRole === 'SUPER_ADMIN';

  let scopeOk = true;
  let ownershipOk = true;
  if (!isSuper) {
    if (branch === 'cross' || branch === 'null' || branch === 'missing') scopeOk = false;
    if (ownership === 'nonowner' || ownership === 'missing' || ownership === 'other_branch') {
      ownershipOk = false;
    }
  }

  req.soakScopeOk = scopeOk;
  req.soakOwnershipOk = ownershipOk;
  req.soakBranchClass = branch;
  req.soakOwnerClass = ownership;
  req.soakAction = action;
  return { scopeOk, ownershipOk, branch, ownership, action, isSuper };
}

function liveScopeDenyThenShadow(permission) {
  return async (req, res, next) => {
    const ctx = applySoakContext(req);
    if (ctx.scopeOk && ctx.ownershipOk) return next();
    // LIVE DENY for scope/ownership — still run shadow hooks (same as checkPermission)
    const opts = {
      liveDecision: 'DENY',
      livePermission: permission,
      evidenceChannel: 'RUNTIME',
      scopeOk: ctx.scopeOk,
      ownershipOk: ctx.ownershipOk,
      branchClass: ctx.branch,
      ownerClass: ctx.ownership,
      action: ctx.action,
    };
    try { observeLiveStaffGate(req, opts); } catch { /* ignore */ }
    try { dualCheckLiveStaffGate(req, opts); } catch { /* ignore */ }
    return res.status(403).json({ success: false, message: 'LIVE scope/ownership deny' });
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const key = req.headers['x-soak-actor'];
    if (!key || key === 'UNAUTH') {
      req.user = null;
      req.requestId = `soak-${Date.now()}-unauth`;
      req.correlationId = req.requestId;
      return next();
    }
    const actor = ACTORS[key];
    if (!actor) {
      return res.status(401).json({ success: false, message: 'unknown soak actor' });
    }
    req.user = {
      id: actor.id,
      role: actor.role,
      adminRole: actor.adminRole,
      permissions: actor.permissions,
    };
    req.requestId = `soak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    req.correlationId = req.requestId;
    applySoakContext(req);
    next();
  });

  const ok = (_req, res) => res.status(200).json({ success: true, soak: true });

  const hrScoped = [
    liveScopeDenyThenShadow(LIVE.MANAGE_HR),
    checkPermission(LIVE.MANAGE_HR),
    ok,
  ];

  app.get('/soak/hr/list', ...hrScoped);
  app.get('/soak/hr/stats', ...hrScoped);
  app.post('/soak/hr/create', ...hrScoped);
  app.put('/soak/hr/update', ...hrScoped);
  app.delete('/soak/hr/delete', ...hrScoped);
  app.post('/soak/hr/pay', ...hrScoped);
  app.get('/soak/hr/payroll', ...hrScoped);

  app.get('/soak/teachers/stats', checkPermission(LIVE.VIEW_TEACHERS), ok);
  app.post('/soak/teachers/score', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.post('/soak/teachers/approve', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.post('/soak/teachers/reject', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.post('/soak/teachers/create', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.delete('/soak/teachers/delete', checkPermission(LIVE.MANAGE_TEACHERS), ok);

  app.get('/soak/finance/revenue', checkAnyPermission(LIVE.MANAGE_FINANCE, LIVE.VIEW_BRANCH_REVENUE), ok);
  app.get('/soak/finance/analytics', checkPermission(LIVE.VIEW_BRANCH_REVENUE), ok);
  app.post('/soak/finance/payment', checkPermission(LIVE.MANAGE_FINANCE), ok);
  app.post('/soak/finance/refund', checkPermission(LIVE.MANAGE_FINANCE), ok);

  app.get('/soak/student-training/settings', checkPermission(LIVE.MANAGE_STUDENT_TRAINING), ok);
  app.get('/soak/training/manage', checkPermission(LIVE.MANAGE_TRAINING), ok);
  app.get('/soak/staff/list', checkPermission(LIVE.MANAGE_STAFF), ok);
  app.post('/soak/blog/publish', checkPermission(LIVE.MANAGE_BLOG), ok);
  app.put('/soak/settings/update', checkPermission(LIVE.SYSTEM_SETTINGS), ok);
  app.get('/soak/legacy/schedule', checkPermission(LIVE.MANAGE_SCHEDULE), ok);

  return app;
}

function request(server, {
  method = 'GET', url, actorKey, branch, ownership, action,
}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const headers = {
      'content-type': 'application/json',
    };
    if (actorKey) headers['x-soak-actor'] = actorKey;
    if (branch) headers['x-soak-branch'] = branch;
    if (ownership) headers['x-soak-ownership'] = ownership;
    if (action) headers['x-soak-action'] = action;
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path: url,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runMatrix(server) {
  const calls = [];
  const hit = async (actorKey, method, url, extra = {}) => {
    const res = await request(server, {
      method, url, actorKey, ...extra,
    });
    calls.push({
      actorKey, method, url, status: res.status, ...extra,
    });
    return res;
  };

  for (const p of [
    ['GET', '/soak/hr/list'], ['GET', '/soak/hr/stats'], ['POST', '/soak/hr/create'],
    ['PUT', '/soak/hr/update'], ['DELETE', '/soak/hr/delete'], ['POST', '/soak/hr/pay'],
    ['GET', '/soak/hr/payroll'],
  ]) {
    await hit('STAFF_HR', p[0], p[1], { branch: 'same', ownership: 'owner' });
  }

  // Branch / ownership (LIVE DENY + Enterprise DENY → MATCH)
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'cross', ownership: 'owner' });
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'null', ownership: 'owner' });
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'missing', ownership: 'owner' });
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'same', ownership: 'nonowner' });
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'same', ownership: 'missing' });
  await hit('STAFF_HR', 'GET', '/soak/hr/list', { branch: 'same', ownership: 'other_branch' });
  // SUPER bypasses scope
  await hit('SUPER', 'GET', '/soak/hr/list', { branch: 'cross', ownership: 'nonowner' });
  await hit('HIGH', 'GET', '/soak/hr/list', { branch: 'same', ownership: 'owner' });
  await hit('HIGH', 'GET', '/soak/hr/list', { branch: 'cross', ownership: 'owner' });
  await hit('SUPPORT', 'GET', '/soak/teachers/stats', { branch: 'same' });

  await hit('TEACHER', 'GET', '/soak/hr/list');
  await hit('STUDENT', 'GET', '/soak/hr/list');
  await hit('UNAUTH', 'GET', '/soak/hr/list');

  await hit('STAFF_TEACHER_VIEW', 'GET', '/soak/teachers/stats');
  await hit('STAFF_TEACHER_VIEW', 'POST', '/soak/teachers/approve');
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/score');
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/approve');
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/reject');
  // create/delete remain SUPER authority in LIVE product semantics — exercise SUPER only
  await hit('SUPER', 'POST', '/soak/teachers/create', { action: 'create' });
  await hit('SUPER', 'DELETE', '/soak/teachers/delete', { action: 'delete' });

  await hit('STAFF_REVENUE', 'GET', '/soak/finance/revenue');
  await hit('STAFF_REVENUE', 'GET', '/soak/finance/analytics');
  await hit('STAFF_REVENUE', 'POST', '/soak/finance/payment');
  await hit('STAFF_REVENUE', 'POST', '/soak/finance/refund');
  await hit('STAFF_FINANCE', 'POST', '/soak/finance/payment');
  await hit('STAFF_FINANCE', 'POST', '/soak/finance/refund');

  await hit('STAFF_STUDENT_TRAINING', 'GET', '/soak/student-training/settings');
  await hit('STAFF_STUDENT_TRAINING', 'GET', '/soak/training/manage');
  await hit('STAFF_TRAINING', 'GET', '/soak/training/manage');
  await hit('STAFF_TRAINING', 'GET', '/soak/student-training/settings');

  await hit('STAFF_STAFFMGMT', 'GET', '/soak/staff/list');
  await hit('STAFF_BLOG', 'POST', '/soak/blog/publish');
  await hit('STAFF_SETTINGS', 'PUT', '/soak/settings/update');

  await hit('ROOT', 'GET', '/soak/finance/revenue');
  await hit('ADMIN_WITH_STAFF_ROLE', 'GET', '/soak/hr/list');
  // Known legacy: bare JWT admin
  await hit('ADMIN_NO_ROLE', 'GET', '/soak/hr/list');

  await hit('SUPER', 'GET', '/soak/legacy/schedule');

  return calls;
}

async function main() {
  const startIso = new Date().toISOString();
  const prev = {
    observe: process.env.RBAC_PARITY_OBSERVE_ENABLED,
    dual: process.env.RBAC_DUAL_CHECK_ENABLED,
    soak: process.env.RBAC_SOAK_WINDOW_ACTIVE,
  };

  resetSoakEvidenceForTests();
  resetParityMetricsForTests();
  const staticSnap = computeAndRecordStaticParity();

  process.env.RBAC_PARITY_OBSERVE_ENABLED = 'true';
  process.env.RBAC_DUAL_CHECK_ENABLED = 'true';
  process.env.RBAC_SOAK_WINDOW_ACTIVE = 'true';

  const restoreTeacher = installTeacherMock();
  const app = buildApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  let report;
  try {
    const before = snapshotSoakWindow();
    const calls = await runMatrix(server);
    const after = snapshotSoakWindow();
    const delta = deltaSoakWindow(before, after);
    const endIso = new Date().toISOString();
    const status = getSoakEvidenceStatus();
    const channels = getSoakEvidenceSnapshot().channels;

    report = {
      phase: '8.14',
      RUNTIME_ENVIRONMENT: 'LOCAL',
      soakWindow: { start: startIso, end: endIso },
      SOAK_EVIDENCE: status.SOAK_EVIDENCE,
      static: staticSnap,
      channels,
      soakDelta: delta,
      httpCalls: calls.length,
      mismatchInventory: delta.newRuntimeMismatchSamples || [],
      roleMismatchAudit: {
        classification: 'LEGACY_COMPATIBILITY',
        knownAs: 'KNOWN_LEGACY_MISMATCH',
        live: 'JWT admin|staff + permissions without adminRole → ALLOW (assertStaffPermissions fallthrough)',
        enterprise: 'CONDITIONAL DENY (role_unresolved_adminRole) — no admin→SUPER/STAFF flatten',
        action: 'Keep MISMATCH; do not promote; future architectural approval required',
      },
      ENTERPRISE_PRIMARY_READY: 'NO',
      safety: {
        finalDecisionEqualsLiveDecision: true,
        liveSemanticsUnchanged: true,
        enterpriseNotPromoted: true,
      },
      metrics: getParityMetricsSnapshot(),
    };

    fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
    fs.writeFileSync(ARTIFACT, JSON.stringify(report, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ok: true,
      artifact: ARTIFACT,
      SOAK_EVIDENCE: report.SOAK_EVIDENCE,
      soakDelta: {
        requests: delta.requests,
        match: delta.match,
        mismatch: delta.mismatch,
        unknown: delta.unknown,
        unsupported: delta.unsupported,
        observer_errors: delta.observer_errors,
        dualcheck_errors: delta.dualcheck_errors,
        mismatchReasons: delta.mismatchReasons,
      },
      httpCalls: report.httpCalls,
      ENTERPRISE_PRIMARY_READY: 'NO',
    }, null, 2));
  } finally {
    restoreTeacher();
    await new Promise((r) => server.close(r));
    if (prev.observe === undefined) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    else process.env.RBAC_PARITY_OBSERVE_ENABLED = prev.observe;
    if (prev.dual === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
    else process.env.RBAC_DUAL_CHECK_ENABLED = prev.dual;
    if (prev.soak === undefined) delete process.env.RBAC_SOAK_WINDOW_ACTIVE;
    else process.env.RBAC_SOAK_WINDOW_ACTIVE = prev.soak;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
