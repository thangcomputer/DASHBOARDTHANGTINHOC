'use strict';
const biService = require('./biService');
const logger = require('./../../../config/logger');

// Cùng quyền với Báo cáo doanh thu / analytics
const guard = [
  authMiddleware,
  authorize(NEW_PERMISSIONS.FINANCE_VIEW),
  branchFilter,
];

class BiApplicationService {
  async get_overview(data) {
  try {
    const data = await biService.getOverview({
      period: data.period || '1m',
      branchFilter: data.branchFilter || {},
      queryBranch: data.branchId || 'all',
    });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[BI] overview:', err);
    return { _status: 500, _body: ({ success: false, message: err.message || 'Loi server' });
  }
}

  async get_export(data) {
  try {
    const data = await biService.getOverview({
      period: data.period || '1m',
      branchFilter: data.branchFilter || {},
      queryBranch: data.branchId || 'all',
    });
    const csv = biService.overviewToCsv(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bi-overview-' + (data.period || '1m') + '.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    logger.error('[BI] export:', err);
    return { _status: 500, _body: ({ success: false, message: err.message || 'Loi server' });
  }
}

}

module.exports = new BiApplicationService();
