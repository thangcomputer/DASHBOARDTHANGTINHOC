'use strict';
const feedApplicationService = require('../services/FeedApplicationService');

const { FeedValidator, FeedMapper } = require('../dto');

class FeedController {
  async post_upload(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.post_upload(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async get_root(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.get_root(FeedValidator.validateGet_root(req));
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
      const result = await feedApplicationService.post_root(FeedValidator.validatePost_root(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async delete_id(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.delete_id(FeedValidator.validateDelete_id(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_id_like(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.post_id_like(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_id_react(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.post_id_react(data);
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async post_id_comments(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.post_id_comments(FeedValidator.validatePost_id_comments(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

  async delete_id_comments_commentId(req, res) {
    try {
      // Replaced by Zod Validator
      const result = await feedApplicationService.delete_id_comments_commentId(FeedValidator.validateDelete_id_comments_commentId(req));
      if (!result) return;
      if (result._isSend) return res.status(result._status ?? 200).send(result._body);
      return res.status(result._status ?? 200).json(result._body);
    } catch (err) {
      const status = err.status || err.statusCode || (err.code === 'VALIDATION_ERROR' ? 400 : 500);
      return res.status(status).json({ success: false, message: err.message || 'Lỗi server', errors: err.errors });
    }
  }

}

module.exports = new FeedController();
