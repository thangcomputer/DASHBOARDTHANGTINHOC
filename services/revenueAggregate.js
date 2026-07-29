/**
 * Enrollment revenue helpers — projection / legacy.
 * P4: KPI doanh thu chính KHÔNG dùng file này khi FINANCE_LEDGER_SOT=true (mặc định).
 * Dùng services/ledgerService.sumFinancialRevenue cho Dashboard/BI/Analytics.
 * Các hàm dưới đây phục vụ breakdown theo khóa / danh sách thu còn hiệu lực.
 */
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { isLedgerSot } = require('../utils/financeFlags');
const logger = require('../config/logger');

let _warnedDeprecation = false;
function warnIfLegacyKpi(caller) {
  if (!isLedgerSot() || _warnedDeprecation) return;
  _warnedDeprecation = true;
  logger.warn(
    '[revenueAggregate] DEPRECATED for KPI SoT (caller=%s). Use ledgerService.sumFinancialRevenue. Set FINANCE_LEDGER_SOT=false to silence.',
    caller || 'unknown'
  );
}

function toObjectIdMaybe(value) {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
}

function normalizeBranchMatch(branchFilter = {}) {
  const match = { ...branchFilter };
  if (match.branchId) match.branchId = toObjectIdMaybe(match.branchId);
  return match;
}

function moneyExpr(input) {
  return {
    $convert: {
      input: { $ifNull: [input, 0] },
      to: 'double',
      onError: 0,
      onNull: 0,
    },
  };
}

/** Unwind → flat payment lines: amount, courseName, paidAt, studentId, ...
 * P0: loại cancelled/refunded khỏi KPI enrollment (Ledger mới là SoT doanh thu thuần).
 */
function expandPaidItemsStages() {
  return [
    {
      $addFields: {
        _paidItems: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$enrollments', []] } }, 0] },
            {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ['$enrollments', []] },
                    as: 'e',
                    cond: {
                      $and: [
                        { $eq: ['$$e.paid', true] },
                        { $ne: ['$$e.status', 'cancelled'] },
                        { $ne: ['$$e.status', 'refunded'] },
                      ],
                    },
                  },
                },
                as: 'e',
                in: {
                  amount: moneyExpr('$$e.price'),
                  courseName: { $ifNull: ['$$e.courseName', 'Khác'] },
                  paidAt: {
                    $ifNull: ['$$e.paidAt', { $ifNull: ['$paidAt', '$updatedAt'] }],
                  },
                },
              },
            },
            {
              $cond: [
                { $eq: ['$paid', true] },
                [
                  {
                    amount: {
                      $cond: [
                        { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] },
                        moneyExpr('$paidAmount'),
                        moneyExpr('$price'),
                      ],
                    },
                    courseName: { $ifNull: ['$course', 'Khác'] },
                    paidAt: { $ifNull: ['$paidAt', '$updatedAt'] },
                  },
                ],
                [],
              ],
            },
          ],
        },
      },
    },
    { $unwind: { path: '$_paidItems', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        _id: 0,
        studentId: '$_id',
        studentName: '$name',
        branchId: '$branchId',
        branchCode: { $ifNull: ['$branchCode', ''] },
        amount: '$_paidItems.amount',
        courseName: '$_paidItems.courseName',
        paidAt: '$_paidItems.paidAt',
        createdAt: '$createdAt',
      },
    },
  ];
}

function paidItemsPipeline({ branchFilter = {}, start, end } = {}) {
  const pipeline = [
    { $match: normalizeBranchMatch(branchFilter) },
    ...expandPaidItemsStages(),
  ];
  if (start && end) {
    pipeline.push({ $match: { paidAt: { $gte: start, $lte: end } } });
  }
  return pipeline;
}

async function sumPaidRevenue({ branchFilter = {}, start, end } = {}) {
  warnIfLegacyKpi('sumPaidRevenue');
  const rows = await Student.aggregate([
    ...paidItemsPipeline({ branchFilter, start, end }),
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
        studentIds: { $addToSet: '$studentId' },
      },
    },
  ]);
  const row = rows[0];
  return {
    total: row?.total || 0,
    paymentCount: row?.paymentCount || 0,
    paidStudentsCount: Array.isArray(row?.studentIds) ? row.studentIds.length : 0,
  };
}

async function listPaidItems({ branchFilter = {}, start, end } = {}) {
  return Student.aggregate(paidItemsPipeline({ branchFilter, start, end }));
}

async function revenueByCourse({ branchFilter = {}, start, end, limit = 8 } = {}) {
  const pipeline = [
    ...paidItemsPipeline({ branchFilter, start, end }),
    {
      $group: {
        _id: '$courseName',
        count: { $sum: 1 },
        revenue: { $sum: '$amount' },
        studentIds: { $addToSet: '$studentId' },
      },
    },
    {
      $project: {
        _id: 0,
        course: { $ifNull: ['$_id', 'Khác'] },
        count: { $size: '$studentIds' },
        enrollments: '$count',
        revenue: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ];
  if (limit > 0) pipeline.push({ $limit: limit });
  return Student.aggregate(pipeline);
}

async function revenueByBranch({ branchFilter = {}, start, end } = {}) {
  return Student.aggregate([
    ...paidItemsPipeline({ branchFilter, start, end }),
    {
      $group: {
        _id: { $ifNull: ['$branchId', 'unknown'] },
        branchCode: { $first: '$branchCode' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        studentIds: { $addToSet: '$studentId' },
      },
    },
    {
      $project: {
        _id: 0,
        branchId: { $toString: '$_id' },
        branchCode: {
          $cond: [
            { $or: [{ $eq: ['$branchCode', ''] }, { $eq: ['$branchCode', null] }] },
            'Không xác định',
            '$branchCode',
          ],
        },
        total: 1,
        count: { $size: '$studentIds' },
        paymentCount: '$count',
      },
    },
    { $sort: { total: -1 } },
  ]);
}

/** Tổng học phí đã thanh toán của 1 học viên (đồng bộ Chi tiết HV). */
function sumStudentPaidTuition(student) {
  if (!student) return 0;
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  if (enrollments.length > 0) {
    return enrollments
      .filter((e) => e && e.paid === true)
      .reduce((s, e) => s + (Number(e.price) || 0), 0);
  }
  if (!student.paid) return 0;
  const paidAmount = Number(student.paidAmount) || 0;
  if (paidAmount > 0) return paidAmount;
  return Number(student.price) || 0;
}

module.exports = {
  expandPaidItemsStages,
  paidItemsPipeline,
  sumPaidRevenue,
  listPaidItems,
  revenueByCourse,
  revenueByBranch,
  sumStudentPaidTuition,
  normalizeBranchMatch,
};
