/**
 * Phase 8.20C — Live RUNTIME evidence export (read-only / shadow-only).
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const {
  buildLiveRuntimeEvidenceExport,
  snapshotRuntimeEvidence,
  deltaRuntimeEvidence,
  emptySoakBaseline,
  resolveMultiProcessStatus,
  recordSoakObservation,
  resetSoakEvidenceForTests,
  resetParityMetricsForTests,
  EVIDENCE_CHANNEL,
  PRODUCTION_SOAK_EVIDENCE,
  SAFETY,
  incrementParityMetric,
  incrementDualCheckMetric,
} = require('../../services/rbacParity');
const {
  requireLoopbackInternal,
  isLoopbackAddress,
} = require('../../middleware/requireLoopbackInternal');
const internalRbacRoutes = require('../../routes/internalRbacRoutes');

function envStagingFlags() {
  return {
    RBAC_SOAK_ENVIRONMENT: 'STAGING',
    RBAC_PARITY_OBSERVE_ENABLED: 'true',
    RBAC_DUAL_CHECK_ENABLED: 'true',
    RBAC_SOAK_WINDOW_ACTIVE: 'true',
    instances: '1',
    exec_mode: 'fork_mode',
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function getJson(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({
      host: '127.0.0.1',
      port,
      path: pathname,
      headers,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch { parsed = body; }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    }).on('error', reject);
  });
}

describe('Phase 8.20C runtime evidence export', { concurrency: false }, () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    resetSoakEvidenceForTests();
    resetParityMetricsForTests();
    Object.assign(process.env, envStagingFlags());
    delete process.env.RBAC_RUNTIME_EVIDENCE_TOKEN;
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in prevEnv)) delete process.env[k];
    }
    Object.assign(process.env, prevEnv);
    resetSoakEvidenceForTests();
    resetParityMetricsForTests();
  });

  it('1 snapshot/delta aliases reuse soakEvidence', () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    const snap = snapshotRuntimeEvidence();
    assert.equal(snap.runtime.requests, 1);
    const d = deltaRuntimeEvidence(emptySoakBaseline(), snap);
    assert.equal(d.requests, 1);
    assert.equal(d.match, 1);
  });

  it('2 zero traffic → NOT_AVAILABLE', () => {
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.PRODUCTION_SOAK_EVIDENCE, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(exp.runtime.requests, 0);
    assert.equal(exp.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.ok(exp.blockers.includes('zero_runtime_events'));
  });

  it('3 runtime traffic increases counters', () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    incrementParityMetric('MATCH');
    incrementParityMetric('MATCH');
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.runtime.requests, 2);
    assert.equal(exp.runtime.match, 2);
    assert.equal(exp.PRODUCTION_SOAK_EVIDENCE, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(exp.evidenceChannel, EVIDENCE_CHANNEL.RUNTIME);
  });

  it('4 mismatch stays mismatch (never coerced to MATCH)', () => {
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.RUNTIME,
      comparison: 'MISMATCH',
      liveDecision: 'DENY',
      enterpriseDecision: 'ALLOW',
      mismatchReason: 'ROLE_MISMATCH',
      role: 'TEACHER',
      permission: 'manage_finance',
    });
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.runtime.mismatch, 1);
    assert.equal(exp.runtime.match, 0);
    assert.notEqual(exp.runtime.mismatch, exp.runtime.match);
  });

  it('5 observer error not counted as MATCH', () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'ERROR' });
    incrementParityMetric('ERROR');
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.runtime.errors, 1);
    assert.equal(exp.runtime.match, 0);
    assert.ok(exp.runtime.observerErrors >= 1);
  });

  it('6 finalDecision invariant PASS + Enterprise SHADOW', () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.finalDecisionInvariant, SAFETY.PASS);
    assert.equal(exp.liveRemainsPrimary, true);
    assert.equal(exp.enterpriseIsShadowOnly, true);
    assert.equal(exp.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.equal(exp.safety.authorizeNotMounted, true);
  });

  it('7 export does not include secrets/PII keys', () => {
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.RUNTIME,
      comparison: 'MISMATCH',
      liveDecision: 'ALLOW',
      enterpriseDecision: 'DENY',
      mismatchReason: 'PERMISSION_MISMATCH',
      permission: 'view_teachers',
      role: 'ADMIN_STAFF',
    });
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    const json = JSON.stringify(exp);
    assert.equal(json.includes('"password"'), false);
    assert.equal(json.includes('"jwt"'), false);
    assert.equal(json.includes('Authorization'), false);
    assert.ok(!Object.prototype.hasOwnProperty.call(exp, 'token'));
    assert.ok(exp.readOnly);
    assert.ok(exp.safety.noSecretsExported);
    assert.ok(exp.safety.noPiiExported);
  });

  it('8 multi-process unknown → aggregation incomplete', () => {
    const st = resolveMultiProcessStatus({ instances: '4', exec_mode: 'cluster_mode' });
    assert.equal(st.instanceCount, 4);
    assert.equal(st.aggregationComplete, false);
    const single = resolveMultiProcessStatus({ instances: '1', exec_mode: 'fork_mode' });
    assert.equal(single.aggregationComplete, true);
  });

  it('9 loopback middleware allows 127.0.0.1', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::1'), true);
    assert.equal(isLoopbackAddress('8.8.8.8'), false);
  });

  it('10 endpoint read-only GET returns same-process counters', async () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });

    const app = express();
    app.use('/internal/rbac', internalRbacRoutes);
    // Prove GET does not mutate — capture before
    const before = snapshotRuntimeEvidence().runtime.requests;

    const { server, port } = await listen(app);
    try {
      const res = await getJson(port, '/internal/rbac/runtime-evidence');
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.runtime.requests, 2);
      assert.equal(res.body.data.ENTERPRISE_PRIMARY_READY, 'NO');
      assert.equal(res.body.data.source, 'application_process_memory');
      const after = snapshotRuntimeEvidence().runtime.requests;
      assert.equal(after, before, 'GET must not mutate counters');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('11 endpoint rejects non-loopback (simulated)', () => {
    const req = {
      socket: { remoteAddress: '203.0.113.10' },
      get: () => '',
    };
    let status = null;
    let body = null;
    const res = {
      status(code) { status = code; return this; },
      json(payload) { body = payload; return this; },
    };
    let nextCalled = false;
    requireLoopbackInternal(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(status, 403);
    assert.equal(body.code, 'INTERNAL_ONLY');
  });

  it('12 optional evidence token enforced when set', () => {
    process.env.RBAC_RUNTIME_EVIDENCE_TOKEN = 'secret-token';
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      get: (h) => (h.toLowerCase() === 'x-rbac-evidence-token' ? 'wrong' : ''),
    };
    let status = null;
    const res = {
      status(code) { status = code; return this; },
      json() { return this; },
    };
    requireLoopbackInternal(req, res, () => {});
    assert.equal(status, 403);
  });

  it('13 LIVE decision unchanged by export builder', () => {
    // Export path never calls next()/authorize — only reads counters.
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/runtimeEvidenceExport.js'),
      'utf8',
    );
    assert.equal(src.includes('assertStaffPermissions'), false);
    assert.equal(src.includes('authorize('), false);
    assert.equal(src.includes('checkPermission'), false);
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '../../routes/internalRbacRoutes.js'),
      'utf8',
    );
    assert.match(routeSrc, /router\.get\('\/runtime-evidence'/);
    assert.equal(routeSrc.includes('router.post'), false);
    assert.equal(routeSrc.includes('router.put'), false);
    assert.equal(routeSrc.includes('router.delete'), false);
  });

  it('14 export script exists and refuses invented PASS without fetch', () => {
    const script = path.join(__dirname, '../../scripts/export-rbac-runtime-evidence.cjs');
    assert.ok(fs.existsSync(script));
    const src = fs.readFileSync(script, 'utf8');
    assert.match(src, /application_process_unreachable/);
    assert.match(src, /NOT_AVAILABLE/);
    assert.match(src, /ENTERPRISE_PRIMARY_READY/);
  });

  it('15 synthetic cannot replace runtime evidence', () => {
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
    const exp = buildLiveRuntimeEvidenceExport({ env: envStagingFlags() });
    assert.equal(exp.runtime.requests, 0);
    assert.equal(exp.PRODUCTION_SOAK_EVIDENCE, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
  });
});
