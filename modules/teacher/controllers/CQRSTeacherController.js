'use strict';
require('../commands'); // register CreateTeacherHandler (+ other teacher commands)
const { commandBus } = require('../../../shared/cqrs');
const CreateTeacherCommand = require('../commands/CreateTeacherCommand');

class CQRSTeacherController {
  async post_root(req, res) {
    try {
      const data = {
        body: req.body,
        userBranchId: req.userBranchId,
        userBranchCode: req.userBranchCode,
        // Auth middleware sets req.user; some scripts pass req.currentUser
        currentUser: req.currentUser || req.user,
        app: req.app,
        ip: req.ip,
        headers: req.headers,
      };

      const command = new CreateTeacherCommand(data);
      const result = await commandBus.dispatch(command);

      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }
}

module.exports = new CQRSTeacherController();
