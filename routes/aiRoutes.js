const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { policyShadowAi } = require('../middleware/policyShadowAi');
const { aiCutoverGate } = require('../middleware/aiCutoverGate');
const aiService = require('../services/aiService');
const logger = require('../config/logger');
const { sensitiveFlowLimiter } = require('../middleware/authRateLimit');

/**
 * Phase 7.8 — Controlled cutover for /api/ai ONLY.
 *
 * Default / not allowlisted:
 *   auth → policyShadowAi → Legacy isAdmin (via aiCutoverGate) → sensitiveFlowLimiter → handler
 *
 * Opt-in Policy-primary:
 *   POLICY_CUTOVER_ENABLED=true
 *   POLICY_CUTOVER_ROUTES=…,ai
 *
 * Rollback: remove ai from ROUTES (keep prior families) or ENABLED=false.
 * Legacy isAdmin retained inside aiCutoverGate. Limiter order preserved (after authz).
 * Handlers retain all AI provider calls. No invented AI manage-permission taxonomy.
 */
const guard = (action) => [
  authMiddleware,
  policyShadowAi(action),
  aiCutoverGate(action),
  sensitiveFlowLimiter,
];

router.get('/status', guard('status'), async (req, res) => {
  try {
    const data = await aiService.probeHealth();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/quiz', guard('quiz'), async (req, res) => {
  try {
    const { topic, count, subject } = req.body || {};
    const data = await aiService.generateQuiz({ topic, count, subject });
    res.json({ success: true, data });
  } catch (err) {
    logger.warn({ err: err.message }, '[AI] quiz');
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message || 'Loi AI', code: err.code });
  }
});

router.post('/notification-draft', guard('notification_draft'), async (req, res) => {
  try {
    const { purpose, audience, tone } = req.body || {};
    const data = await aiService.draftNotification({ purpose, audience, tone });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/summarize', guard('summarize'), async (req, res) => {
  try {
    const { text, maxWords } = req.body || {};
    const data = await aiService.summarizeText({ text, maxWords });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
});

router.post('/complete', guard('complete'), async (req, res) => {
  try {
    const { prompt, system } = req.body || {};
    const data = await aiService.complete({ prompt, system });
    res.json({ success: true, data });
  } catch (err) {
    const status = err.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
});

module.exports = router;
