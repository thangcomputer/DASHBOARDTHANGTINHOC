const test = require('node:test');
const assert = require('node:assert/strict');
const { MetricsCollector, normalizePath } = require('../../services/metricsCollector');
const monitoring = require('../../services/monitoringService');

test('normalizePath strips ObjectIds', () => {
  assert.equal(
    normalizePath('/api/students/507f1f77bcf86cd799439011/foo'),
    '/api/students/:id/foo',
  );
});

test('MetricsCollector records and snapshots', () => {
  const c = new MetricsCollector();
  c.record({ method: 'GET', path: '/api/students', statusCode: 200, durationMs: 12 });
  c.record({ method: 'POST', path: '/api/students', statusCode: 500, durationMs: 40 });
  const s = c.snapshot();
  assert.equal(s.requestsTotal, 2);
  assert.equal(s.errors5xx, 1);
  assert.ok(s.latency.avgMs >= 12);
  assert.ok(s.topPaths.length >= 1);
  assert.equal(s.recentErrors.length, 1);
});

test('getHealth returns structure', () => {
  const h = monitoring.getHealth();
  assert.ok('ok' in h);
  assert.ok(h.db);
  assert.ok(h.memory);
  assert.ok(h.queue);
});