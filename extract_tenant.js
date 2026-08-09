const fs = require('fs');
const path = require('path');

const tenantDir = path.join(__dirname, 'modules/tenant');
const controllersDir = path.join(tenantDir, 'controllers');
const servicesDir = path.join(tenantDir, 'services');
if (!fs.existsSync(controllersDir)) fs.mkdirSync(controllersDir, { recursive: true });
if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

// 1. TenantApplicationService.js
let tenantServiceCode = fs.readFileSync(path.join(tenantDir, 'tenantService.js'), 'utf8');
// Fix the branchRepository call by moving it to the service
tenantServiceCode += `
  async getBranches() {
    const branchRepository = require('../branch/repositories');
    return await branchRepository.findAllSimple();
  }
`;
tenantServiceCode = tenantServiceCode.replace(/module\.exports = new TenantService\(\);/g, 'module.exports = new TenantService();\n');
fs.writeFileSync(path.join(servicesDir, 'TenantApplicationService.js'), tenantServiceCode);

// 2. TenantController.js
const tenantControllerCode = `
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
`;
fs.writeFileSync(path.join(controllersDir, 'TenantController.js'), tenantControllerCode);

// 3. Update tenantRoutes.js
const tenantRoutesCode = `const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../shared/middleware/authMiddleware');
const { authorize } = require('../../shared/middleware/authorize');
const NEW_PERMISSIONS = require('../../shared/constants/permissions');
const tenantController = require('./controllers/TenantController');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];

router.get('/', guard, tenantController.listTenants);
router.get('/meta/branches', guard, tenantController.getMetaBranches);
router.get('/:id/stats', guard, tenantController.getTenantStats);
router.get('/:id', guard, tenantController.getTenant);
router.post('/', guard, tenantController.createTenant);
router.put('/:id', guard, tenantController.updateTenant);
router.post('/:id/branches', guard, tenantController.assignBranch);

module.exports = router;
`;
fs.writeFileSync(path.join(tenantDir, 'tenantRoutes.js'), tenantRoutesCode);

// Delete old service
fs.unlinkSync(path.join(tenantDir, 'tenantService.js'));

console.log('Tenant extracted successfully.');
