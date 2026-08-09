'use strict';
const { commandBus, queryBus } = require('../../../shared/cqrs');
const commands = require('../commands');
const queries = require('../queries');

const { AttendanceValidator, AttendanceMapper } = require('../dto');

class AttendanceController {
  async get_root(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_rootQuery(data));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_stats(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_statsQuery(data));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_teacher_teacherId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_teacher_teacherIdQuery(AttendanceValidator.validateGet_teacher_teacherId(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_student_studentId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_student_studentIdQuery(AttendanceValidator.validateGet_student_studentId(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_root(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Post_rootCommand(data));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async put_scheduleId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Put_scheduleIdCommand(AttendanceValidator.validatePut_scheduleId(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async delete_scheduleId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Delete_scheduleIdCommand(AttendanceValidator.validateDelete_scheduleId(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async patch_scheduleId_cancel(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await commandBus.dispatch(new commands.Patch_scheduleId_cancelCommand(AttendanceValidator.validatePatch_scheduleId_cancel(req)));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_history_teacherId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await queryBus.dispatch(new queries.Get_history_teacherIdQuery(data));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new AttendanceController();
