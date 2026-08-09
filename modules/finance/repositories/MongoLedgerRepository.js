const LedgerRepository = require('./LedgerRepository');
const LedgerEntry = require('../models/LedgerEntry');

class MongoLedgerRepository extends LedgerRepository {
  constructor() {
    super(LedgerEntry);
  }

  async aggregateTotalsByType(match) {
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async aggregateTotalsByDateAndBranch(match) {
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$postedAt' } },
            branchId: '$branchId',
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async aggregateRevenueByCourse(match, limit) {
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$courseName', 'Khác'] },
          payments: {
            $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
          },
          refunds: {
            $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] },
          },
          paymentCount: {
            $sum: { $cond: [{ $eq: ['$type', 'payment'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          course: '$_id',
          count: '$paymentCount',
          revenue: { $subtract: ['$payments', '$refunds'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: Math.max(1, Number(limit) || 8) },
    ]);
  }

  async aggregateNetRevenueByDay(match) {
    return this.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$postedAt' } },
          payments: {
            $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] },
          },
          refunds: {
            $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: { $subtract: ['$payments', '$refunds'] },
        },
      },
      { $sort: { date: 1 } },
    ]);
  }
}

module.exports = MongoLedgerRepository;
