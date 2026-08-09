'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { BiValidator, BiMapper } = require('../dto');

class BiController {
  async get_overview(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_overviewQuery(BiValidator.validateGet_overview(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_export(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_exportQuery(BiValidator.validateGet_export(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new BiController();
