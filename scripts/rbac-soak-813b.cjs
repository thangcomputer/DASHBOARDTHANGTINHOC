/**
 * Phase 8.13B — Controlled LOCAL RBAC soak window.
 *
 * Drives real HTTP → Express → checkPermission / checkAnyPermission
 * (LIVE auth middleware) with observe + dual-check flags ON.
 *
 * Classifies evidence as RUNTIME (middleware tags). Environment = LOCAL.
 * Does NOT promote Enterprise. Does NOT mutate production .env defaults.
 *
 * Usage: node scripts/rbac-soak-813b.cjs
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
  EVIDENCE_CHANNEL,
} = require('../services/rbacParity/soakEvidence');
const { getParityMetricsSnapshot, resetParityMetricsForTests } = require('../services/rbacParity/metrics');

const ARTIFACT = path.join(__dirname, '..', 'artifacts', 'rbac-soak-813b.json');

/** Fixture actors — trusted server-side identities only (no client spoof). */
const ACTORS = {
  SUPER: {
    id: '507f1f77bcf86cd799439011',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  },
  HIGH: {
    id: '507f1f77bcf86cd799439012',
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    permissions: [
      LIVE.MANAGE_HR,
      LIVE.MANAGE_TEACHERS,
      LIVE.VIEW_TEACHERS,
      LIVE.MANAGE_FINANCE,
      LIVE.VIEW_BRANCH_REVENUE,
      LIVE.MANAGE_STUDENT_TRAINING,
      LIVE.MANAGE_TRAINING,
      LIVE.MANAGE_STAFF,
      LIVE.MANAGE_BLOG,
      LIVE.SYSTEM_SETTINGS,
    ],
  },
  STAFF_HR: {
    id: '507f1f77bcf86cd799439013',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_HR],
  },
  STAFF_TEACHER_VIEW: {
    id: '507f1f77bcf86cd799439014',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.VIEW_TEACHERS],
  },
  STAFF_TEACHER_MANAGE: {
    id: '507f1f77bcf86cd799439015',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_TEACHERS],
  },
  STAFF_REVENUE: {
    id: '507f1f77bcf86cd799439016',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.VIEW_BRANCH_REVENUE],
  },
  STAFF_FINANCE: {
    id: '507f1f77bcf86cd799439017',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_FINANCE],
  },
  STAFF_STUDENT_TRAINING: {
    id: '507f1f77bcf86cd799439018',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_STUDENT_TRAINING],
  },
  STAFF_TRAINING: {
    id: '507f1f77bcf86cd799439019',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_TRAINING],
  },
  STAFF_STAFFMGMT: {
    id: '507f1f77bcf86cd79943901a',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_STAFF],
  },
  STAFF_BLOG: {
    id: '507f1f77bcf86cd79943901b',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.MANAGE_BLOG],
  },
  STAFF_SETTINGS: {
    id: '507f1f77bcf86cd79943901c',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: [LIVE.SYSTEM_SETTINGS],
  },
  SUPPORT: {
    id: '507f1f77bcf86cd79943901d',
    role: 'staff',
    adminRole: 'SUPPORT',
    permissions: [LIVE.VIEW_TEACHERS, LIVE.VIEW_BRANCH_REVENUE],
  },
  TEACHER: {
    id: '507f1f77bcf86cd79943901e',
    role: 'teacher',
    adminRole: null,
    permissions: [LIVE.MANAGE_HR],
  },
  STUDENT: {
    id: '507f1f77bcf86cd79943901f',
    role: 'student',
    adminRole: null,
    permissions: [],
  },
  ROOT: {
    id: 'admin',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    permissions: [],
  },
  ADMIN_NO_ROLE: {
    id: '507f1f77bcf86cd799439020',
    role: 'admin',
    adminRole: null,
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
          return {
            adminRole: hit.adminRole,
            permissions: hit.permissions,
            role: hit.role,
          };
        },
      };
    },
  });
  return () => { Teacher.findById = orig; };
}

function buildApp() {
  const app = express();
  app.use(express.json());

  // Inject trusted actor from header (soak harness only — not production auth)
  app.use((req, res, next) => {
    const key = req.headers['x-soak-actor'];
    const actor = ACTORS[key];
    if (!actor) {
      return res.status(401).json({ success: false, message: 'missing soak actor' });
    }
    req.user = {
      id: actor.id,
      role: actor.role,
      adminRole: actor.adminRole,
      permissions: actor.permissions,
    };
    req.requestId = `soak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    req.correlationId = req.requestId;
    next();
  });

  const ok = (_req, res) => res.status(200).json({ success: true, soak: true });

  // HR
  app.get('/soak/hr/list', checkPermission(LIVE.MANAGE_HR), ok);
  app.get('/soak/hr/stats', checkPermission(LIVE.MANAGE_HR), ok);
  app.post('/soak/hr/create', checkPermission(LIVE.MANAGE_HR), ok);
  app.put('/soak/hr/update', checkPermission(LIVE.MANAGE_HR), ok);
  app.delete('/soak/hr/delete', checkPermission(LIVE.MANAGE_HR), ok);
  app.post('/soak/hr/pay', checkPermission(LIVE.MANAGE_HR), ok);
  app.get('/soak/hr/payroll', checkPermission(LIVE.MANAGE_HR), ok);

  // Teachers
  app.get('/soak/teachers/stats', checkPermission(LIVE.VIEW_TEACHERS), ok);
  app.post('/soak/teachers/score', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.post('/soak/teachers/approve', checkPermission(LIVE.MANAGE_TEACHERS), ok);
  app.post('/soak/teachers/reject', checkPermission(LIVE.MANAGE_TEACHERS), ok);

  // Finance
  app.get('/soak/finance/revenue', checkAnyPermission(LIVE.MANAGE_FINANCE, LIVE.VIEW_BRANCH_REVENUE), ok);
  app.get('/soak/finance/analytics', checkPermission(LIVE.VIEW_BRANCH_REVENUE), ok);
  app.post('/soak/finance/payment', checkPermission(LIVE.MANAGE_FINANCE), ok);
  app.post('/soak/finance/refund', checkPermission(LIVE.MANAGE_FINANCE), ok);

  // Student training / training
  app.get('/soak/student-training/settings', checkPermission(LIVE.MANAGE_STUDENT_TRAINING), ok);
  app.get('/soak/training/manage', checkPermission(LIVE.MANAGE_TRAINING), ok);

  // Staff / blog / settings
  app.get('/soak/staff/list', checkPermission(LIVE.MANAGE_STAFF), ok);
  app.post('/soak/blog/publish', checkPermission(LIVE.MANAGE_BLOG), ok);
  app.put('/soak/settings/update', checkPermission(LIVE.SYSTEM_SETTINGS), ok);

  // Unsupported LIVE-only (expect UNSUPPORTED classification, not mismatch)
  app.get('/soak/legacy/schedule', checkPermission(LIVE.MANAGE_SCHEDULE), ok);

  return app;
}

function request(server, { method = 'GET', url, actorKey, body }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opts = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: url,
      method,
      headers: {
        'x-soak-actor': actorKey,
        'content-type': 'application/json',
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runMatrix(server) {
  const calls = [];
  const hit = async (actorKey, method, url, expectStatus) => {
    const res = await request(server, { method, url, actorKey });
    calls.push({ actorKey, method, url, status: res.status, expectStatus });
    return res;
  };

  // HR ALLOW
  for (const p of [
    ['GET', '/soak/hr/list'],
    ['GET', '/soak/hr/stats'],
    ['POST', '/soak/hr/create'],
    ['PUT', '/soak/hr/update'],
    ['DELETE', '/soak/hr/delete'],
    ['POST', '/soak/hr/pay'],
    ['GET', '/soak/hr/payroll'],
  ]) {
    await hit('STAFF_HR', p[0], p[1], 200);
  }
  // HR DENY for teacher
  await hit('TEACHER', 'GET', '/soak/hr/list', 403);
  await hit('STUDENT', 'GET', '/soak/hr/list', 403);

  // Teachers view vs manage
  await hit('STAFF_TEACHER_VIEW', 'GET', '/soak/teachers/stats', 200);
  await hit('STAFF_TEACHER_VIEW', 'POST', '/soak/teachers/approve', 403);
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/score', 200);
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/approve', 200);
  await hit('STAFF_TEACHER_MANAGE', 'POST', '/soak/teachers/reject', 200);

  // Finance revenue vs manage
  await hit('STAFF_REVENUE', 'GET', '/soak/finance/revenue', 200);
  await hit('STAFF_REVENUE', 'GET', '/soak/finance/analytics', 200);
  await hit('STAFF_REVENUE', 'POST', '/soak/finance/payment', 403);
  await hit('STAFF_REVENUE', 'POST', '/soak/finance/refund', 403);
  await hit('STAFF_FINANCE', 'POST', '/soak/finance/payment', 200);
  await hit('STAFF_FINANCE', 'POST', '/soak/finance/refund', 200);
  await hit('STAFF_FINANCE', 'GET', '/soak/finance/revenue', 200);

  // Student training vs training
  await hit('STAFF_STUDENT_TRAINING', 'GET', '/soak/student-training/settings', 200);
  await hit('STAFF_STUDENT_TRAINING', 'GET', '/soak/training/manage', 403);
  await hit('STAFF_TRAINING', 'GET', '/soak/training/manage', 200);
  await hit('STAFF_TRAINING', 'GET', '/soak/student-training/settings', 403);

  // Staff / blog / settings
  await hit('STAFF_STAFFMGMT', 'GET', '/soak/staff/list', 200);
  await hit('STAFF_BLOG', 'POST', '/soak/blog/publish', 200);
  await hit('STAFF_SETTINGS', 'PUT', '/soak/settings/update', 200);

  // Roles
  await hit('SUPER', 'GET', '/soak/hr/list', 200);
  await hit('HIGH', 'GET', '/soak/hr/list', 200);
  await hit('SUPPORT', 'GET', '/soak/teachers/stats', 200);
  await hit('ROOT', 'GET', '/soak/finance/payment'.replace('payment', 'revenue'), 200);
  await hit('ROOT', 'GET', '/soak/finance/revenue', 200);
  // JWT admin without adminRole — LIVE may ALLOW if permissions present;
  // Enterprise shadow DENY (CONDITIONAL) → REAL RUNTIME ROLE_MISMATCH (do not auto-fix).
  await hit('ADMIN_NO_ROLE', 'GET', '/soak/hr/list', null);

  // Unsupported
  await hit('SUPER', 'GET', '/soak/legacy/schedule', 200);

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

  // Enable soak window ONLY in this process
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

    // LOCAL soak must NEVER set ENTERPRISE_PRIMARY_READY=YES (Phase 8.16).
    report = {
      phase: '8.13B',
      RUNTIME_ENVIRONMENT: 'LOCAL',
      soakWindow: { start: startIso, end: endIso },
      SOAK_EVIDENCE: status.SOAK_EVIDENCE,
      soakStatus: status,
      static: staticSnap,
      channels,
      soakDelta: delta,
      httpCalls: calls.length,
      callSample: calls.slice(0, 5),
      metrics: getParityMetricsSnapshot(),
      ENTERPRISE_PRIMARY_READY: 'NO',
      note: 'LOCAL controlled HTTP through checkPermission; not production traffic',
      safety: {
        finalDecisionEqualsLiveDecision: true,
        enterpriseNotAuthoritative: true,
      },
    };

    fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
    fs.writeFileSync(ARTIFACT, JSON.stringify(report, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ok: true,
      artifact: ARTIFACT,
      SOAK_EVIDENCE: report.SOAK_EVIDENCE,
      RUNTIME_ENVIRONMENT: report.RUNTIME_ENVIRONMENT,
      soakDelta: report.soakDelta,
      ENTERPRISE_PRIMARY_READY: report.ENTERPRISE_PRIMARY_READY,
      httpCalls: report.httpCalls,
    }, null, 2));
  } finally {
    restoreTeacher();
    await new Promise((r) => server.close(r));
    // Disable soak flags — restore previous process env
    if (prev.observe === undefined) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    else process.env.RBAC_PARITY_OBSERVE_ENABLED = prev.observe;
    if (prev.dual === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
    else process.env.RBAC_DUAL_CHECK_ENABLED = prev.dual;
    if (prev.soak === undefined) delete process.env.RBAC_SOAK_WINDOW_ACTIVE;
    else process.env.RBAC_SOAK_WINDOW_ACTIVE = prev.soak;
  }

  // Fail process if runtime mismatches/errors in soak delta
  if (report.soakDelta.mismatch > 0 || report.soakDelta.unknown > 0
    || report.soakDelta.observer_errors > 0 || report.soakDelta.dualcheck_errors > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
