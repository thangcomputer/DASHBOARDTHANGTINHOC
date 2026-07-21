const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../config/logger');
const { sensitiveFlowLimiter } = require('../middleware/authRateLimit');

const guard = [authMiddleware, isAdmin, sensitiveFlowLimiter];

router.get('/status', guard, (req, res) => {
  res.json({ success: true, data: aiService.getStatus() });
});

router.post('/quiz', guard, async (req, res) => {
  try {
    const { topic, count, subject } = req.body || {};
    const data = await aiService.generateQuiz({ topic, count, subject });
    res.json({ success: true, data });
  } catch (err) {
    logger.warn({ err: err.message }, '[AI] quiz');
    res.status(err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/notification-draft', guard, async (req, res) => {
  try {
    const { purpose, audience, tone } = req.body || {};
    const data = await aiService.draftNotification({ purpose, audience, tone });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/summarize', guard, async (req, res) => {
  try {
    const { text, maxWords } = req.body || {};
    const data = await aiService.summarizeText({ text, maxWords });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/complete', guard, async (req, res) => {
  try {
    const { prompt, system } = req.body || {};
    const data = await aiService.complete({ prompt, system });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message, code: err.code });
  }
});

module.exports = router;