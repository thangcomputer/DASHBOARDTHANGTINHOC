const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { policyShadowMonitoring } = require('../middleware/policyShadowMonitoring');
const { monitoringCutoverGate } = require('../middleware/monitoringCutoverGate');
const monitoring = require('../services/monitoringService');
const logger = require('../config/logger');

/**
 * Phase 7.2 — Controlled cutover for /api/monitoring ONLY.
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

// GET /api/monitoring/health — chi tiet hon /healthz
router.get('/health', guard('health'), (req, res) => {
  const data = monitoring.getHealth();
  res.status(data.ok ? 200 : 503).json({ success: true, data });
});

// GET /api/monitoring/metrics
router.get('/metrics', guard('metrics'), (req, res) => {
  res.json({ success: true, data: monitoring.getMetrics() });
});

// GET /api/monitoring/overview — dashboard
router.get('/overview', guard('overview'), (req, res) => {
  res.json({ success: true, data: monitoring.getOverview() });
});

// POST /api/monitoring/metrics/reset — Super Admin / admin reset counters
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

module.exports = router;
