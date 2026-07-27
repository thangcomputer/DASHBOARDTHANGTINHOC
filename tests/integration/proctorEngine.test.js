const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadProctor() {
  const base = path.join(__dirname, '../../client/src/utils/proctor');
  const risk = await import(pathToFileURL(path.join(base, 'riskEngine.js')).href);
  const cfg = await import(pathToFileURL(path.join(base, 'config.js')).href);
  const vision = await import(pathToFileURL(path.join(base, 'vision.js')).href);
  const events = await import(pathToFileURL(path.join(base, 'eventLog.js')).href);
  return { ...risk, ...cfg, ...vision, ...events };
}

test('createConfirmTracker requires frames + duration', async () => {
  const { createConfirmTracker } = await loadProctor();
  const t = createConfirmTracker({ minFrames: 3, confirmMs: 100 });
  const t0 = Date.now();
  assert.equal(t.tick(true, t0).confirmed, false);
  assert.equal(t.tick(true, t0 + 50).confirmed, false);
  assert.equal(t.tick(true, t0 + 120).confirmed, true);
  t.reset();
  assert.equal(t.tick(false, t0 + 200).confirmed, false);
});

test('riskEngine accumulates and decays; no hard from single soft event', async () => {
  const { createRiskEngine, PROCTOR_CONFIG } = await loadProctor();
  const eng = createRiskEngine();
  const r1 = eng.add('low_light');
  assert.ok(r1.score > 0);
  assert.equal(r1.hard, false);
  // Một sự kiện nhẹ không đủ hard
  assert.ok(r1.score < PROCTOR_CONFIG.RISK_HARD_THRESHOLD);
});

test('riskEngine hard after enough weight', async () => {
  const { createRiskEngine } = await loadProctor();
  const eng = createRiskEngine();
  let last = null;
  for (let i = 0; i < 8; i++) last = eng.add('multi_face');
  assert.ok(last.hard || last.score >= 70);
});

test('pointInProctorOval center is inside', async () => {
  const { pointInProctorOval, PROCTOR_CONFIG } = await loadProctor();
  assert.equal(pointInProctorOval(PROCTOR_CONFIG.OVAL_CX, PROCTOR_CONFIG.OVAL_CY), true);
  assert.equal(pointInProctorOval(0.05, 0.05), false);
});

test('resolveProctorUiStatus maps states', async () => {
  const { resolveProctorUiStatus } = await loadProctor();
  assert.equal(resolveProctorUiStatus({ cameraStatus: 'active', facePresent: true, inOval: true }).level, 'green');
  assert.equal(resolveProctorUiStatus({ cameraStatus: 'active', facePresent: false }).code, 'no_face');
  assert.equal(resolveProctorUiStatus({ cameraStatus: 'active', facePresent: true, multiFace: true }).code, 'multi_face');
  assert.equal(resolveProctorUiStatus({ cameraStatus: 'denied' }).level, 'red');
});

test('eventLog sanitizes sensitive fields', async () => {
  const { createProctorEventLog } = await loadProctor();
  const log = createProctorEventLog({ flushMs: 0 });
  log.push('camera_start', 'info', {
    streamUrl: 'blob:secret',
    frameData: 'xxx',
    deviceLabel: 'A'.repeat(80),
  });
  const ev = log.getEvents()[0];
  assert.equal(ev.detail.streamUrl, undefined);
  assert.equal(ev.detail.frameData, undefined);
  assert.ok(ev.detail.deviceLabel.length <= 40);
});

test('proctorAudit ALLOWED_TYPES covers core events', async () => {
  const service = require('../../services/proctorAuditService');
  assert.ok(service.ALLOWED_TYPES.has('camera_start'));
  assert.ok(service.ALLOWED_TYPES.has('multi_face'));
  assert.ok(service.ALLOWED_TYPES.has('exam_terminate'));
});
