'use strict';
const aiService = require('./aiService');
const logger = require('./../../../config/logger');

class AiApplicationService {
  async get_status() {
    try {
      const result = await aiService.probeHealth();
      return { _status: 200, _body: { success: true, data: result } };
    } catch (err) {
      logger.error({ err: err.message }, '[AI] status');
      return { _status: 500, _body: { success: false, message: err.message } };
    }
  }

  async post_quiz(request) {
    try {
      const { topic, count, subject } = request.body || {};
      const result = await aiService.generateQuiz({ topic, count, subject });
      return { _status: 200, _body: { success: true, data: result } };
    } catch (err) {
      logger.warn({ err: err.message }, '[AI] quiz');
      const status = err.status === 400 ? 400 : 500;
      return { _status: status, _body: { success: false, message: err.message || 'Lỗi AI', code: err.code } };
    }
  }

  async post_notification_draft(request) {
    try {
      const { purpose, audience, tone } = request.body || {};
      const result = await aiService.draftNotification({ purpose, audience, tone });
      return { _status: 200, _body: { success: true, data: result } };
    } catch (err) {
      const status = err.status === 400 ? 400 : 500;
      return { _status: status, _body: { success: false, message: err.message, code: err.code } };
    }
  }

  async post_summarize(request) {
    try {
      const { text, maxWords } = request.body || {};
      const result = await aiService.summarizeText({ text, maxWords });
      return { _status: 200, _body: { success: true, data: result } };
    } catch (err) {
      const status = err.status === 400 ? 400 : 500;
      return { _status: status, _body: { success: false, message: err.message, code: err.code } };
    }
  }

  async post_complete(request) {
    try {
      const { prompt, system } = request.body || {};
      const result = await aiService.complete({ prompt, system });
      return { _status: 200, _body: { success: true, data: result } };
    } catch (err) {
      const status = err.status === 400 ? 400 : 500;
      return { _status: status, _body: { success: false, message: err.message, code: err.code } };
    }
  }
}

module.exports = new AiApplicationService();
