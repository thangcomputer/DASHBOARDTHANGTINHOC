const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/MonitoringController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const monitoring = require('../services/monitoringService');
const logger = require('../../../config/logger');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];

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
    const isSuper = req.currentUser?.id === 'admin' || req.currentUser?.adminRole === 'SUPER_ADMIN';
    if (!isSuper) {
      return res.status(403).json({ success: false, message: 'Chi Super Admin' });
    }
    const data = monitoring.resetMetrics();
    logger.info({ by: req.currentUser.id }, '[Monitoring] metrics reset');
    res.json({ success: true, message: 'Da reset metrics', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;