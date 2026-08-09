/**
 * Phase 8.11 — Dual-read observation (Enterprise OBSERVER ONLY).
 * LIVE remains the sole authorization authority.
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
const {
  COMPARISON,
  compareStaffLivePermission,
  expandLivePermissionsToEnterprise,
  isRbacParityObserveEnabled,
  observeLiveStaffGate,
  buildTrustedActor,
  getParityMetricsSnapshot,
  resetParityMetricsForTests,
} = require('../../services/rbacParity');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

function staffReq(extra = {}) {
  return {
    user: {
      id: '507f1f77bcf86cd799439011',
      role: 'staff',
      adminRole: 'STAFF',
      permissions: extra.permissions || [],
    },
    body: extra.body || {},
    query: extra.query || {},
    requestId: 'req-811',
    correlationId: 'cor-811',
    path: '/api/test',
    route: { path: '/api/test' },
  };
}

function withTeacher(doc, fn) {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => doc };
    },
  });
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Teacher.findById = orig;
    });
}

async function withFlag(value, fn) {
  const prev = process.env.RBAC_PARITY_OBSERVE_ENABLED;
  if (value === undefined || value === null) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
  else process.env.RBAC_PARITY_OBSERVE_ENABLED = String(value);
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    else process.env.RBAC_PARITY_OBSERVE_ENABLED = prev;
  }
}

describe('Phase 8.11 dual-read observation', { concurrency: false }, () => {
  it('Phase8.11 A: feature OFF — observer skipped; LIVE auth unchanged', async () => {
    resetParityMetricsForTests();
    await withFlag('false', async () => {
      assert.equal(isRbacParityObserveEnabled(), false);
      const before = getParityMetricsSnapshot();
      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = staffReq({ permissions: [LIVE.MANAGE_HR] });
          const res = mockRes();
          let next = false;
          await mw(req, res, () => {
            next = true;
          });
          assert.equal(next, true);
          assert.equal(res.statusCode, 200);
          assert.equal(res.body, null);
        },
      );
      const after = getParityMetricsSnapshot();
      assert.deepEqual(after, before);
    });
  });

  it('Phase8.11 B: feature ON — observer runs; LIVE remains authoritative ALLOW', async () => {
    resetParityMetricsForTests();
    await withFlag('true', async () => {
      assert.equal(isRbacParityObserveEnabled(), true);
      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = staffReq({ permissions: [LIVE.MANAGE_HR] });
          const res = mockRes();
          let next = false;
          await mw(req, res, () => {
            next = true;
          });
          assert.equal(next, true);
          assert.equal(res.statusCode, 200);
          assert.ok(!res.body || !res.body.comparison);
          const observed = observeLiveStaffGate(req, {
            liveDecision: 'ALLOW',
            livePermission: LIVE.MANAGE_HR,
          });
          assert.equal(observed.comparison, COMPARISON.MATCH);
          assert.ok(getParityMetricsSnapshot().rbac_parity_match_total >= 1);
        },
      );
    });
  });

  it('Phase8.11 C: LIVE ALLOW / Enterprise ALLOW → MATCH', async () => {
    resetParityMetricsForTests();
    await withFlag('true', () => {
      const req = staffReq({ permissions: [LIVE.MANAGE_HR] });
      const out = observeLiveStaffGate(req, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        family: 'employees',
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.scopeResult, 'live_authoritative');
    });
  });

  it('Phase8.11 D: LIVE DENY / Enterprise DENY → MATCH', async () => {
    await withFlag('true', () => {
      const req = staffReq({ permissions: [LIVE.VIEW_TEACHERS] });
      const out = observeLiveStaffGate(req, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.liveDecision, 'DENY');
      assert.equal(out.enterpriseDecision, 'DENY');
    });
  });

  it('Phase8.11 E: LIVE ALLOW / Enterprise DENY → MISMATCH; request stays ALLOW', async () => {
    resetParityMetricsForTests();
    await withFlag('true', async () => {
      const req = staffReq({ permissions: [] });
      const out = observeLiveStaffGate(req, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MISMATCH);
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'DENY');

      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const r = staffReq({ permissions: [LIVE.MANAGE_HR] });
          const res = mockRes();
          let next = false;
          await mw(r, res, () => {
            next = true;
          });
          assert.equal(next, true, 'LIVE ALLOW must proceed regardless of any prior mismatch sample');
          assert.equal(res.statusCode, 200);
        },
      );
    });
  });

  it('Phase8.11 F: LIVE DENY / Enterprise ALLOW → MISMATCH; request stays DENY', async () => {
    await withFlag('true', async () => {
      const req = staffReq({ permissions: [LIVE.MANAGE_HR] });
      const out = observeLiveStaffGate(req, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MISMATCH);
      assert.equal(out.liveDecision, 'DENY');
      assert.equal(out.enterpriseDecision, 'ALLOW');

      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const r = staffReq({ permissions: [] });
          const res = mockRes();
          let next = false;
          await mw(r, res, () => {
            next = true;
          });
          assert.equal(next, false);
          assert.equal(res.statusCode, 403);
          assert.ok(!JSON.stringify(res.body || {}).includes('MISMATCH'));
          assert.ok(!JSON.stringify(res.body || {}).includes('enterpriseDecision'));
        },
      );
    });
  });

  it('Phase8.11 G: observer throws — LIVE result still applied', async () => {
    await withFlag('true', async () => {
      const parityCompare = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parityCompare.compareStaffLivePermission;
      parityCompare.compareStaffLivePermission = () => {
        throw new Error('observer boom');
      };
      try {
        const req = staffReq({ permissions: [LIVE.MANAGE_HR] });
        const out = observeLiveStaffGate(req, {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
        });
        assert.equal(out, null);

        await withTeacher(
          { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
          async () => {
            const mw = checkPermission(LIVE.MANAGE_HR);
            const r = staffReq({ permissions: [LIVE.MANAGE_HR] });
            const res = mockRes();
            let next = false;
            await mw(r, res, () => {
              next = true;
            });
            assert.equal(next, true);
            assert.equal(res.statusCode, 200);
          },
        );
      } finally {
        parityCompare.compareStaffLivePermission = orig;
      }
    });
  });

  it('Phase8.11 H: finance revenue ≠ finance:view; manage remains bundle', async () => {
    await withFlag('true', () => {
      const rev = observeLiveStaffGate(staffReq({ permissions: [LIVE.VIEW_BRANCH_REVENUE] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.VIEW_BRANCH_REVENUE,
      });
      assert.equal(rev.comparison, COMPARISON.MATCH);
      assert.deepEqual(rev.enterprisePermission, [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
      assert.ok(!rev.enterprisePermission.includes(ENT.FINANCE_VIEW));

      const mgrDeny = observeLiveStaffGate(staffReq({ permissions: [LIVE.VIEW_BRANCH_REVENUE] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_FINANCE,
      });
      assert.equal(mgrDeny.liveDecision, 'DENY');
      assert.equal(mgrDeny.comparison, COMPARISON.MATCH);

      const held = expandLivePermissionsToEnterprise([LIVE.VIEW_BRANCH_REVENUE]);
      assert.ok(!held.has(ENT.FINANCE_VIEW));
      assert.ok(!held.has(ENT.FINANCE_PAYMENT_CREATE));
    });
  });

  it('Phase8.11 I: HR hr:manage separate from user:manage', async () => {
    await withFlag('true', () => {
      const out = observeLiveStaffGate(staffReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.deepEqual(out.enterprisePermission, [ENT.HR_MANAGE]);
      assert.ok(!out.enterprisePermission.includes(ENT.USER_MANAGE));
      const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_HR]);
      assert.ok(!held.has(ENT.USER_MANAGE));
      assert.ok(!held.has(ENT.FINANCE_VIEW));
    });
  });

  it('Phase8.11 J: teachers view/manage separation', async () => {
    await withFlag('true', () => {
      const view = observeLiveStaffGate(staffReq({ permissions: [LIVE.VIEW_TEACHERS] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.VIEW_TEACHERS,
      });
      assert.equal(view.comparison, COMPARISON.MATCH);
      assert.deepEqual(view.enterprisePermission, [ENT.TEACHER_VIEW]);

      const manageDeny = observeLiveStaffGate(staffReq({ permissions: [LIVE.VIEW_TEACHERS] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_TEACHERS,
      });
      assert.equal(manageDeny.comparison, COMPARISON.MATCH);
      assert.equal(manageDeny.liveDecision, 'DENY');
    });
  });

  it('Phase8.11 K: student_training distinct from manage_training', async () => {
    await withFlag('true', () => {
      const st = observeLiveStaffGate(staffReq({ permissions: [LIVE.MANAGE_STUDENT_TRAINING] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_STUDENT_TRAINING,
      });
      assert.equal(st.comparison, COMPARISON.MATCH);
      assert.deepEqual(st.enterprisePermission, [ENT.STUDENT_TRAINING_MANAGE]);

      const cross = observeLiveStaffGate(staffReq({ permissions: [LIVE.MANAGE_TRAINING] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_STUDENT_TRAINING,
      });
      assert.equal(cross.comparison, COMPARISON.MATCH);
      assert.equal(cross.liveDecision, 'DENY');
      assert.notDeepEqual(map.resolve('manage_training'), map.resolve('manage_student_training'));
    });
  });

  it('Phase8.11 L: legacy-only → UNSUPPORTED; LIVE unchanged', async () => {
    await withFlag('true', async () => {
      const out = observeLiveStaffGate(staffReq({ permissions: [LIVE.MANAGE_SCHEDULE] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_SCHEDULE,
      });
      assert.equal(out.comparison, COMPARISON.UNSUPPORTED);
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, null);

      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_SCHEDULE], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_SCHEDULE);
          const req = staffReq({ permissions: [LIVE.MANAGE_SCHEDULE] });
          const res = mockRes();
          let next = false;
          await mw(req, res, () => {
            next = true;
          });
          assert.equal(next, true);
          assert.ok(!JSON.stringify(res.body || {}).includes('UNSUPPORTED'));
        },
      );
    });
  });

  it('Phase8.11 M: Enterprise ALL does not authorize Cutover wildcard', async () => {
    assert.equal(normalizeFamily('*'), null);
    assert.equal(normalizeFamily('ALL'), null);
    const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
    assert.ok(!held.has(ENT.ALL));
    const superReq = {
      user: { id: 'sa', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [] },
    };
    await withFlag('true', () => {
      const out = observeLiveStaffGate(superReq, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_FINANCE,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.ok(out.enterprisePermission.includes(ENT.ALL));
      assert.equal(normalizeFamily('ALL'), null);
    });
  });

  it('Phase8.11 N: client spoof body/query cannot affect observer', async () => {
    await withFlag('true', () => {
      const req = staffReq({
        permissions: [LIVE.VIEW_TEACHERS],
        body: {
          role: 'admin',
          adminRole: 'SUPER_ADMIN',
          permissions: [LIVE.MANAGE_TEACHERS, LIVE.MANAGE_FINANCE],
          branchId: 'spoof-branch',
        },
        query: { role: 'admin', permissions: LIVE.MANAGE_TEACHERS },
      });
      const actor = buildTrustedActor(req);
      assert.deepEqual(actor.permissions, [LIVE.VIEW_TEACHERS]);
      assert.equal(actor.role, 'staff');
      assert.equal(actor.adminRole, 'STAFF');

      const out = observeLiveStaffGate(req, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_TEACHERS,
      });
      assert.equal(out.liveDecision, 'DENY');
      assert.equal(out.enterpriseDecision, 'DENY');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('Phase8.11 O: no response mutation — comparison not on client body', async () => {
    await withFlag('true', async () => {
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = staffReq({
            permissions: [],
            body: { wantEnterprise: true },
          });
          const res = mockRes();
          await mw(req, res, () => {});
          assert.equal(res.statusCode, 403);
          const s = JSON.stringify(res.body);
          assert.ok(!s.includes('RBAC_PARITY'));
          assert.ok(!s.includes('enterpriseDecision'));
          assert.ok(!s.includes('comparison'));
          assert.ok(!s.includes('MATCH'));
        },
      );
    });
  });

  it('Phase8.11 runtime authority: finalDecision always LIVE in comparator', () => {
    const cases = [
      compareStaffLivePermission(
        { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] },
        LIVE.MANAGE_HR,
      ),
      compareStaffLivePermission(
        { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [] },
        LIVE.MANAGE_HR,
      ),
    ];
    for (const r of cases) {
      assert.equal(r.finalDecision, r.live.decision);
    }
  });

  it('Phase8.11 flag default OFF when unset', async () => {
    await withFlag(null, () => {
      assert.equal(isRbacParityObserveEnabled(), false);
    });
  });

  it('Phase8.11 static: observe after LIVE; next gated by ok only', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
    assert.ok(auth.includes('observeLiveStaffGate'));
    assert.ok(
      auth.includes("liveDecision: ok ? 'ALLOW' : 'DENY'")
        || auth.includes('liveDecision: ok ? "ALLOW" : "DENY"'),
    );
    const observeIdx = auth.indexOf('observeLiveStaffGate');
    const nextIdx = auth.indexOf('if (ok) next()', observeIdx);
    assert.ok(observeIdx > 0 && nextIdx > observeIdx);
    assert.ok(!auth.includes('enterpriseDecision ===') && !auth.includes('comparison ==='));
  });
});
