const correlationContext = require('../correlationContext');
const auditLogger = require('../../logger/auditLogger');
const AuditEvents = require('../../constants/auditEvents');
const prometheusExporter = require('../../metrics/prometheusExporter');
const monitoring = require('../../../modules/report/services/monitoringService');

describe('Sprint 2 Observability & Infrastructure Tests', () => {
  test('Correlation Context stores and retrieves IDs', (done) => {
    correlationContext.run({ requestId: 'req-123', correlationId: 'corr-456' }, () => {
      const store = correlationContext.getStore();
      expect(store).toBeDefined();
      expect(store.requestId).toBe('req-123');
      expect(store.correlationId).toBe('corr-456');
      done();
    });
  });

  test('Prometheus Exporter outputs valid formatted text', async () => {
    const text = await prometheusExporter.toPrometheusText();
    expect(text).toContain('app_up 1');
    expect(text).toContain('database_connected');
    expect(text).toContain('redis_connected');
    expect(text).toContain('active_users');
    expect(text).toContain('memory_rss_bytes');
    expect(text).toContain('cpu_usage_user_seconds');
  });

  test('Monitoring Service getHealth exposes required diagnostics', () => {
    const h = monitoring.getHealth();
    expect(h.ok).toBeDefined();
    expect(h.version).toBe('1.0.0');
    expect(h.memory).toBeDefined();
    expect(h.cpu).toBeDefined();
    expect(h.mail).toBeDefined();
    expect(h.storage).toBeDefined();
  });

  test('AuditLogger resolves IDs automatically and is reusable', async () => {
    // Mock the Mongoose AuditLog model create call to verify payload
    const AuditLog = require('../../../modules/report/models/AuditLog');
    const originalCreate = AuditLog.create;
    
    let createdPayload = null;
    AuditLog.create = jest.fn().mockImplementation((payload) => {
      createdPayload = payload;
      return Promise.resolve(payload);
    });

    await correlationContext.run({ requestId: 'req-audit', correlationId: 'corr-audit' }, async () => {
      const actor = { id: 'user-001', role: 'teacher' };
      await auditLogger.log(actor, AuditEvents.USER_LOGIN, 'User', 'user-001', {
        oldValue: { status: 'offline' },
        newValue: { status: 'online' },
      });
    });

    expect(createdPayload).not.toBeNull();
    expect(createdPayload.action).toBe(AuditEvents.USER_LOGIN);
    expect(createdPayload.actorUserId).toBe('user-001');
    expect(createdPayload.requestId).toBe('req-audit');
    expect(createdPayload.correlationId).toBe('corr-audit');

    // Restore original create method
    AuditLog.create = originalCreate;
  });
});
