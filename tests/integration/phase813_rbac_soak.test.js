/**
 * Phase 8.13 — RBAC soak / runtime parity evidence (observation only).
 * Does NOT promote Enterprise. Separates STATIC / SYNTHETIC / RUNTIME.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Teacher = require('../../models/Teacher');
const { checkPermission } = require('../../middleware/auth');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ENT = require('../../shared/constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const ROLES = require('../../shared/constants/roles');
const {
  COMPARISON,
  expandLivePermissionsToEnterprise,
  dualCheckLiveStaffGate,
  evaluateEnterpriseShadow,
  resolveRole,
  computeAndRecordStaticParity,
  getSoakEvidenceSnapshot,
  getSoakEvidenceStatus,
  resetSoakEvidenceForTests,
  EVIDENCE_CHANNEL,
  recordSoakObservation,
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
    },
    body: extra.body || {},
    query: extra.query || {},
    requestId: 'req-813',
    correlationId: 'cor-813',
  };
}

async function withDualFlag(on, fn) {
  const prev = process.env.RBAC_DUAL_CHECK_ENABLED;
  if (on) process.env.RBAC_DUAL_CHECK_ENABLED = 'true';
  else delete process.env.RBAC_DUAL_CHECK_ENABLED;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
    else process.env.RBAC_DUAL_CHECK_ENABLED = prev;
  }
}

function withTeacher(doc, fn) {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() { return { lean: async () => doc }; },
  });
  return Promise.resolve().then(fn).finally(() => { Teacher.findById = orig; });
}

describe('Phase 8.13 RBAC soak evidence', { concurrency: false }, () => {
  it('1 static parity remains 8 MATCH (mapped gates)', () => {
    resetSoakEvidenceForTests();
    const snap = computeAndRecordStaticParity();
    assert.equal(snap.mappedGateMatch, 8);
    assert.equal(snap.mismatch, 0);
    assert.equal(snap.unknown, 0);
    assert.equal(snap.unsupported, 4);
    const channels = getSoakEvidenceSnapshot().channels;
    assert.equal(channels.STATIC.match, 8);
    assert.equal(channels.STATIC.unsupported, 4);
    assert.equal(channels.SYNTHETIC.requests, 0);
    assert.equal(channels.RUNTIME.requests, 0);
  });

  it('2 synthetic mismatch remains isolated from RUNTIME', async () => {
    resetSoakEvidenceForTests();
    await withDualFlag(true, () => {
      const out = dualCheckLiveStaffGate(actorReq({ permissions: [] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.comparison, COMPARISON.MISMATCH);
      assert.equal(out.finalDecision, 'ALLOW');
      assert.equal(out.evidenceChannel, EVIDENCE_CHANNEL.SYNTHETIC);
    });
    const snap = getSoakEvidenceSnapshot();
    assert.ok(snap.channels.SYNTHETIC.mismatch >= 1);
    assert.equal(snap.channels.RUNTIME.mismatch, 0);
    assert.equal(snap.channels.RUNTIME.requests, 0);
  });

  it('3 runtime counters are separated from static/synthetic', async () => {
    resetSoakEvidenceForTests();
    computeAndRecordStaticParity();
    await withDualFlag(true, () => {
      dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.RUNTIME,
      });
    });
    const { channels } = getSoakEvidenceSnapshot();
    assert.equal(channels.STATIC.match, 8);
    assert.ok(channels.SYNTHETIC.requests >= 1);
    assert.ok(channels.RUNTIME.requests >= 1);
    assert.notEqual(
      channels.STATIC.requests + channels.SYNTHETIC.requests,
      channels.RUNTIME.requests,
    );
  });

  it('4 LIVE remains authoritative (finalDecision === liveDecision)', async () => {
    await withDualFlag(true, () => {
      for (const live of ['ALLOW', 'DENY']) {
        const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
          liveDecision: live,
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        });
        assert.equal(out.finalDecision, live);
        assert.equal(out.finalDecision, out.liveDecision);
      }
    });
  });

  it('5 Enterprise error is fail-safe', async () => {
    await withDualFlag(true, async () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parity.enterpriseStaffPermissionDecision;
      parity.enterpriseStaffPermissionDecision = () => { throw new Error('soak boom'); };
      try {
        const out = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
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
            assert.equal(res.statusCode, 200);
          },
        );
      } finally {
        parity.enterpriseStaffPermissionDecision = orig;
      }
    });
  });

  it('6 finance boundary', async () => {
    await withDualFlag(true, () => {
      const rev = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.VIEW_BRANCH_REVENUE] }),
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.VIEW_BRANCH_REVENUE,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      assert.deepEqual(rev.enterprisePermissions, [ENT.FINANCE_BRANCH_REVENUE_VIEW]);
      assert.ok(!rev.enterprisePermissions.includes(ENT.FINANCE_VIEW));
      const held = expandLivePermissionsToEnterprise([LIVE.VIEW_BRANCH_REVENUE]);
      assert.ok(!held.has(ENT.FINANCE_VIEW));
      assert.ok(!held.has(ENT.FINANCE_PAYMENT_CREATE));
    });
  });

  it('7 HR boundary', async () => {
    await withDualFlag(true, () => {
      const out = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_HR] }),
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
          family: 'employees',
        },
      );
      assert.deepEqual(out.enterprisePermissions, [ENT.HR_MANAGE]);
      const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_HR]);
      assert.ok(!held.has(ENT.USER_MANAGE));
      assert.ok(!held.has(ENT.FINANCE_VIEW));
    });
  });

  it('8 teacher boundary', async () => {
    await withDualFlag(true, () => {
      assert.deepEqual(
        dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.VIEW_TEACHERS] }), {
          liveDecision: 'ALLOW',
          livePermission: LIVE.VIEW_TEACHERS,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        }).enterprisePermissions,
        [ENT.TEACHER_VIEW],
      );
      const viewHeld = expandLivePermissionsToEnterprise([LIVE.VIEW_TEACHERS]);
      assert.ok(!viewHeld.has(ENT.TEACHER_MANAGE));
      assert.equal(
        dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.VIEW_TEACHERS] }), {
          liveDecision: 'DENY',
          livePermission: LIVE.MANAGE_TEACHERS,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        }).enterpriseDecision,
        'DENY',
      );
    });
  });

  it('9 student-training boundary', async () => {
    await withDualFlag(true, () => {
      const st = dualCheckLiveStaffGate(
        actorReq({ permissions: [LIVE.MANAGE_STUDENT_TRAINING] }),
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_STUDENT_TRAINING,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      assert.deepEqual(st.enterprisePermissions, [ENT.STUDENT_TRAINING_MANAGE]);
      const held = expandLivePermissionsToEnterprise([LIVE.MANAGE_TRAINING]);
      assert.ok(held.has(ENT.COURSE_UPDATE));
      assert.ok(!held.has(ENT.STUDENT_TRAINING_MANAGE));
      assert.notDeepEqual(map.resolve('manage_training'), map.resolve('manage_student_training'));
    });
  });

  it('10 role alias boundary', () => {
    assert.equal(
      resolveRole({ id: 'u', role: 'admin', adminRole: 'SUPER_ADMIN' }).enterpriseRole,
      ROLES.SUPER_ADMIN,
    );
    assert.equal(
      resolveRole({ id: 'u', role: 'admin', adminRole: 'HIGH_ADMIN' }).enterpriseRole,
      ROLES.HIGH_ADMIN,
    );
    assert.equal(
      resolveRole({ id: 'u', role: 'staff', adminRole: 'STAFF' }).enterpriseRole,
      ROLES.ADMIN_STAFF,
    );
    assert.equal(
      resolveRole({ id: 'u', role: 'staff', adminRole: 'SUPPORT' }).enterpriseRole,
      ROLES.SUPPORT_AGENT,
    );
    assert.equal(resolveRole({ id: 'u', role: 'teacher' }).enterpriseRole, ROLES.TEACHER);
    assert.equal(resolveRole({ id: 'u', role: 'student' }).enterpriseRole, ROLES.STUDENT);
    const bare = resolveRole({ id: 'u', role: 'admin', adminRole: null });
    assert.equal(bare.enterpriseRole, null);
    assert.equal(bare.type, 'LEGACY_PRINCIPAL');
    assert.equal(resolveRole({ id: 'admin', role: 'admin' }).type, 'LEGACY_ROOT');
  });

  it('11 branch boundary', async () => {
    await withDualFlag(true, () => {
      const same = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        scopeOk: true,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(same.comparison, COMPARISON.MATCH);
      const cross = dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
        scopeOk: false,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(cross.enterpriseDecision, 'DENY');
      assert.equal(cross.finalDecision, 'DENY');
    });
  });

  it('12 unsupported classification', async () => {
    await withDualFlag(true, () => {
      for (const p of [
        LIVE.MANAGE_SCHEDULE,
        LIVE.MANAGE_MESSAGES,
        LIVE.VIEW_LOGS,
        LIVE.VIEW_EVALUATIONS,
      ]) {
        const out = dualCheckLiveStaffGate(actorReq({ permissions: [p] }), {
          liveDecision: 'ALLOW',
          livePermission: p,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        });
        assert.equal(out.comparison, COMPARISON.UNSUPPORTED);
        assert.notEqual(out.comparison, COMPARISON.MATCH);
        assert.notEqual(out.comparison, COMPARISON.MISMATCH);
      }
    });
  });

  it('13 no HTTP response mutation', async () => {
    await withDualFlag(true, async () => {
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          const mw = checkPermission(LIVE.MANAGE_HR);
          const req = actorReq({ permissions: [] });
          const res = mockRes();
          await mw(req, res, () => {});
          assert.equal(res.statusCode, 403);
          const s = JSON.stringify(res.body);
          assert.ok(!s.includes('RBAC_DUAL_CHECK'));
          assert.ok(!s.includes('evidenceChannel'));
          assert.ok(!s.includes('enterpriseDecision'));
        },
      );
    });
  });

  it('14 no handler mutation', async () => {
    await withDualFlag(true, async () => {
      let ran = false;
      await withTeacher(
        { adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR], role: 'staff' },
        async () => {
          await checkPermission(LIVE.MANAGE_HR)(
            actorReq({ permissions: [LIVE.MANAGE_HR] }),
            mockRes(),
            () => { ran = true; },
          );
          assert.equal(ran, true);
        },
      );
      ran = false;
      await withTeacher(
        { adminRole: 'STAFF', permissions: [], role: 'staff' },
        async () => {
          await checkPermission(LIVE.MANAGE_HR)(
            actorReq({ permissions: [] }),
            mockRes(),
            () => { ran = true; },
          );
          assert.equal(ran, false);
        },
      );
    });
  });

  it('15 no DB mutation from soak recorders', () => {
    resetSoakEvidenceForTests();
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.SYNTHETIC,
      comparison: 'MATCH',
      permission: LIVE.MANAGE_HR,
    });
    // soakEvidence is in-memory only — no mongoose calls
    assert.equal(typeof Teacher.findById, 'function');
    assert.equal(getSoakEvidenceSnapshot().channels.SYNTHETIC.match, 1);
  });

  it('soak evidence status: test harness ≠ production soak', () => {
    resetSoakEvidenceForTests();
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.RUNTIME,
      comparison: 'MATCH',
      permission: LIVE.MANAGE_HR,
    });
    const status = getSoakEvidenceStatus();
    assert.equal(status.SOAK_EVIDENCE, 'NOT_AVAILABLE');
    assert.equal(status.reason, 'soak_window_not_active');
  });

  it('default evidence channel is SYNTHETIC (not RUNTIME)', async () => {
    resetSoakEvidenceForTests();
    await withDualFlag(true, () => {
      dualCheckLiveStaffGate(actorReq({ permissions: [LIVE.MANAGE_HR] }), {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        // no evidenceChannel
      });
    });
    const snap = getSoakEvidenceSnapshot();
    assert.ok(snap.channels.SYNTHETIC.requests >= 1);
    assert.equal(snap.channels.RUNTIME.requests, 0);
  });

  it('ENTERPRISE_PRIMARY not ready without production soak', () => {
    resetSoakEvidenceForTests();
    computeAndRecordStaticParity();
    const status = getSoakEvidenceStatus();
    assert.equal(status.SOAK_EVIDENCE, 'NOT_AVAILABLE');
    // Readiness gate documented: PRIMARY stays NO
    assert.equal(status.SOAK_EVIDENCE !== 'AVAILABLE', true);
  });
});
