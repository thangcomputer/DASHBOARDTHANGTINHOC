const express = require('express');
const TeachingGuide = require('../models/TeachingGuide');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../config/logger');
const { policyShadowTrainingLms } = require('../middleware/policyShadowTrainingLms');
const { trainingCutoverGate } = require('../middleware/trainingCutoverGate');

const router = express.Router();

/**
 * LIVE mount: server.js → app.use('/api/training', teachingGuideRoutes)
 *
 * Phase 7.12 — Controlled cutover for /api/training ONLY (not /api/training-lms).
 * Legacy: authMiddleware only (any authenticated role). Data filter: isActive + category.
 * Flow: auth → policyShadowTrainingLms(guide_list) → trainingCutoverGate → handler
 */
router.get('/', [
  authMiddleware,
  policyShadowTrainingLms('guide_list'),
  trainingCutoverGate('guide_list'),
], async (req, res) => {
  try {
    const filter = { isActive: true };
    // Nếu có category lọc
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const guides = await TeachingGuide.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: guides });
  } catch (error) {
    logger.error('[TRAINING] Get all error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
