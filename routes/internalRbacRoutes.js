/**
 * Phase 8.20C — Internal RBAC evidence routes (READ-ONLY).
 * Mounted at /internal/rbac — not under /api public reverse-proxy paths.
 */
const express = require('express');
const router = express.Router();
const { requireLoopbackInternal } = require('../middleware/requireLoopbackInternal');
const { buildLiveRuntimeEvidenceExport } = require('../services/rbacParity/runtimeEvidenceExport');

/**
 * GET /internal/rbac/runtime-evidence
 * Same-process counters. No Enterprise authorize. No LIVE mutation.
 */
router.get('/runtime-evidence', requireLoopbackInternal, (req, res) => {
  const data = buildLiveRuntimeEvidenceExport();
  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = router;
