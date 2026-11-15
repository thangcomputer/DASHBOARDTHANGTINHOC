const express = require('express');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const { policyShadowMonitoring } = require('../middleware/policyShadowMonitoring');
const { monitoringCutoverGate } = require('../middleware/monitoringCutoverGate');
const monitoring = require('../services/monitoringService');
const telemetryService = require('../services/telemetryService');
const logger = require('../config/logger');

const telemetryIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Quá nhiều bản tin telemetry' },
});

function attachOptionalUser(req, _res, next) {
  try {
    const authHeader = req.header('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token && process.env.JWT_SECRET) {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch { /* anonymous or expired token still allowed for passive telemetry */ }
  next();
}

/**
 * Phase 7.2 - Controlled cutover for /api/monitoring ONLY.
 *
 * Default (POLICY_CUTOVER_ENABLED=false or monitoring not allowlisted):
 *   auth → policyShadow (observe) → Legacy isAdmin (via monitoringCutoverGate) → handler
 *
 * Opt-in Policy-primary:
 *   POLICY_CUTOVER_ENABLED=true
 *   POLICY_CUTOVER_ROUTES=monitoring
 *   → auth → policyShadow → monitoringCutoverGate (Policy HTTP) → handler
 *
 * Rollback: set ENABLED=false OR remove monitoring from ROUTES (no code deploy required).
 * Legacy isAdmin remains inside monitoringCutoverGate for Legacy path / fail-safe fallback.
 */
const guard = (action) => [
  authMiddleware,
  policyShadowMonitoring(action),
  monitoringCutoverGate(action),
];

// GET /api/monitoring/health - chi tiet hon /healthz
router.get('/health', guard('health'), (req, res) => {
  const data = monitoring.getHealth();
  res.status(data.ok ? 200 : 503).json({ success: true, data });
});

// GET /api/monitoring/metrics
router.get('/metrics', guard('metrics'), (req, res) => {
  res.json({ success: true, data: monitoring.getMetrics() });
});

// GET /api/monitoring/overview - dashboard
router.get('/overview', guard('overview'), (req, res) => {
  res.json({ success: true, data: monitoring.getOverview() });
});

// POST /api/monitoring/metrics/reset - Super Admin / admin reset counters
router.post('/metrics/reset', guard('metrics_reset'), (req, res) => {
  try {
    // When Policy is authoritative, SUPER check already applied by monitoringPolicy.
    // When Legacy authoritative (or Policy fallback), keep Legacy handler SUPER gate.
    if (!req.policyAuthoritative) {
      const isSuper = req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN';
      if (!isSuper) {
        return res.status(403).json({ success: false, message: 'Chi Super Admin' });
      }
    }
    const data = monitoring.resetMetrics();
    logger.info({ by: req.user.id }, '[Monitoring] metrics reset');
    res.json({ success: true, message: 'Da reset metrics', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Mục 4.3.6: Real User Core Web Vitals & Sentry Error Tracking ───────────

function buildIngestVitalPayload(req) {
  return {
    ...(req.body && typeof req.body === 'object' ? req.body : {}),
    userId: req.user?.id ? String(req.user.id) : '',
    userRole: req.user?.role ? String(req.user.role) : 'anonymous',
  };
}

function buildIngestErrorPayload(req) {
  return {
    ...(req.body && typeof req.body === 'object' ? req.body : {}),
    source: 'frontend',
    userId: req.user?.id ? String(req.user.id) : '',
    userRole: req.user?.role ? String(req.user.role) : 'anonymous',
  };
}

// POST /api/monitoring/ingest/vital (public / authenticated RUM beacon)
router.post('/ingest/vital', telemetryIngestLimiter, attachOptionalUser, async (req, res) => {
  try {
    const saved = await telemetryService.ingestVital(buildIngestVitalPayload(req), req);
    res.status(202).json({ success: true, recorded: Boolean(saved) });
  } catch (err) {
    logger.warn({ err: err.message }, '[TELEMETRY] ingest vital failed');
    res.status(200).json({ success: false });
  }
});

// POST /api/monitoring/ingest/error (public / authenticated Sentry-style capture)
router.post('/ingest/error', telemetryIngestLimiter, attachOptionalUser, async (req, res) => {
  try {
    const saved = await telemetryService.ingestError(buildIngestErrorPayload(req), req);
    res.status(202).json({
      success: true,
      fingerprint: saved?.fingerprint || '',
      sentryForwarded: Boolean(saved?.sentryForwarded),
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[TELEMETRY] ingest error failed');
    res.status(200).json({ success: false });
  }
});

// GET /api/monitoring/telemetry?windowHours=24&issueStatus=all
router.get('/telemetry', authMiddleware, isAdmin, async (req, res) => {
  try {
    const data = await telemetryService.getTelemetrySummary({
      windowHours: req.query.windowHours,
      issueStatus: req.query.issueStatus,
    });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[Monitoring] telemetry summary failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/monitoring/telemetry/errors/:fingerprint/resolve
router.patch('/telemetry/errors/:fingerprint/resolve', authMiddleware, isAdmin, async (req, res) => {
  try {
    const resolved = req.body?.resolved !== false;
    const result = await telemetryService.setIssueResolved(
      req.params.fingerprint,
      resolved,
      req.user?.name || req.user?.id || 'admin',
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/monitoring/telemetry/test-error - Trigger test Sentry/Telemetry event
router.post('/telemetry/test-error', authMiddleware, isAdmin, async (req, res) => {
  try {
    const isSuper = req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN';
    if (!isSuper) {
      return res.status(403).json({ success: false, message: 'Chỉ Super Admin mới được gửi lỗi thử nghiệm' });
    }
    const saved = await telemetryService.ingestError({
      source: req.body?.source === 'backend' ? 'backend' : 'frontend',
      name: 'SentryTestEvent',
      message: `Kiểm tra giám sát lỗi bởi ${req.user?.name || 'Admin'} (${new Date().toLocaleTimeString('vi-VN')})`,
      stack: 'Error: SentryTestEvent\n    at MonitoringPage.sendTestError (/admin/monitoring:1:1)',
      route: '/admin/monitoring',
    }, req);
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router._test = {
  buildIngestVitalPayload,
  buildIngestErrorPayload,
};

module.exports = router;
