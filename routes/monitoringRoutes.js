const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const monitoring = require('../services/monitoringService');
const logger = require('../config/logger');

const guard = [authMiddleware, isAdmin];

// GET /api/monitoring/health — chi tiet hon /healthz
router.get('/health', guard, (req, res) => {
  const data = monitoring.getHealth();
  res.status(data.ok ? 200 : 503).json({ success: true, data });
});

// GET /api/monitoring/metrics
router.get('/metrics', guard, (req, res) => {
  res.json({ success: true, data: monitoring.getMetrics() });
});

// GET /api/monitoring/overview — dashboard
router.get('/overview', guard, (req, res) => {
  res.json({ success: true, data: monitoring.getOverview() });
});

// POST /api/monitoring/metrics/reset — Super Admin / admin reset counters
router.post('/metrics/reset', guard, (req, res) => {
  try {
    const isSuper = req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN';
    if (!isSuper) {
      return res.status(403).json({ success: false, message: 'Chi Super Admin' });
    }
    const data = monitoring.resetMetrics();
    logger.info({ by: req.user.id }, '[Monitoring] metrics reset');
    res.json({ success: true, message: 'Da reset metrics', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;