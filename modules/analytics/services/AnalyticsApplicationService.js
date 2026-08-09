'use strict';
const { studentRepository } = require('./../../student/repositories');
const { scheduleRepository } = require('./../../attendance/repositories');
const { branchRepository } = require('./../../branch/repositories');
const logger = require('./../../../config/logger');
const { sumFinancialRevenue } = require('./../../finance/services/ledgerService');

/**
 * analyticsRoutes.js — Báo cáo Doanh thu & Thống kê đa chi nhánh
 * P0: KPI doanh thu chính = Ledger sumFinancialRevenue (net = payment − refund).
 */
const {
  listPaidItems,
  revenueByBranch,
  sumStudentPaidTuition,
} = require('../../finance/services/revenueAggregate');
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

class AnalyticsApplicationService {
  async get_revenue(data) {
  try {
    const { period = '1m', branchId: queryBranch } = data.query;
    const { start, end } = getPeriodRange(period);
    const baseFilter = buildBaseFilter(req, queryBranch);
    const branchId = baseFilter.branchId || null;
    const periodMs = end - start;
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = new Date(start);

    const [current, previous, allTime, paidItems, newStudents] = await Promise.all([
      sumFinancialRevenue({ branchId, from: start, to: end }),
      sumFinancialRevenue({ branchId, from: prevStart, to: prevEnd }),
      sumFinancialRevenue({ branchId }),
      listPaidItems({ branchFilter: baseFilter, start, end }),
      studentRepository.count({
        ...baseFilter,
        createdAt: { $gte: start, $lte: end },
      }),
    ]);

    const totalRevenue = current.net || 0;
    const prevRevenue = previous.net || 0;
    const growthPct = prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : null;

    const byBranch = await revenueByBranch({ branchFilter: baseFilter, start, end });
    byBranch.forEach((b) => {
      b.pct = totalRevenue > 0 ? Math.round((b.total / totalRevenue) * 100) : 0;
    });

    const timeSeries = generateTimeSeries(paidItems, start, end, 'paidAt', 'amount');

    return { _status: 200, _body: ({
      success: true,
      data: {
        period,
        dateRange: { from: start, to: end },
        source: 'ledger',
        totalRevenue,
        grossRevenue: current.payments || 0,
        refunds: current.refunds || 0,
        prevRevenue,
        growthPct,
        allTimeRevenue: allTime.net || 0,
        newStudentsCount: newStudents,
        paidStudentsCount: current.paymentCount || 0,
        paymentCount: current.paymentCount || 0,
        refundCount: current.refundCount || 0,
        byBranch,
        timeSeries,
      },
    });
  } catch (err) {
    logger.error('[ANALYTICS] revenue error:', err);
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_enrollment(data) {
  try {
    const { period = '1m', branchId: queryBranch } = data.query;
    const { start, end } = getPeriodRange(period);
    const baseFilter = buildBaseFilter(req, queryBranch);

    const students = await studentRepository.findMany({
      ...baseFilter,
      createdAt: { $gte: start, $lte: end },
    }).select('name course branchId branchCode paid price paidAmount enrollments createdAt paidAt').lean();

    const total = students.length;
    const paid = students.filter((s) => {
      if (Array.isArray(s.enrollments) && s.enrollments.length) {
        return s.enrollments.some((e) => e.paid === true);
      }
      return !!s.paid;
    }).length;
    const totalFee = students.reduce((sum, st) => sum + sumStudentPaidTuition(st), 0);

    const branchMap = {};
    students.forEach((st) => {
      const key = st.branchId ? st.branchId.toString() : 'unknown';
      if (!branchMap[key]) {
        branchMap[key] = {
          branchId: key,
          branchCode: st.branchCode || 'Không xác định',
          count: 0,
          paid: 0,
          revenue: 0,
        };
      }
      branchMap[key].count += 1;
      const rev = sumStudentPaidTuition(st);
      if (rev > 0) {
        branchMap[key].paid += 1;
        branchMap[key].revenue += rev;
      }
    });

    const courseMap = {};
    students.forEach((st) => {
      const enrollments = Array.isArray(st.enrollments) && st.enrollments.length
        ? st.enrollments
        : [{ courseName: st.course, paid: st.paid, price: st.price }];
      enrollments.forEach((enr) => {
        const key = enr.courseName || enr.name || st.course || 'Chưa xếp khóa';
        if (!courseMap[key]) courseMap[key] = { course: key, count: 0, revenue: 0 };
        courseMap[key].count += 1;
        if (enr.paid) courseMap[key].revenue += Number(enr.price) || 0;
      });
    });

    // Time series đăng ký: mỗi HV 1 điểm; value = tổng học phí đã thu của HV đó
    const seriesDocs = students.map((st) => ({
      createdAt: st.createdAt,
      amount: sumStudentPaidTuition(st),
    }));
    const timeSeries = generateTimeSeries(seriesDocs, start, end, 'createdAt', 'amount');

    return { _status: 200, _body: ({
      success: true,
      data: {
        period,
        dateRange: { from: start, to: end },
        // H6: ops enrollment cache — KPI tiền dùng /analytics/revenue (Ledger)
        source: 'enrollment_ops',
        note: 'totalFee/byCourse.revenue từ enrollment.paid (ops). Doanh thu SoT: GET /analytics/revenue',
        total,
        paid,
        totalFee,
        byBranch: Object.values(branchMap).sort((a, b) => b.count - a.count),
        byCourse: Object.values(courseMap).sort((a, b) => b.count - a.count),
        timeSeries,
      },
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async get_branches(data) {
  try {
    const branches = await branchRepository.findMany({ isActive: { $ne: false } }).lean();

    const result = await Promise.all(branches.map(async (br) => {
      const [studentCount, paidCount, revenueRes, scheduleCount] = await Promise.all([
        studentRepository.count({ branchId: br._id }),
        studentRepository.count({ branchId: br._id, paid: true }),
        sumFinancialRevenue({ branchId: br._id }),
        scheduleRepository.count({ branchId: br._id }),
      ]);
      return {
        _id: br._id,
        name: br.name,
        code: br.code,
        address: br.address,
        studentCount,
        paidCount,
        revenue: revenueRes.net || 0,
        scheduleCount,
      };
    }));

    const grandTotal = result.reduce((s, b) => s + b.revenue, 0);
    result.forEach((b) => {
      b.pct = grandTotal > 0 ? Math.round((b.revenue / grandTotal) * 100) : 0;
    });

    return { _status: 200, _body: ({ success: true, data: result.sort((a, b) => b.revenue - a.revenue) });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new AnalyticsApplicationService();
