const express = require('express');
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
