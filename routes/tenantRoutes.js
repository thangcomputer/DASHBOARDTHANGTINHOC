const express = require('express');
const router = express.Router();
const { authMiddleware, isSuperAdmin } = require('../middleware/auth');
const tenantService = require('../services/tenantService');
const Branch = require('../models/Branch');

const guard = [authMiddleware, isSuperAdmin];

router.get('/', guard, async (req, res) => {
  try {
    const data = await tenantService.listTenants({ status: req.query.status });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Phải đặt trước /:id
router.get('/meta/branches', guard, async (req, res) => {
  try {
    const branches = await Branch.find().select('name code tenantId isActive').sort({ name: 1 }).lean();
    res.json({ success: true, data: branches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/stats', guard, async (req, res) => {
  try {
    const data = await tenantService.getTenantStats(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', guard, async (req, res) => {
  try {
    const data = await tenantService.getTenant(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/', guard, async (req, res) => {
  try {
    const tenant = await tenantService.createTenant(req.body || {});
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.put('/:id', guard, async (req, res) => {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body || {});
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/:id/branches', guard, async (req, res) => {
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
