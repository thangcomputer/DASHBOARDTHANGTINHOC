'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const fileService = require('../services/fileService');
const logger = require('../config/logger');
const service = require('../services/lessonPracticeService');

const requireAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENT_TRAINING)];

function requireStudentRole(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được dùng chức năng này' });
  }
  return next();
}

const requireStudent = [authMiddleware, requireStudentRole];

function studentId(req) {
  return req.user.id || req.user._id;
}

function sendError(res, err) {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  logger.error('[LESSON]', err);
  return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
}

function uploadImage(req, res, next) {
  let uploader;
  try {
    uploader = fileService.createUploader('images');
  } catch (err) {
    req.resume();
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }
  uploader.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File quá lớn (tối đa 5MB)' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Lỗi upload' });
    }
    return next();
  });
}

router.get('/subjects', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listSubjectsAdmin();
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/subjects', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.createSubject(req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/subjects/seed-defaults', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.seedDefaults();
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.patch('/subjects/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.updateSubject(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.delete('/subjects/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.deleteSubject(req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/subjects/:id/units', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listUnits(req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/subjects/:id/units', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.createUnit(req.params.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.patch('/units/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.updateUnit(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.delete('/units/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.deleteUnit(req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/units/:id/items', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listItems(req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/units/:id/items', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.createItem(req.params.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.patch('/items/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.updateItem(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.delete('/items/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.deleteItem(req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/progress', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listProgress(req.query.subjectId || '');
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/upload', ...requireAdmin, uploadImage, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn file' });
    const asset = await fileService.registerUploadedFile(req.file, {
      category: 'images',
      uploadedBy: String(req.user.id || req.user._id || ''),
      uploadedByRole: req.user.role || '',
      relatedType: 'lesson_practice',
      relatedId: String(req.body?.relatedId || ''),
    });
    return res.status(201).json({
      success: true,
      data: { id: asset._id, url: asset.url },
    });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/subjects', ...requireStudent, async (req, res) => {
  try {
    const data = await service.listSubjectsForStudent(studentId(req));
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/subjects/:id/units', ...requireStudent, async (req, res) => {
  try {
    const data = await service.listUnitsForStudent(studentId(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/units/:id', ...requireStudent, async (req, res) => {
  try {
    const data = await service.getUnitForStudent(studentId(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/my/items/:id/confirm', ...requireStudent, async (req, res) => {
  try {
    const data = await service.confirmItem(studentId(req), req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

module.exports = router;
