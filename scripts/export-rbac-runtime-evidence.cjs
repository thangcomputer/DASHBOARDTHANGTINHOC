/**
 * Phase 8.20C — Export RUNTIME evidence from the LIVE application process.
 *
 * Reads counters via HTTP GET to the same Node process (loopback).
 * Does NOT create its own counters.
 * Does NOT enable flags.
 * Does NOT promote Enterprise.
 *
 * Usage (on VPS, same host as PM2):
 *   node scripts/export-rbac-runtime-evidence.cjs
 *
 * Optional:
 *   RBAC_RUNTIME_EVIDENCE_URL=http://127.0.0.1:5000/internal/rbac/runtime-evidence
 *   RBAC_RUNTIME_EVIDENCE_TOKEN=...
 *   PORT=5000
 *
 * Exit:
 *   0 = fetched + PRODUCTION_SOAK_EVIDENCE AVAILABLE (and aggregationComplete)
 *   2 = fetched + evidence NOT_AVAILABLE / incomplete / findings
 *   3 = cannot reach application process
 *   1 = unexpected error
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

try {
  // Load local .env when present (does not override already-set vars).
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // optional
}

const DEFAULT_ARTIFACT = path.join(
  __dirname,
  '..',
  'artifacts',
  'rbac-runtime-evidence-820c.json',
);

function buildUrl() {
  if (process.env.RBAC_RUNTIME_EVIDENCE_URL) {
    return String(process.env.RBAC_RUNTIME_EVIDENCE_URL).trim();
  }
  const port = process.env.PORT || '5000';
  return `http://127.0.0.1:${port}/internal/rbac/runtime-evidence`;
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers, timeout: 10000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (err) {
          reject(new Error(`Invalid JSON from evidence endpoint: ${err.message}`));
          return;
        }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout contacting application process'));
    });
    req.on('error', reject);
  });
}

async function main() {
  const url = buildUrl();
  const headers = {};
  const token = String(process.env.RBAC_RUNTIME_EVIDENCE_TOKEN || '').trim();
  if (token) headers['x-rbac-evidence-token'] = token;

  let fetched;
  try {
    fetched = await fetchJson(url, headers);
  } catch (err) {
    const artifact = {
      phase: '8.20C',
      ok: false,
      PRODUCTION_SOAK_EVIDENCE: 'NOT_AVAILABLE',
      ENTERPRISE_PRIMARY_READY: 'NO',
      reason: 'application_process_unreachable',
      error: err?.message || String(err),
      url,
      note: 'Standalone script cannot invent counters. Start/restart PM2 and curl loopback.',
    };
    fs.mkdirSync(path.dirname(DEFAULT_ARTIFACT), { recursive: true });
    fs.writeFileSync(DEFAULT_ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(artifact, null, 2));
    process.exit(3);
  }

  if (fetched.statusCode !== 200 || !fetched.body?.success || !fetched.body?.data) {
    const artifact = {
      phase: '8.20C',
      ok: false,
      PRODUCTION_SOAK_EVIDENCE: 'NOT_AVAILABLE',
      ENTERPRISE_PRIMARY_READY: 'NO',
      reason: 'evidence_endpoint_rejected',
      statusCode: fetched.statusCode,
      body: fetched.body,
      url,
    };
    fs.mkdirSync(path.dirname(DEFAULT_ARTIFACT), { recursive: true });
    fs.writeFileSync(DEFAULT_ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(artifact, null, 2));
    process.exit(3);
  }

  const data = fetched.body.data;
  const evidence = data.PRODUCTION_SOAK_EVIDENCE || data.productionSoakEvidence || 'NOT_AVAILABLE';
  const aggregationComplete = Boolean(data.multiProcess?.aggregationComplete);
  const runtimeEvents = Number(data.runtime?.events || data.runtime?.requests || 0);
  const mismatch = Number(data.runtime?.mismatch || 0);

  const artifact = {
    phase: '8.20C',
    ok: evidence === 'AVAILABLE' && aggregationComplete && runtimeEvents > 0 && mismatch === 0,
    fetchedAt: new Date().toISOString(),
    url,
    PRODUCTION_SOAK_EVIDENCE: evidence,
    ENTERPRISE_PRIMARY_READY: 'NO',
    aggregationComplete,
    runtimeEvents,
    mismatch,
    data,
    note: (
      'Evidence sourced from live application process via loopback HTTP. '
      + 'ENTERPRISE_PRIMARY_READY remains NO.'
    ),
  };

  fs.mkdirSync(path.dirname(DEFAULT_ARTIFACT), { recursive: true });
  fs.writeFileSync(DEFAULT_ARTIFACT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    ok: artifact.ok,
    exitCode: artifact.ok ? 0 : 2,
    artifactPath: DEFAULT_ARTIFACT,
    PRODUCTION_SOAK_EVIDENCE: evidence,
    ENTERPRISE_PRIMARY_READY: 'NO',
    aggregationComplete,
    runtimeEvents,
    mismatch,
    environment: data.environment,
    evidenceChannel: data.evidenceChannel,
    multiProcess: data.multiProcess,
  }, null, 2));

  process.exit(artifact.ok ? 0 : 2);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || String(err));
  process.exit(1);
});
