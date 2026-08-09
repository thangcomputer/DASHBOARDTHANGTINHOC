const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../shared/middleware/authorize');
const legacyMapping = require('../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../shared/constants/permissions');
const { PERMISSIONS } = require('../../constants/permissions');
const controllers/BranchController = require('./controllers/BranchController');

// ── GET /api/branches/all & /api/branches ───────────────────────────────────
router.get('/all', controllers/BranchController.getAllBranches);
router.get('/', controllers/BranchController.getAllBranches);

// ── POST /api/branches ────────────────────────────────────────────────────────
router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), controllers/BranchController.createBranch);

// ── PUT /api/branches/:id ─────────────────────────────────────────────────────
router.put('/:id', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), controllers/BranchController.updateBranch);

// ── DELETE /api/branches/:id ──────────────────────────────────────────────────
router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), controllers/BranchController.deleteBranch);

module.exports = router;
