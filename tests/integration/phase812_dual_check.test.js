/**
 * Phase 8.12 — Dual-Check shadow (Enterprise SHADOW ONLY; LIVE = PRIMARY).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Teacher = require('../../models/Teacher');
const { checkPermission } = require('../../middleware/auth');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ENT = require('../../shared/constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const { normalizeFamily } = require('../../services/policyShadow/cutoverAuthority');
const ROLES = require('../../shared/constants/roles');
const {
  COMPARISON,
  expandLivePermissionsToEnterprise,
  isRbacDualCheckEnabled,
  dualCheckLiveStaffGate,
  evaluateEnterpriseShadow,
  MISMATCH_REASON,
  resolveRole,
  buildTrustedActor,
  getParityMetricsSnapshot,
  resetParityMetricsForTests,
} = require('../../services/rbacParity');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function actorReq(extra = {}) {
  return {
    user: {
      id: extra.id ?? '507f1f77bcf86cd799439011',
      role: extra.role ?? 'staff',
      adminRole: Object.prototype.hasOwnProperty.call(extra, 'adminRole')
        ? extra.adminRole
        : 'STAFF',
      permissions: extra.permissions ?? [],
      userBranchId: extra.userBranchId ?? null,
    },
    body: extra.body || {},
    query: extra.query || {},
    requestId: 'req-812',
    correlationId: 'cor-812',
    path: '/api/test',
    route: { path: '/api/test' },
  };
}

function withTeacher(doc, fn) {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() { return { lean: async () => doc }; },
  });
  return Promise.resolve().then(fn).finally(() => { Teacher.findById = orig; });
}

async function withFlag(value, fn) {
  const prev = process.env.RBAC_DUAL_CHECK_ENABLED;
  if (value === undefined || value === null) delete process.env.RBAC_DUAL_CHECK_ENABLED;
  else process.env.RBAC_DUAL_CHECK_ENABLED = String(value);
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
    else process.env.RBAC_DUAL_CHECK_ENABLED = prev;
  }
}

describe('Phase 8.12 dual-check shadow', { concurrency: false }, () => {
  // ── Basic ──────────────────────────────────────────────────────────────
  it('1 LIVE ALLOW / Enterprise ALLOW', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        family: 'employees',
      });
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.finalDecision, 'ALLOW');
      assert.notEqual(out.enterpriseDecision, undefined);
    });
  });

  it('2 LIVE DENY / Enterprise DENY', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.VIEW_TEACHERS] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.liveDecision, 'DENY');
      assert.equal(out.enterpriseDecision, 'DENY');
    });
  });

  it('3 LIVE ALLOW / Enterprise DENY', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MISMATCH);
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.finalDecision, 'ALLOW');
      assert.ok(out.mismatchReason);
    });
  });

  it('4 LIVE DENY / Enterprise ALLOW', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MISMATCH);
      assert.equal(out.liveDecision, 'DENY');
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.finalDecision, 'DENY');
    });
  });

  // ── Safety ─────────────────────────────────────────────────────────────
  it('5 Enterprise DENY cannot block LIVE ALLOW', async () => {
    await withFlag('true', async () => {
      dualCheckLiveStaffGate(actorReq({ permissions: [] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
      });
      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [LIVE.MANAGE_HR] });
          const res = mockRes();
          let next = false;
          await mw(req, res, () => { next = true; });
          assert.equal(next, true);
          assert.equal(res.statusCode, 200);
        },
      );
    });
  });

  it('6 Enterprise ALLOW cannot bypass LIVE DENY', async () => {
    await withFlag('true', async () => {
      dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
      });
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [] });
          const res = mockRes();
          let next = false;
          await mw(req, res, () => { next = true; });
          assert.equal(next, false);
          assert.equal(res.statusCode, 403);
        },
      );
    });
  });

  it('7 Enterprise exception cannot block request', async () => {
    await withFlag('true', async () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const origEnt = parity.enterpriseStaffPermissionDecision;
      parity.enterpriseStaffPermissionDecision = () => { throw new Error('shadow boom'); };
      try {
        const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
        });
        assert.equal(out, null);
        await withTeacher(
          { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
          async () => {
            const mw = checkPermission(LIVE.MANAGE_HR);
            const req = actorReq({ permissions: [LIVE.MANAGE_HR] });
            const res = mockRes();
            let next = false;
            await mw(req, res, () => { next = true; });
            assert.equal(next, true);
          },
        );
      } finally {
        parity.enterpriseStaffPermissionDecision = origEnt;
      }
    });
  });

  it('8 Enterprise result never changes HTTP status', async () => {
    await withFlag('true', async () => {
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [] });
          const res = mockRes();
          await mw(req, res, () => {});
          assert.equal(res.statusCode, 403);
          assert.ok(!JSON.stringify(res.body).includes('enterpriseDecision'));
        },
      );
    });
  });

  it('9 Enterprise result never changes handler execution', async () => {
    await withFlag('true', async () => {
      let handlerRan = false;
      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [LIVE.MANAGE_HR] });
          const res = mockRes();
          await mw(req, res, () => { handlerRan = true; });
          assert.equal(handlerRan, true);
        },
      );
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [] });
          const res = mockRes();
          handlerRan = false;
          await mw(req, res, () => { handlerRan = true; });
          assert.equal(handlerRan, false);
        },
      );
    });
  });

  // ── Roles ──────────────────────────────────────────────────────────────
  it('10 SUPER_ADMIN', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        id: 'sa', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
      });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.SUPER_ADMIN);
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_TEACHERS,
      });
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('11 HIGH_ADMIN', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        role: 'admin', adminRole: 'HIGH_ADMIN', permissions: [LIVE.MANAGE_TEACHERS],
      });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.HIGH_ADMIN);
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_TEACHERS,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('12 STAFF', async () => {
    await withFlag('true', () => {
      const req = actorReq({ adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.ADMIN_STAFF);
      assert.equal(dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR,
      }).comparison, COMPARISON.MATCH);
    });
  });

  it('13 SUPPORT', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        role: 'staff', adminRole: 'SUPPORT', permissions: [LIVE.VIEW_TEACHERS],
      });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.SUPPORT_AGENT);
      assert.equal(dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.VIEW_TEACHERS,
      }).comparison, COMPARISON.MATCH);
    });
  });

  it('14 teacher', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        role: 'teacher', adminRole: null, permissions: [LIVE.MANAGE_HR],
      });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.TEACHER);
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('15 student', async () => {
    await withFlag('true', () => {
      const req = actorReq({ role: 'student', adminRole: null, permissions: [] });
      assert.equal(resolveRole(req.user).enterpriseRole, ROLES.STUDENT);
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_STUDENTS,
      });
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('16 JWT admin without adminRole is LEGACY_PRINCIPAL (permission eval, no role flatten)', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
      });
      const rr = resolveRole(req.user);
      assert.equal(rr.enterpriseRole, null);
      assert.equal(rr.type, 'LEGACY_PRINCIPAL');
      const ent = evaluateEnterpriseShadow(req.user, { livePermission: LIVE.MANAGE_HR });
      assert.equal(ent.decision, 'ALLOW');
      assert.equal(ent.legacyPrincipal, true);
      assert.equal(ent.enterpriseRole, null);
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.finalDecision, 'ALLOW');
      assert.notEqual(out.role, 'SUPER_ADMIN');
      assert.notEqual(out.role, 'ADMIN_STAFF');
    });
  });

  it('17 id=admin LEGACY_ROOT', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
      });
      assert.equal(resolveRole(req.user).type, 'LEGACY_ROOT');
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_FINANCE,
      });
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  // ── Scope ──────────────────────────────────────────────────────────────
  it('18 same branch', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR], userBranchId: 'B1' }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, scopeOk: true, branchClass: 'same_branch' },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.scope, 'same_branch');
    });
  });

  it('19 cross branch', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, scopeOk: false, branchClass: 'cross_branch' },
      );
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.finalDecision, 'DENY');
    });
  });

  it('20 null branch', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR], userBranchId: null }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, scopeOk: false, branchClass: 'null_branch' },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.enterpriseDecision, 'DENY');
    });
  });

  it('21 owner', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, ownershipOk: true, ownerClass: 'owner' },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('22 non-owner', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, ownershipOk: false },
      );
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.finalDecision, 'DENY');
    });
  });

  // ── Finance ────────────────────────────────────────────────────────────
  it('23 revenue-only', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_BRANCH_REVENUE] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.VIEW_BRANCH_REVENUE },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.deepEqual(out.enterprisePermissions, [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
      assert.ok(!out.enterprisePermissions.includes(ENT.FINANCE_VIEW));
    });
  });

  it('24 finance manager', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_FINANCE] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_FINANCE },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.ok(out.enterprisePermissions.includes(ENT.FINANCE_VIEW));
      assert.ok(out.enterprisePermissions.includes(ENT.FINANCE_PAYMENT_CREATE));
      assert.ok(out.enterprisePermissions.includes(ENT.FINANCE_REFUND_APPROVE));
    });
  });

  it('25 revenue cannot mutate', async () => {
    await withFlag('true', () => {
      const mutate = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_BRANCH_REVENUE] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_FINANCE },
      );
      assert.equal(mutate.liveDecision, 'DENY');
      assert.equal(mutate.enterpriseDecision, 'DENY');
      assert.equal(mutate.comparison, COMPARISON.MATCH);

      const shadowPay = evaluateEnterpriseShadow(
        { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.VIEW_BRANCH_REVENUE] },
        { livePermission: LIVE.VIEW_BRANCH_REVENUE, action: 'payment_create' },
      );
      assert.equal(shadowPay.decision, 'DENY');
    });
  });

  it('26 payment/refund boundaries', async () => {
    const held = expandLivePermissionsToEnterprise([LIVE.VIEW_BRANCH_REVENUE]);
    assert.ok(!held.has(ENT.FINANCE_PAYMENT_CREATE));
    assert.ok(!held.has(ENT.FINANCE_REFUND_APPROVE));
    const mgr = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
    assert.ok(mgr.has(ENT.FINANCE_PAYMENT_CREATE));
    assert.ok(mgr.has(ENT.FINANCE_REFUND_APPROVE));
  });

  it('27 finance:view cannot substitute revenue permission', async () => {
    assert.ok(!map.resolve('view_branch_revenue').includes(ENT.FINANCE_VIEW));
    assert.deepEqual(map.resolve('view_branch_revenue'), [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
    const mgrHeld = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
    assert.ok(mgrHeld.has(ENT.FINANCE_VIEW));
    assert.ok(!mgrHeld.has(ENT.FINANCE_BRANCH_REVENUE_VIEW));
  });

  // ── HR ─────────────────────────────────────────────────────────────────
  it('28 HR CRUD', async () => {
    await withFlag('true', () => {
      for (const action of ['list', 'stats', 'create', 'update', 'delete']) {
        const out = dualCheckLiveStaffGate(
          actorReq({ permissions: [LIVE.MANAGE_HR] }),
          { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, action, family: 'employees' },
        );
        assert.equal(out.comparison, COMPARISON.MATCH, action);
        assert.deepEqual(out.enterprisePermissions, [ENT.HR_MANAGE]);
      }
    });
  });

  it('29 payroll', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, action: 'pay' },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.enterpriseDecision, 'ALLOW');
    });
  });

  it('30 HR branch boundary', async () => {
    await withFlag('true', () => {
      const cross = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, scopeOk: false },
      );
      assert.equal(cross.enterpriseDecision, 'DENY');
      assert.equal(cross.comparison, COMPARISON.MATCH);
    });
  });

  it('31 user:manage does not substitute HR', async () => {
    const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_STAFF]);
    assert.ok(held.has(ENT.USER_MANAGE));
    assert.ok(!held.has(ENT.HR_MANAGE));
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_STAFF] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR },
      );
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  // ── Teacher ────────────────────────────────────────────────────────────
  it('32 view', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_TEACHERS] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.VIEW_TEACHERS, action: 'stats' },
      );
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.deepEqual(out.enterprisePermissions, [ENT.TEACHER_VIEW]);
    });
  });

  it('33 manage', async () => {
    await withFlag('true', () => {
      for (const action of ['score', 'approve', 'reject']) {
        const out = dualCheckLiveStaffGate(
          actorReq({ permissions: [LIVE.MANAGE_TEACHERS] }),
          { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_TEACHERS, action },
        );
        assert.equal(out.comparison, COMPARISON.MATCH, action);
      }
    });
  });

  it('34 VIEW ≠ MANAGE', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_TEACHERS] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_TEACHERS, action: 'approve' },
      );
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('35 update/assign do not silently substitute manage', async () => {
    const held = expandLivePermissionsToEnterprise([LIVE.VIEW_TEACHERS]);
    assert.ok(held.has(ENT.TEACHER_VIEW));
    assert.ok(!held.has(ENT.TEACHER_MANAGE));
    assert.ok(!held.has(ENT.TEACHER_UPDATE));
    assert.ok(!held.has(ENT.TEACHER_ASSIGN));
    await withFlag('true', () => {
      const create = evaluateEnterpriseShadow(
        { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_TEACHERS] },
        { livePermission: LIVE.MANAGE_TEACHERS, action: 'create' },
      );
      assert.equal(create.decision, 'DENY');
      assert.equal(create.reason, 'action_requires_super');
    });
  });

  // ── Student training ───────────────────────────────────────────────────
  it('36 student_training only', async () => {
    await withFlag('true', () => {
      const a = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_STUDENT_TRAINING] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_STUDENT_TRAINING },
      );
      assert.equal(a.comparison, COMPARISON.MATCH);
      const tr = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_STUDENT_TRAINING] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_TRAINING },
      );
      assert.equal(tr.comparison, COMPARISON.MATCH);
      assert.equal(tr.enterpriseDecision, 'DENY');
    });
  });

  it('37 training only', async () => {
    await withFlag('true', () => {
      const tr = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_TRAINING] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_TRAINING },
      );
      assert.equal(tr.comparison, COMPARISON.MATCH);
      const st = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_TRAINING] }),
        { liveDecision: 'DENY', livePermission: LIVE.MANAGE_STUDENT_TRAINING },
      );
      assert.equal(st.enterpriseDecision, 'DENY');
      assert.equal(st.comparison, COMPARISON.MATCH);
    });
  });

  it('38 both', async () => {
    await withFlag('true', () => {
      const perms = [LIVE.MANAGE_TRAINING, LIVE.MANAGE_STUDENT_TRAINING];
      assert.equal(dualCheckLiveStaffGate(actorReq({ permissions: perms }), {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_TRAINING,
      }).comparison, COMPARISON.MATCH);
      assert.equal(dualCheckLiveStaffGate(actorReq({ permissions: perms }), {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_STUDENT_TRAINING,
      }).comparison, COMPARISON.MATCH);
    });
  });

  it('39 neither', async () => {
    await withFlag('true', () => {
      const req = actorReq({ permissions: [LIVE.VIEW_TEACHERS] });
      assert.equal(dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_TRAINING,
      }).comparison, COMPARISON.MATCH);
      assert.equal(dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_STUDENT_TRAINING,
      }).comparison, COMPARISON.MATCH);
    });
  });

  it('40 no privilege widening', async () => {
    assert.notDeepEqual(map.resolve('manage_training'), map.resolve('manage_student_training'));
    const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_TRAINING]);
    assert.ok(held.has(ENT.COURSE_UPDATE));
    assert.ok(!held.has(ENT.STUDENT_TRAINING_MANAGE));
  });

  // ── Unsupported ────────────────────────────────────────────────────────
  it('41 schedule unsupported', async () => {
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_SCHEDULE] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_SCHEDULE },
      );
      assert.equal(out.comparison, COMPARISON.UNSUPPORTED);
      assert.equal(out.finalDecision, 'ALLOW');
    });
  });

  it('42 messages unsupported', async () => {
    await withFlag('true', () => {
      assert.equal(dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_MESSAGES] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_MESSAGES },
      ).comparison, COMPARISON.UNSUPPORTED);
    });
  });

  it('43 logs unsupported', async () => {
    await withFlag('true', () => {
      assert.equal(dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_LOGS] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.VIEW_LOGS },
      ).comparison, COMPARISON.UNSUPPORTED);
    });
  });

  it('44 evaluations unsupported', async () => {
    await withFlag('true', () => {
      assert.equal(dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_EVALUATIONS] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.VIEW_EVALUATIONS },
      ).comparison, COMPARISON.UNSUPPORTED);
    });
  });

  // ── Wildcard / spoof ───────────────────────────────────────────────────
  it('45 Enterprise ALL cannot activate Cutover wildcard', async () => {
    assert.equal(normalizeFamily('*'), null);
    assert.equal(normalizeFamily('ALL'), null);
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ id: 'sa', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] }),
        { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_FINANCE },
      );
      assert.ok(out.enterprisePermissions.includes(ENT.ALL));
      assert.equal(normalizeFamily('ALL'), null);
    });
  });

  it('46 body role spoof', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        permissions: [LIVE.VIEW_TEACHERS],
        body: { role: 'admin', adminRole: 'SUPER_ADMIN' },
      });
      const actor = buildTrustedActor(req);
      assert.equal(actor.role, 'staff');
      assert.equal(actor.adminRole, 'STAFF');
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_TEACHERS,
      });
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('47 query permission spoof', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        permissions: [LIVE.VIEW_TEACHERS],
        query: { permissions: LIVE.MANAGE_FINANCE },
      });
      assert.deepEqual(buildTrustedActor(req).permissions, [LIVE.VIEW_TEACHERS]);
      assert.equal(dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_FINANCE,
      }).enterpriseDecision, 'DENY');
    });
  });

  it('48 body branch spoof', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        permissions: [LIVE.MANAGE_HR],
        body: { branchId: 'spoof-other-branch' },
      });
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, scopeOk: false,
      });
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('49 query branch spoof', async () => {
    await withFlag('true', () => {
      const req = actorReq({
        permissions: [LIVE.MANAGE_HR],
        query: { branchId: 'spoof-q' },
      });
      const out = dualCheckLiveStaffGate(req, {
        liveDecision: 'DENY', livePermission: LIVE.MANAGE_HR, scopeOk: false,
      });
      assert.equal(out.finalDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('flag default OFF; independent enterpriseDecision', async () => {
    resetParityMetricsForTests();
    await withFlag(null, () => {
      assert.equal(isRbacDualCheckEnabled(), false);
      assert.equal(dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR,
      }), null);
    });
    await withFlag('true', () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [] }), {
        liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR,
      });
      // Must NOT derive enterpriseDecision from liveDecision
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.ok(getParityMetricsSnapshot().rbac_dualcheck_total >= 1);
      assert.ok(getParityMetricsSnapshot().rbac_dualcheck_mismatch_total >= 1);
    });
  });

  it('static: dual-check after LIVE; next gated by ok only', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
    assert.ok(auth.includes('dualCheckLiveStaffGate'));
    const dc = auth.indexOf('dualCheckLiveStaffGate');
    const next = auth.indexOf('if (ok) next()', dc);
    assert.ok(dc > 0 && next > dc);
    assert.ok(!auth.includes('enterpriseDecision ==='));
  });

  it('mismatch reasons enumerated', () => {
    assert.equal(MISMATCH_REASON.PERMISSION_MISMATCH, 'PERMISSION_MISMATCH');
    assert.equal(MISMATCH_REASON.SCOPE_MISMATCH, 'SCOPE_MISMATCH');
    assert.equal(MISMATCH_REASON.ROLE_MISMATCH, 'ROLE_MISMATCH');
  });
});
