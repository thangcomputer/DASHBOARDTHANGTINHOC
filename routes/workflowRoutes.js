const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const workflowService = require('../services/workflowService');
const logger = require('../config/logger');

const guard = [authMiddleware, isAdmin];

router.get('/definitions', guard, (req, res) => {
  res.json({ success: true, data: workflowService.listDefinitions() });
});

router.get('/', guard, async (req, res) => {
  try {
    if (req.query.sync === '1' || req.query.sync === 'true') {
      await workflowService.syncFromDomain();
    }
    const result = await workflowService.listInstances({
      status: req.query.status || 'open',
      definitionKey: req.query.definitionKey,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Workflow] list:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', guard, async (req, res) => {
  try {
    const data = await workflowService.syncFromDomain();
    res.json({ success: true, message: 'Da dong bo ' + data.created + ' workflow', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', guard, async (req, res) => {
  try {
    const data = await workflowService.getInstance(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/', guard, async (req, res) => {
  try {
    const { definitionKey, entityId, entityLabel, title, payload } = req.body || {};
    const instance = await workflowService.start({
      definitionKey,
      entityId,
      entityLabel,
      title,
      payload,
      createdBy: String(req.user.id || ''),
    });
    res.status(201).json({ success: true, data: instance });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/:id/advance', guard, async (req, res) => {
  try {
    const { action, note } = req.body || {};
    if (!action) {
      return res.status(400).json({ success: false, message: 'Thieu action' });
    }
    const io = req.app.get('io');
    const instance = await workflowService.advance(
      req.params.id,
      { action, note },
      req.user,
      io,
    );
    res.json({ success: true, message: 'Da cap nhat workflow', data: instance });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;