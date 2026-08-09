const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { policyShadowTenant } = require('../middleware/policyShadowTenant');
const { tenantsCutoverGate } = require('../middleware/tenantsCutoverGate');
const tenantService = require('../services/tenantService');
const Branch = require('../models/Branch');

/**
 * Phase 7.6 — Controlled cutover for /api/tenants ONLY.
 *
 * Default / not allowlisted:
 *   auth → policyShadowTenant → Legacy isSuperAdmin (via tenantsCutoverGate) → handler
 *
 * Opt-in Policy-primary:
 *   POLICY_CUTOVER_ENABLED=true
 *   POLICY_CUTOVER_ROUTES=…,tenants
 *
 * Rollback: remove tenants from ROUTES (keep backups,monitoring) or ENABLED=false.
 * Legacy isSuperAdmin retained inside tenantsCutoverGate. Handlers retain all mutations.
 */
const guard = (action) => [
  authMiddleware,
  policyShadowTenant(action),
  tenantsCutoverGate(action),
];

router.get('/', guard('list'), async (req, res) => {
  try {
    const data = await tenantService.listTenants({ status: req.query.status });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Phải đặt trước /:id
router.get('/meta/branches', guard('meta_branches'), async (req, res) => {
  try {
    const branches = await Branch.find().select('name code tenantId isActive').sort({ name: 1 }).lean();
    res.json({ success: true, data: branches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/stats', guard('stats'), async (req, res) => {
  try {
    const data = await tenantService.getTenantStats(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', guard('get'), async (req, res) => {
  try {
    const data = await tenantService.getTenant(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/', guard('create'), async (req, res) => {
  try {
    const tenant = await tenantService.createTenant(req.body || {});
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.put('/:id', guard('update'), async (req, res) => {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body || {});
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/:id/branches', guard('assign_branch'), async (req, res) => {
  try {
    const { branchId } = req.body || {};
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Thiếu branchId' });
    }
    const branch = await tenantService.assignBranch(req.params.id, branchId);
    res.json({ success: true, data: branch });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
