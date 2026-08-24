/**
 * BI service — executive KPIs, so sánh kỳ trước, breakdown.
 * P0: Doanh thu thuần / hoàn = Ledger sumFinancialRevenue (không phụ thuộc enrollment.paid).
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Transaction = require('../models/Transaction');
const ExamResult = require('../models/ExamResult');
const Branch = require('../models/Branch');
const cache = require('../utils/cache');
const { sumFinancialRevenue, revenueByCourseFromLedger, listNetRevenueByDay } = require('./ledgerService');

function getPeriodRange(period) {
  const end = new Date();
  const start = new Date(end);
  switch (period) {
    case '1d': start.setDate(end.getDate() - 1); break;
    case '7d': start.setDate(end.getDate() - 7); break;
    case '1m': start.setMonth(end.getMonth() - 1); break;
    case '2m': start.setMonth(end.getMonth() - 2); break;
    case '1y': start.setFullYear(end.getFullYear() - 1); break;
    default: start.setMonth(end.getMonth() - 1); break;
  }
  const duration = end - start;
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - duration);
  return { start, end, prevStart, prevEnd };
}

function buildBranchFilter(branchFilter = {}, queryBranch) {
  const filter = { ...branchFilter };
  if (queryBranch && queryBranch !== 'all' && !filter.branchId && !filter._id) {
    filter.branchId = queryBranch;
  }
  return filter;
}

/** HIGH_ADMIN fail-closed: không được mở Ledger all-branch khi Student scope = empty. */
function isDenyAllBranchFilter(bf = {}) {
  return Array.isArray(bf._id?.$in) && bf._id.$in.length === 0;
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function emptyOverview(period, start, end) {
  return {
    period,
    dateRange: { from: start.toISOString(), to: end.toISOString() },
    kpis: {
      studentsTotal: 0,
      studentsPaid: 0,
      studentsUnpaid: 0,
      refundAmount: 0,
      refundCount: 0,
      studentsNew: 0,
      studentsNewChange: 0,
      revenuePeriod: 0,
      revenueGross: 0,
      revenueChange: 0,
      revenuePrev: 0,
      teachersActive: 0,
      teachersPending: 0,
      schedulesCompleted: 0,
      schedulesCancelled: 0,
      schedulesUpcoming: 0,
      transactionsPending: 0,
      examTotal: 0,
      examPassed: 0,
      examPassRate: null,
      paidRate: 0,
      paymentsPeriod: 0,
      costsPeriod: 0,
      profitPeriod: 0,
      source: 'ledger',
    },
    byCourse: [],
    trend: [],
    branches: [],
    generatedAt: new Date().toISOString(),
  };
}

async function getOverview({ period = '1m', branchFilter = {}, queryBranch = 'all' } = {}) {
  const bf = buildBranchFilter(branchFilter, queryBranch);
  const branchId = bf.branchId || null;
  const cacheKey = 'bi:overview:v6-ledger:' + period + ':' + (branchId || (isDenyAllBranchFilter(bf) ? 'deny' : (queryBranch || 'all')));

  return cache.wrap(cacheKey, 90, async () => {
    const { start, end, prevStart, prevEnd } = getPeriodRange(period);

    // Fail-closed: đừng query Ledger all-branch khi scope Student bị deny.
    if (isDenyAllBranchFilter(bf)) {
      return emptyOverview(period, start, end);
    }

    const teacherBf = { ...bf, role: 'teacher' };
    const { VN_TZ } = require('../utils/vnTimezone');

    const [
      studentsTotal,
      studentsPaid,
      ledgerNow,
      ledgerPrev,
      studentsNew,
      studentsNewPrev,
      teachersActive,
      teachersPending,
      schedulesCompleted,
      schedulesCancelled,
      schedulesUpcoming,
      txPending,
      examTotal,
      examPassed,
      branches,
      byCourse,
      dayRevenueRows,
      newStudentsByDay,
    ] = await Promise.all([
      Student.countDocuments(bf),
      Student.countDocuments({ ...bf, paid: true }),
      sumFinancialRevenue({ branchId, from: start, to: end }),
      sumFinancialRevenue({ branchId, from: prevStart, to: prevEnd }),
      Student.countDocuments({ ...bf, createdAt: { $gte: start, $lte: end } }),
      Student.countDocuments({ ...bf, createdAt: { $gte: prevStart, $lte: prevEnd } }),
      Teacher.countDocuments({ ...teacherBf, status: { $in: ['Active', 'active'] } }),
      Teacher.countDocuments({ ...teacherBf, status: { $in: ['Pending', 'pending'] } }),
      Schedule.countDocuments({ ...bf, status: 'completed', date: { $gte: start, $lte: end } }),
      Schedule.countDocuments({ ...bf, status: 'cancelled', date: { $gte: start, $lte: end } }),
      Schedule.countDocuments({ ...bf, status: 'scheduled', date: { $gte: end } }),
      Transaction.countDocuments({ status: 'pending' }),
      ExamResult.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      ExamResult.countDocuments({ createdAt: { $gte: start, $lte: end }, passed: true }),
      Branch.find({ isActive: { $ne: false } }).select('name code').lean(),
      revenueByCourseFromLedger({ branchId, from: start, to: end, limit: 8 }),
      listNetRevenueByDay({ branchId, from: start, to: end }),
      Student.aggregate([
        { $match: { ...bf, createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: VN_TZ,
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const refundAmount = ledgerNow.refunds || 0;
    const refundCount = ledgerNow.refundCount || 0;
    // Alias cũ: số giao dịch hoàn trong kỳ
    const studentsUnpaid = refundCount;

    // P0 SoT: doanh thu kỳ = net Ledger (PAYMENT − REFUND)
    const revenuePeriod = ledgerNow.net || 0;
    const revenuePrev = ledgerPrev.net || 0;

    // Bucket ngày theo Asia/Ho_Chi_Minh (khớp listNetRevenueByDay)
    const { vnDateKey } = require('../utils/vnTimezone');
    const dayMap = {};
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    while (cur <= endDay) {
      const key = vnDateKey(cur);
      if (!dayMap[key]) {
        dayMap[key] = {
          label: key,
          students: 0,
          revenue: 0,
        };
      }
      cur.setDate(cur.getDate() + 1);
    }
    (newStudentsByDay || []).forEach((row) => {
      const key = row._id;
      if (!dayMap[key]) return;
      dayMap[key].students += Number(row.count) || 0;
    });
    (dayRevenueRows || []).forEach((row) => {
      const key = row.dateKey;
      if (!dayMap[key]) return;
      dayMap[key].revenue += Number(row.revenue) || 0;
    });
    const trend = Object.values(dayMap);

    const examPassRate = examTotal > 0 ? Math.round((examPassed / examTotal) * 1000) / 10 : null;

    return {
      period,
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      kpis: {
        studentsTotal,
        studentsPaid,
        studentsUnpaid,
        refundAmount,
        refundCount,
        studentsNew,
        studentsNewChange: pctChange(studentsNew, studentsNewPrev),
        revenuePeriod,
        revenueGross: ledgerNow.payments || 0,
        revenueChange: pctChange(revenuePeriod, revenuePrev),
        revenuePrev,
        teachersActive,
        teachersPending,
        schedulesCompleted,
        schedulesCancelled,
        schedulesUpcoming,
        transactionsPending: txPending,
        examTotal,
        examPassed,
        examPassRate,
        paidRate: studentsTotal > 0 ? Math.round((studentsPaid / studentsTotal) * 1000) / 10 : 0,
        paymentsPeriod: ledgerNow.paymentCount || 0,
        costsPeriod: ledgerNow.costs || 0,
        profitPeriod: ledgerNow.profit || 0,
        source: 'ledger',
      },
      byCourse: (byCourse || []).map((c) => ({
        course: c.course || 'Khác',
        count: c.count,
        revenue: c.revenue,
      })),
      trend,
      branches: branches.map((b) => ({ id: b._id, name: b.name, code: b.code })),
      generatedAt: new Date().toISOString(),
    };
  });
}

const { sanitizeCsvField } = require('../shared/utils/csv');

function overviewToCsv(data) {
  const k = data.kpis || {};
  const lines = [
    'metric,value',
    'period,' + data.period,
    'source,' + (k.source || 'ledger'),
    'students_total,' + k.studentsTotal,
    'students_paid,' + k.studentsPaid,
    'students_unpaid,' + k.studentsUnpaid,
    'refund_amount,' + (k.refundAmount ?? 0),
    'refund_count,' + (k.refundCount ?? 0),
    'students_new,' + k.studentsNew,
    'students_new_change_pct,' + k.studentsNewChange,
    'revenue_period_net,' + k.revenuePeriod,
    'revenue_gross,' + (k.revenueGross ?? ''),
    'revenue_change_pct,' + k.revenueChange,
    'teachers_active,' + k.teachersActive,
    'teachers_pending,' + k.teachersPending,
    'schedules_completed,' + k.schedulesCompleted,
    'schedules_cancelled,' + k.schedulesCancelled,
    'exam_pass_rate,' + (k.examPassRate ?? ''),
    'paid_rate,' + k.paidRate,
    'costs_period,' + (k.costsPeriod ?? 0),
    'profit_period,' + (k.profitPeriod ?? 0),
  ];
  lines.push('');
  lines.push('course,count,revenue');
  (data.byCourse || []).forEach((c) => {
    const name = sanitizeCsvField(c.course);
    lines.push(name + ',' + c.count + ',' + c.revenue);
  });
  return lines.join('\n');
}

module.exports = {
  getPeriodRange,
  getOverview,
  overviewToCsv,
};
