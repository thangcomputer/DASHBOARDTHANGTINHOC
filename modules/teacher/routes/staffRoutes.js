/**
 * staffRoutes.js — Quản lý tài khoản nội bộ (Admin / Staff) CRUD
 * Thêm: validate branchId tồn tại trong Branches, auto-fill branchCode
 */
const express = require('express');
const { teacherRepository } = require('../repositories');
const Teacher = require('../models/Teacher'); // Temp for new Teacher
const Branch  = require('../../branch/models/Branch');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');

const router = express.Router();
const staffController = require('../controllers/StaffController');
const guard  = [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE)];

function actorIsRootSuperAdmin(req) {
  return req.currentUser?.id === 'admin';
}

function actorIsSuperAdmin(req) {
  return req.currentUser?.id === 'admin' || req.currentUser?.adminRole === 'SUPER_ADMIN';
}

function actorIsHighAdminOrAbove(req) {
  return actorIsSuperAdmin(req) || req.currentUser?.adminRole === 'HIGH_ADMIN';
}

/** Staff không được gán quyền vượt quá quyền của chính mình. */
async function sanitizeAssignedPermissions(req, permissions) {
  const list = Array.isArray(permissions) ? permissions.map(String) : [];
  if (actorIsSuperAdmin(req)) return list;
  const mine = new Set(req.currentUser?.permissions || []);
  return list.filter((p) => mine.has(p));
}

// ── GET /api/staff ─────────────────────────────────────────────────────────────
router.get('/', guard,staffController.get_root);

// ── POST /api/staff ────────────────────────────────────────────────────────────
router.post('/', guard,staffController.post_root);

// ── PUT /api/staff/:id ─────────────────────────────────────────────────────────
router.put('/:id', guard,staffController.put_id);

// ── DELETE /api/staff/:id ──────────────────────────────────────────────────────
router.delete('/:id', guard,staffController.delete_id);

module.exports = router;
