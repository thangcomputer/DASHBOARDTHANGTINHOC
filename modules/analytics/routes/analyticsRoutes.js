/**
 * analyticsRoutes.js - Báo cáo Doanh thu & Thống kê đa chi nhánh
 * P0: KPI doanh thu chính = Ledger sumFinancialRevenue (net = payment − refund).
 */
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/AnalyticsController');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorizeAny } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const { PERMISSIONS } = require('../../../constants/permissions');

const guard = [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE), ...legacyMapping.resolve(PERMISSIONS.VIEW_BRANCH_REVENUE)), branchFilter];

// GET /api/analytics/revenue?period=1m&branchId=all
router.get('/revenue', guard, analyticsController.get_revenue);

// GET /api/analytics/enrollment?period=1m&branchId=all
router.get('/enrollment', guard, analyticsController.get_enrollment);

// GET /api/analytics/branches - Tổng quan từng chi nhánh (all-time)
router.get('/branches', guard, analyticsController.get_branches);

module.exports = router;
