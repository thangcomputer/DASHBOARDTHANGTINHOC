'use strict';
const teachingGuideApplicationService = require('../services/TeachingGuideApplicationService');

const { TeachingGuideValidator, TeachingGuideMapper } = require('../dto');

class TeachingGuideController {
  async get_root(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await teachingGuideApplicationService.get_root(TeachingGuideValidator.validateGet_root(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new TeachingGuideController();
