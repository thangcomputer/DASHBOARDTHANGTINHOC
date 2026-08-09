/**
 * employeeRoutes.js — CRUD Nhân sự + Trả lương
 * Branch-aware: STAFF chỉ thấy nhân viên chi nhánh mình
 */
const express    = require('express');
const router     = express.Router();
const employeeRepository = require('../../auth/repositories');
const PayrollLog = require('../../finance/models/PayrollLog');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');

function emitEmployeesChanged(req, action = 'update') {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('employees:updated', { action });
  io.emit('data:refresh', { type: 'employees', action });
}

// ─── GET /api/employees ─────────────────────────────────────────────────────────
// Danh sách nhân sự (branch-aware)
router.get('/', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.get_root);

// ─── GET /api/employees/stats ────────────────────────────────────────────────────
router.get('/stats', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.get_stats);

// ─── POST /api/employees ────────────────────────────────────────────────────────
router.post('/', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.post_root);

// ─── PUT /api/employees/:id ─────────────────────────────────────────────────────
router.put('/:id', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.put_id);

// ─── DELETE /api/employees/:id ──────────────────────────────────────────────────
router.delete('/:id', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.delete_id);

// ─── POST /api/employees/:id/pay ────────────────────────────────────────────────
// Trả lương cho nhân viên → ghi vào PayrollLog
router.post('/:id/pay', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.post_id_pay);

// ─── GET /api/employees/:id/payroll ─────────────────────────────────────────────
// Lịch sử trả lương
router.get('/:id/payroll', [authMiddleware, authorize(NEW_PERMISSIONS.USER_MANAGE), branchFilter],employeeController.get_id_payroll);

module.exports = router;
