/**
 * BI service — executive KPIs, so sanh ky truoc, breakdown.
 * Cache 90s (Phase 5).
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Transaction = require('../models/Transaction');
const ExamResult = require('../models/ExamResult');
const Branch = require('../models/Branch');
const cache = require('../utils/cache');

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
  if (queryBranch && queryBranch !== 'all' && !filter.branchId) {
    filter.branchId = queryBranch;
  }
  return filter;
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function sumStudentRevenue(match) {
  const rows = await Student.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{ $gt: ['$paidAmount', 0] }, '$paidAmount', '$price'],
          },
        },
      },
    },
  ]);
  return rows[0]?.total || 0;
}

async function getOverview({ period = '1m', branchFilter = {}, queryBranch = 'all' } = {}) {
  const bf = buildBranchFilter(branchFilter, queryBranch);
  const cacheKey = 'bi:overview:' + period + ':' + (bf.branchId || queryBranch || 'all');

  return cache.wrap(cacheKey, 90, async () => {
    const { start, end, prevStart, prevEnd } = getPeriodRange(period);
    const teacherBf = { ...bf, role: 'teacher' };

    const [
      studentsTotal,
      studentsPaid,
      studentsUnpaid,
      studentsNew,
      studentsNewPrev,
      revenuePeriod,
      revenuePrev,
      teachersActive,
      teachersPending,
      schedulesCompleted,
      schedulesCancelled,
      schedulesUpcoming,
      txPending,
      examTotal,
      examPassed,
      branches,
    ] = await Promise.all([
      Student.countDocuments(bf),
      Student.countDocuments({ ...bf, paid: true }),
      Student.countDocuments({ ...bf, paid: false }),
      Student.countDocuments({ ...bf, createdAt: { $gte: start, $lte: end } }),
      Student.countDocuments({ ...bf, createdAt: { $gte: prevStart, $lte: prevEnd } }),
      sumStudentRevenue({ ...bf, paid: true, $or: [
        { paidAt: { $gte: start, $lte: end } },
        { paidAt: null, updatedAt: { $gte: start, $lte: end } },
      ]}),
      sumStudentRevenue({ ...bf, paid: true, $or: [
        { paidAt: { $gte: prevStart, $lte: prevEnd } },
        { paidAt: null, updatedAt: { $gte: prevStart, $lte: prevEnd } },
      ]}),
      Teacher.countDocuments({ ...teacherBf, status: { $in: ['Active', 'active'] } }),
      Teacher.countDocuments({ ...teacherBf, status: { $in: ['Pending', 'pending'] } }),
      Schedule.countDocuments({ ...bf, status: 'completed', date: { $gte: start, $lte: end } }),
      Schedule.countDocuments({ ...bf, status: 'cancelled', date: { $gte: start, $lte: end } }),
      Schedule.countDocuments({ ...bf, status: 'scheduled', date: { $gte: end } }),
      Transaction.countDocuments({ status: 'pending' }),
      ExamResult.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      ExamResult.countDocuments({ createdAt: { $gte: start, $lte: end }, passed: true }),
      Branch.find({ isActive: { $ne: false } }).select('name code').lean(),
    ]);

    // Revenue by course (period new paid students)
    const byCourse = await Student.aggregate([
      {
        $match: {
          ...bf,
          paid: true,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$course',
          count: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $gt: ['$paidAmount', 0] }, '$paidAmount', '$price'] },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]);

    // Daily new students sparkline
    const newStudents = await Student.find({
      ...bf,
      createdAt: { $gte: start, $lte: end },
    }).select('createdAt price paid').lean();

    const dayMap = {};
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    while (cur <= endDay) {
      dayMap[cur.toISOString().slice(0, 10)] = { label: cur.toISOString().slice(0, 10), students: 0, revenue: 0 };
      cur.setDate(cur.getDate() + 1);
    }
    newStudents.forEach((s) => {
      const key = new Date(s.createdAt).toISOString().slice(0, 10);
      if (!dayMap[key]) return;
      dayMap[key].students += 1;
      if (s.paid) dayMap[key].revenue += s.price || 0;
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
        studentsNew,
        studentsNewChange: pctChange(studentsNew, studentsNewPrev),
        revenuePeriod,
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
      },
      byCourse: byCourse.map((c) => ({
        course: c._id || 'Khac',
        count: c.count,
        revenue: c.revenue,
      })),
      trend,
      branches: branches.map((b) => ({ id: b._id, name: b.name, code: b.code })),
      generatedAt: new Date().toISOString(),
    };
  });
}

function overviewToCsv(data) {
  const k = data.kpis || {};
  const lines = [
    'metric,value',
    'period,' + data.period,
    'students_total,' + k.studentsTotal,
    'students_paid,' + k.studentsPaid,
    'students_unpaid,' + k.studentsUnpaid,
    'students_new,' + k.studentsNew,
    'students_new_change_pct,' + k.studentsNewChange,
    'revenue_period,' + k.revenuePeriod,
    'revenue_change_pct,' + k.revenueChange,
    'teachers_active,' + k.teachersActive,
    'teachers_pending,' + k.teachersPending,
    'schedules_completed,' + k.schedulesCompleted,
    'schedules_cancelled,' + k.schedulesCancelled,
    'exam_pass_rate,' + (k.examPassRate ?? ''),
    'paid_rate,' + k.paidRate,
  ];
  lines.push('');
  lines.push('course,count,revenue');
  (data.byCourse || []).forEach((c) => {
    const name = String(c.course || '').replace(/,/g, ' ');
    lines.push(name + ',' + c.count + ',' + c.revenue);
  });
  return lines.join('\n');
}

module.exports = {
  getPeriodRange,
  getOverview,
  overviewToCsv,
};