/**
 * analyticsRoutes.js — Báo cáo Doanh thu & Thống kê đa chi nhánh
 * P0: KPI doanh thu chính = Ledger sumFinancialRevenue (net = payment − refund).
 */
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/AnalyticsController');
const { studentRepository } = require('../../student/repositories');
const { scheduleRepository } = require('../../attendance/repositories');
const { branchRepository } = require('../../branch/repositories');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const logger = require('../../../config/logger');
const {
  listPaidItems,
  revenueByBranch,
  sumStudentPaidTuition,
} = require('../../finance/services/revenueAggregate');
const { sumFinancialRevenue } = require('../../finance/services/ledgerService');

const guard = [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE), ...legacyMapping.resolve(PERMISSIONS.VIEW_BRANCH_REVENUE)), branchFilter];

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case '1d': start.setDate(now.getDate() - 1); break;
    case '7d': start.setDate(now.getDate() - 7); break;
    case '1m': start.setMonth(now.getMonth() - 1); break;
    case '2m': start.setMonth(now.getMonth() - 2); break;
    case '10m': start.setMonth(now.getMonth() - 10); break;
    case '1y': start.setFullYear(now.getFullYear() - 1); break;
    case '2y': start.setFullYear(now.getFullYear() - 2); break;
    default: start.setMonth(now.getMonth() - 1); break;
  }
  return { start, end: now };
}

function generateTimeSeries(docs, startDate, endDate, field = 'paidAt', valueField = 'amount') {
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const bucketSize = days > 60 ? 'month' : days > 14 ? 'week' : 'day';

  const buckets = {};
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const key = bucketSize === 'month'
      ? `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      : bucketSize === 'week'
        ? `W${Math.ceil(cur.getDate() / 7)}-${cur.getMonth() + 1}/${cur.getFullYear()}`
        : cur.toISOString().slice(0, 10);
    buckets[key] = 0;
    if (bucketSize === 'day') cur.setDate(cur.getDate() + 1);
    else if (bucketSize === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }

  docs.forEach((doc) => {
    const d = new Date(doc[field] || doc.createdAt || doc.paidAt);
    if (Number.isNaN(d.getTime())) return;
    const key = bucketSize === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : bucketSize === 'week'
        ? `W${Math.ceil(d.getDate() / 7)}-${d.getMonth() + 1}/${d.getFullYear()}`
        : d.toISOString().slice(0, 10);
    if (buckets[key] !== undefined) buckets[key] += (Number(doc[valueField]) || 0);
  });

  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
}

function buildBaseFilter(req, queryBranch) {
  const baseFilter = { ...req.branchFilter };
  if (queryBranch && queryBranch !== 'all' && !baseFilter.branchId) {
    baseFilter.branchId = queryBranch;
  }
  return baseFilter;
}

// GET /api/analytics/revenue?period=1m&branchId=all
router.get('/revenue', guard,analyticsController.get_revenue);

// GET /api/analytics/enrollment?period=1m&branchId=all
router.get('/enrollment', guard,analyticsController.get_enrollment);

// GET /api/analytics/branches — Tổng quan từng chi nhánh (all-time)
router.get('/branches', guard,analyticsController.get_branches);

module.exports = router;
