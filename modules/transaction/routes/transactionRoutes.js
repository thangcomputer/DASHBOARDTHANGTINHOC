/**
 * transactionRoutes.js — Quản lý phiếu chi lương giảng viên
 * Có branchFilter: STAFF chỉ thấy giao dịch của chi nhánh mình
 */
const express     = require('express');
const router      = express.Router();
const { transactionRepository } = require('../repositories');
const Transaction = require('../models/Transaction'); // Temp for new Transaction
const Teacher     = require('../../teacher/models/Teacher');
const Schedule    = require('../../attendance/models/Schedule');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const { sanitizeRegex } = require('../../../middleware/sanitizeRegex');
const logger = require('../../../config/logger');
const { postSalary, voidLedgerEntry } = require('../../finance/services/ledgerService');
const LedgerEntry = require('../../finance/models/LedgerEntry');
const { allowHardDeleteFinance } = require('../../../utils/financeFlags');

// ─── GET /api/transactions ─────────────────────────────────────────────────────
// Admin/Staff: Lấy giao dịch lương (STAFF chỉ thấy chi nhánh của mình)
router.get('/', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter],transactionController.get_root);

// ─── GET /api/transactions/stats ──────────────────────────────────────────────
// Thống kê tài chính giảng viên (Admin/Staff, branch-aware)
router.get('/stats', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), branchFilter],transactionController.get_stats);

// ─── GET /api/transactions/teacher/:teacherId ──────────────────────────────────
// Giảng viên xem lịch sử nhận lương
router.get('/teacher/:teacherId', authMiddleware,transactionController.get_teacher_teacherId);

// ─── POST /api/transactions/calculate ─────────────────────────────────────────
// Tính lương tự động theo buổi dạy đã hoàn thành trong tháng
router.post('/calculate', authMiddleware, authorizeAny(...legacyMapping.resolve('view_teachers')),transactionController.post_calculate);

// ─── POST /api/transactions ────────────────────────────────────────────────────
// Admin tạo phiếu chi lương cho giảng viên
router.post('/', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE),transactionController.post_root);

// ─── PUT /api/transactions/:id/confirm ────────────────────────────────────────
// Admin xác nhận đã thanh toán lương
router.put('/:id/confirm', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE),transactionController.put_id_confirm);

// ─── PUT /api/transactions/:id/cancel ─────────────────────────────────────────
router.put('/:id/cancel', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE),transactionController.put_id_cancel);

// ─── DELETE /api/transactions/:id ────────────────────────────────────────────
// P3: cấm hard-delete phiếu đã confirmed; chỉ cho phép khi FINANCE_ALLOW_HARD_DELETE=true
router.delete('/:id', authMiddleware, authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE),transactionController.delete_id);

module.exports = router;
