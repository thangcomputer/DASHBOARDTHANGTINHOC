
const tenantService = require('../services/TenantApplicationService');

class TenantController {
  async listTenants(req, res) {
    try {
      const data = await tenantService.listTenants({ status: req.query.status });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getMetaBranches(req, res) {
    try {
      const branches = await tenantService.getBranches();
      res.json({ success: true, data: branches });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getTenantStats(req, res) {
    try {
      const data = await tenantService.getTenantStats(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getTenant(req, res) {
    try {
      const data = await tenantService.getTenant(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async createTenant(req, res) {
    try {
      const tenant = await tenantService.createTenant(req.body || {});
      res.status(201).json({ success: true, data: tenant });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async updateTenant(req, res) {
    try {
      const tenant = await tenantService.updateTenant(req.params.id, req.body || {});
      res.json({ success: true, data: tenant });
    } catch (err) {
      res.status(err.status || 500).json({ success: false, message: err.message });
    }
  }

  async assignBranch(req, res) {
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
  }
}

module.exports = new TenantController();
