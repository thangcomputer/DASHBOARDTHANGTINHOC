const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../shared/middleware/authorize');
const legacyMapping = require('../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../shared/constants/permissions');
const { PERMISSIONS } = require('../../constants/permissions');
const BranchController = require('./controllers/BranchController');

// ── GET /api/branches/all & /api/branches ───────────────────────────────────
router.get('/all', BranchController.getAllBranches);
router.get('/', BranchController.getAllBranches);

// ── POST /api/branches ────────────────────────────────────────────────────────
router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), BranchController.createBranch);

// ── PUT /api/branches/:id ─────────────────────────────────────────────────────
router.put('/:id', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), BranchController.updateBranch);

// ── DELETE /api/branches/:id ──────────────────────────────────────────────────
router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.BRANCH_MANAGE), BranchController.deleteBranch);

module.exports = router;
