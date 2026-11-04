'use strict';
const financeApplicationService = require('../services/FinanceApplicationService');

const { FinanceValidator, FinanceMapper } = require('../dto');

function validateInput(req, validator) {
  return {
    ...validator(req),
    body: req.body,
    query: req.query,
    params: req.params,
    branchFilter: req.branchFilter,
    currentUser: req.currentUser,
  };
}

class FinanceController {
  async get_summary(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.get_summary(validateInput(req, FinanceValidator.validateGet_summary));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_ledger(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.get_ledger(validateInput(req, FinanceValidator.validateGet_ledger));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_students_id(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.get_students_id(validateInput(req, FinanceValidator.validateGet_students_id));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_ledger_id_void(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.post_ledger_id_void(validateInput(req, FinanceValidator.validatePost_ledger_id_void));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_discount(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.post_discount(req);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_reconcile(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.get_reconcile(validateInput(req, FinanceValidator.validateGet_reconcile));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_snapshots_rebuild(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.post_snapshots_rebuild(validateInput(req, FinanceValidator.validatePost_snapshots_rebuild));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_students_id_sync_cache(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await financeApplicationService.post_students_id_sync_cache(validateInput(req, FinanceValidator.validatePost_students_id_sync_cache));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new FinanceController();
