const BaseRepository = require('../../../shared/repositories/BaseRepository');
const { studentRepository } = require('../../student/repositories');

class AnalyticsRepository extends BaseRepository {
  constructor() {
    super(null); // No direct model for AnalyticsRepository
  }

  // --- REVENUE AGGREGATION FROM STUDENT DOMAIN (LEGACY KPIs) ---
  
  _expandPaidItemsStages() {
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
                    amount: {
                      $convert: { input: { $ifNull: ['$$e.price', 0] }, to: 'double', onError: 0, onNull: 0 }
                    },
                    courseName: { $ifNull: ['$$e.courseName', 'Khác'] },
                    paidAt: { $ifNull: ['$$e.paidAt', { $ifNull: ['$paidAt', '$updatedAt'] }] },
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
                          { $convert: { input: { $ifNull: ['$paidAmount', 0] }, to: 'double', onError: 0, onNull: 0 } },
                          { $convert: { input: { $ifNull: ['$price', 0] }, to: 'double', onError: 0, onNull: 0 } },
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

  _paidItemsPipeline({ branchFilter = {}, start, end } = {}) {
    const pipeline = [
      { $match: branchFilter },
      ...this._expandPaidItemsStages(),
    ];
    if (start && end) {
      pipeline.push({ $match: { paidAt: { $gte: start, $lte: end } } });
    }
    return pipeline;
  }

  async sumPaidRevenue({ branchFilter = {}, start, end } = {}) {
    const pipeline = [
      ...this._paidItemsPipeline({ branchFilter, start, end }),
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          studentIds: { $addToSet: '$studentId' },
        },
      },
    ];
    const rows = await studentRepository.aggregate(pipeline);
    const row = rows[0];
    return {
      total: row?.total || 0,
      paymentCount: row?.paymentCount || 0,
      paidStudentsCount: Array.isArray(row?.studentIds) ? row.studentIds.length : 0,
    };
  }

  async listPaidItems({ branchFilter = {}, start, end } = {}) {
    return studentRepository.aggregate(this._paidItemsPipeline({ branchFilter, start, end }));
  }

  async revenueByCourse({ branchFilter = {}, start, end, limit = 8 } = {}) {
    const pipeline = [
      ...this._paidItemsPipeline({ branchFilter, start, end }),
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
    return studentRepository.aggregate(pipeline);
  }

  async revenueByBranch({ branchFilter = {}, start, end } = {}) {
    return studentRepository.aggregate([
      ...this._paidItemsPipeline({ branchFilter, start, end }),
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
}

module.exports = new AnalyticsRepository();
