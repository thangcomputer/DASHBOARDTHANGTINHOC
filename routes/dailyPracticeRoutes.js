'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const logger = require('../config/logger');
const service = require('../services/dailyPracticeService');
const pathService = require('../services/dailyPracticePathService');
const aiService = require('../services/dailyPracticeAi');
const starter = require('../services/dailyPracticeStarter');

const requireAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENT_TRAINING)];

function requireStudentRole(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được dùng chức năng này' });
  }
  return next();
}

const requireStudent = [authMiddleware, requireStudentRole];
const userId = (req) => req.user.id || req.user._id;

function sendError(res, err) {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code || undefined });
  }
  logger.error('[DAILY_PRACTICE]', err);
  return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
}

const handle = (fn) => async (req, res) => {
  try {
    return res.json({ success: true, data: await fn(req) });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/topics', ...requireAdmin, handle(() => service.listTopics({ includeInactive: true })));
router.post('/topics', ...requireAdmin, handle((req) => service.createTopic(req.body || {})));
router.put('/topics/:id', ...requireAdmin, handle((req) => service.updateTopic(req.params.id, req.body || {})));
router.delete('/topics/:id', ...requireAdmin, handle((req) => service.deleteTopic(req.params.id)));
router.post('/topics/:id/publish-drafts', ...requireAdmin, handle((req) => service.publishDrafts(req.params.id)));
router.post('/starter', ...requireAdmin, handle(() => starter.installStarterContent()));
router.get('/xp-packs', ...requireAdmin, handle(() => service.listXpPacks()));
router.put('/xp-packs', ...requireAdmin, handle((req) => service.saveXpPackPrices(req.body?.prices || {})));

// Chặng lộ trình
router.get('/topics/:id/units', ...requireAdmin, handle((req) => pathService.listUnits(req.params.id)));
router.post('/topics/:id/units', ...requireAdmin, handle((req) => pathService.createUnit(req.params.id, req.body || {})));
router.put('/topics/:id/units/order', ...requireAdmin, handle((req) => pathService.reorderUnits(req.params.id, req.body?.unitIds)));
router.post('/topics/:id/units/assign-unassigned', ...requireAdmin, handle((req) => pathService.assignUnassigned(req.params.id, {
  unitId: String(req.body?.unitId || ''),
  title: String(req.body?.title || ''),
})));
router.put('/units/:id', ...requireAdmin, handle((req) => pathService.updateUnit(req.params.id, req.body || {})));
router.delete('/units/:id', ...requireAdmin, handle((req) => pathService.deleteUnit(req.params.id)));

router.get('/questions', ...requireAdmin, handle((req) => service.listQuestions({
  topicId: req.query.topicId,
  difficulty: req.query.difficulty,
  type: req.query.type,
  status: req.query.status,
  unitId: req.query.unitId,
})));
router.post('/questions', ...requireAdmin, handle((req) => service.createQuestion(req.body || {}, userId(req))));
router.post('/questions/ai-generate', ...requireAdmin, handle((req) => aiService.generateDrafts(req.body || {}, userId(req))));
router.put('/questions/:id', ...requireAdmin, handle((req) => service.updateQuestion(req.params.id, req.body || {})));
router.delete('/questions/:id', ...requireAdmin, handle((req) => service.deleteQuestion(req.params.id)));

// ── Học viên (web + mobile dùng chung) ────────────────────────────────────────
router.get('/my/overview', ...requireStudent, handle((req) => service.getOverview(userId(req))));
router.get('/my/path', ...requireStudent, handle((req) => pathService.getPath(userId(req))));
router.get('/my/path/units/:unitId/videos', ...requireStudent, handle((req) => pathService.unitVideos(userId(req), req.params.unitId)));
router.post('/my/path/units/:unitId/videos/:videoId/checks/:checkId/answer', ...requireStudent, handle((req) => pathService.answerVideoCheck(userId(req), {
  unitId: req.params.unitId,
  videoId: decodeURIComponent(req.params.videoId),
  checkId: req.params.checkId,
  choiceIndex: req.body?.choiceIndex,
  text: req.body?.text,
  imageDataUrl: req.body?.imageDataUrl,
})));
router.post('/my/path/units/:unitId/videos/:videoId/checks/:checkId/hint', ...requireStudent, handle((req) => pathService.buyVideoHint(userId(req), {
  unitId: req.params.unitId,
  videoId: decodeURIComponent(req.params.videoId),
  checkId: req.params.checkId,
})));
router.post('/my/path/videos/watched', ...requireStudent, handle((req) => pathService.markVideoWatched(userId(req), {
  unitId: req.body?.unitId,
  videoId: String(req.body?.videoId || ''),
})));
router.post('/my/sessions', ...requireStudent, handle((req) => service.startSession(userId(req), {
  topicId: req.body?.topicId,
  difficulty: String(req.body?.difficulty || ''),
  mode: req.body?.mode === 'path' ? 'path' : 'free',
  unitId: req.body?.unitId,
  step: String(req.body?.step || ''),
  nodeKey: String(req.body?.nodeKey || req.body?.pathNodeKey || ''),
  testOut: req.body?.testOut === true,
})));
router.post('/my/sessions/:id/answer', ...requireStudent, handle((req) => service.answerQuestion(userId(req), req.params.id, {
  questionId: req.body?.questionId,
  answer: req.body?.answer,
})));
router.post('/my/sessions/:id/hint', ...requireStudent, handle((req) => service.useHint(userId(req), req.params.id, {
  questionId: req.body?.questionId,
})));
router.post('/my/sessions/:id/finish', ...requireStudent, handle((req) => service.finishSession(userId(req), req.params.id)));
router.post('/my/sessions/:id/abandon', ...requireStudent, handle((req) => service.abandonSession(userId(req), req.params.id)));
router.get('/my/related-topics', ...requireStudent, handle((req) => service.relatedTopics({
  subjectId: String(req.query?.subjectId || ''),
  unitId: String(req.query?.unitId || ''),
})));
router.post('/my/xp/purchase', ...requireStudent, handle((req) => service.createXpPurchase(userId(req), String(req.body?.packId || ''))));
router.get('/my/xp/purchase/:sessionId', ...requireStudent, handle((req) => service.getXpPurchaseStatus(userId(req), req.params.sessionId)));
router.post('/my/xp/purchase/:sessionId/simulate-paid', ...requireStudent, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Không tìm thấy endpoint' });
  }
  try {
    return res.json({ success: true, data: await service.simulateXpPurchase(userId(req), req.params.sessionId) });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
