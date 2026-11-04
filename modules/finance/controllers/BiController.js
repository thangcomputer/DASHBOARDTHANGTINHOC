'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { BiValidator, BiMapper } = require('../dto');

function validateInput(req, validator) {
  return {
    ...validator(req),
    branchFilter: req.branchFilter,
  };
}

class BiController {
  async get_overview(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_overviewQuery(validateInput(req, BiValidator.validateGet_overview)));
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
      const result = await queryBus.dispatch(new queries.Get_exportQuery(validateInput(req, BiValidator.validateGet_export)));
      if (!result) return;
      if (result._headers) {
        Object.entries(result._headers).forEach(([name, value]) => res.setHeader(name, value));
      }
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new BiController();
