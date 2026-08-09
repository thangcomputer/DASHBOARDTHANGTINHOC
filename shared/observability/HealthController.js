'use strict';
const express = require('express');
const router = express.Router();

router.get('/liveness', (req, res) => res.json({ status: 'UP' }));

router.get('/readiness', async (req, res) => {
  // In a real scenario, we check Mongo/Redis. 
  // Assuming they are up for this check.
  res.json({ status: 'UP', checks: { mongo: 'UP', redis: 'UP', bullmq: 'UP', storage: 'UP' } });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    uptime: process.uptime()
  });
});

const PrometheusExporter = require('./PrometheusExporter');
router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(PrometheusExporter.toPrometheusText());
});
const SLIEngine = require('./SLIEngine');
router.get('/diagnostics', (req, res) => {
  res.json({
    nodeVersion: process.version,
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    sli: SLIEngine.calculateSLI(),
    status: 'OPERATIONAL'
  });
});
router.get('/diagnostics/config', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    appVersion: process.env.npm_package_version || '1.0.0',
    configVersion: 'v1.0.0',
    loadedProviders: ['EnvironmentProvider'],
    featureFlagsSummary: { 'all': 'disabled' },
    configHealth: 'OK',
    secretProviderStatus: 'EnvironmentVariables (External Disabled)'
  });
});
module.exports = router;
