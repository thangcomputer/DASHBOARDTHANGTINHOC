'use strict';
const aiService = require('./aiService');
const logger = require('./../../../config/logger');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), sensitiveFlowLimiter];

class AiApplicationService {
  async get_status(data) {
  try {
    const data = await aiService.probeHealth();
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_quiz(data) {
  try {
    const { topic, count, subject } = data.body || {};
    const data = await aiService.generateQuiz({ topic, count, subject });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.warn({ err: err.message }, '[AI] quiz');
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message || 'Loi AI', code: err.code });
  }
}

  async post_notification_draft(data) {
  try {
    const { purpose, audience, tone } = data.body || {};
    const data = await aiService.draftNotification({ purpose, audience, tone });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

  async post_summarize(data) {
  try {
    const { text, maxWords } = data.body || {};
    const data = await aiService.summarizeText({ text, maxWords });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

  async post_complete(data) {
  try {
    const { prompt, system } = data.body || {};
    const data = await aiService.complete({ prompt, system });
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

}

module.exports = new AiApplicationService();
