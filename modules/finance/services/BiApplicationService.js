'use strict';
const biService = require('./biService');
const logger = require('./../../../config/logger');

class BiApplicationService {
  async get_overview(data) {
  try {
    const overview = await biService.getOverview({
      period: data.period || '1m',
      branchFilter: data.branchFilter || {},
      queryBranch: data.branchId || 'all',
    });
    return { _status: 200, _body: { success: true, data: overview } };
  } catch (err) {
    logger.error('[BI] overview:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Loi server' } };
  }
}

  async get_export(data) {
  try {
    const overview = await biService.getOverview({
      period: data.period || '1m',
      branchFilter: data.branchFilter || {},
      queryBranch: data.branchId || 'all',
    });
    const csv = biService.overviewToCsv(overview);
    return {
      _status: 200,
      _isSend: true,
      _headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bi-overview-' + (data.period || '1m') + '.csv"',
      },
      _body: '\uFEFF' + csv,
    };
  } catch (err) {
    logger.error('[BI] export:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Loi server' } };
  }
}

}

module.exports = new BiApplicationService();
