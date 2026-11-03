'use strict';
const { queryBus } = require('../../../shared/cqrs');
const queries = require('../queries');

class AnalyticsController {
  async get_revenue(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_revenueQuery({
        query: req.query,
        branchFilter: req.branchFilter,
      }));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_enrollment(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_enrollmentQuery({
        query: req.query,
        branchFilter: req.branchFilter,
      }));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_branches(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_branchesQuery({
        query: req.query,
        branchFilter: req.branchFilter,
      }));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new AnalyticsController();
