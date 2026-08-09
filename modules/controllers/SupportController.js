'use strict';
const supportApplicationService = require('../services/SupportApplicationService');

class SupportController {
  async get_agents(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.get_agents(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

  async get_teams(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.get_teams(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

  async get_conversations(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.get_conversations(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

  async get_messages(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.get_messages(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

  async post_assignments(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.post_assignments(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

  async put_presence(req, res) {
    try {
      const data = {
        body: req.body, query: req.query, params: req.params, headers: req.headers,
        currentUser: req.currentUser, user: req.user, file: req.file, files: req.files,
        ip: req.ip, app: req.app, _res: res,
      };
      const result = await supportApplicationService.put_presence(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server' });
    }
  }

}

module.exports = new SupportController();
