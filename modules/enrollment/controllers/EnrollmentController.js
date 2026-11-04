'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { EnrollmentValidator, EnrollmentMapper } = require('../dto');

function validateInput(req, validator) {
  return {
    ...validator(req),
    body: req.body,
    query: req.query,
    params: req.params,
    currentUser: req.currentUser,
    headers: req.headers,
    ip: req.ip,
    app: req.app,
  };
}

class EnrollmentController {
  async post_id_enrollments(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Post_id_enrollmentsCommand(validateInput(req, EnrollmentValidator.validatePost_id_enrollments)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async put_id_enrollments_enrollmentId_settings(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Put_id_enrollments_enrollmentId_settingsCommand(validateInput(req, EnrollmentValidator.validatePut_id_enrollments_enrollmentId_settings)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async put_id_enrollments_enrollmentId_pay(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Put_id_enrollments_enrollmentId_payCommand(validateInput(req, EnrollmentValidator.validatePut_id_enrollments_enrollmentId_pay)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async delete_id_enrollments_enrollmentId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Delete_id_enrollments_enrollmentIdCommand(validateInput(req, EnrollmentValidator.validateDelete_id_enrollments_enrollmentId)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }


}

module.exports = new EnrollmentController();
