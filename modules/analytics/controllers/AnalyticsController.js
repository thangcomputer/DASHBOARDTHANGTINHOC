'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { AnalyticsValidator, AnalyticsMapper } = require('../dto');

class AnalyticsController {
  async get_revenue(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_revenueQuery(data));
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
      const result = await queryBus.dispatch(new queries.Get_enrollmentQuery(data));
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
      const result = await queryBus.dispatch(new queries.Get_branchesQuery(data));
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
