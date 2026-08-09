'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { EnrollmentValidator, EnrollmentMapper } = require('../dto');

class EnrollmentController {
  async post_id_enrollments(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Post_id_enrollmentsCommand(EnrollmentValidator.validatePost_id_enrollments(req)));
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
      const result = await commandBus.dispatch(new commands.Put_id_enrollments_enrollmentId_settingsCommand(EnrollmentValidator.validatePut_id_enrollments_enrollmentId_settings(req)));
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
      const result = await commandBus.dispatch(new commands.Put_id_enrollments_enrollmentId_payCommand(EnrollmentValidator.validatePut_id_enrollments_enrollmentId_pay(req)));
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
      const result = await commandBus.dispatch(new commands.Delete_id_enrollments_enrollmentIdCommand(EnrollmentValidator.validateDelete_id_enrollments_enrollmentId(req)));
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
