'use strict';
const proctorApplicationService = require('../services/ProctorApplicationService');

const { ProctorValidator, ProctorMapper } = require('../dto');

class ProctorController {
  async post_events(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await proctorApplicationService.post_events(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_events_me(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await proctorApplicationService.get_events_me(ProctorValidator.validateGet_events_me(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_events_userId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await proctorApplicationService.get_events_userId(ProctorValidator.validateGet_events_userId(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new ProctorController();
