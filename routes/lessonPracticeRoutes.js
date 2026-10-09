'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const fileService = require('../services/fileService');
const logger = require('../config/logger');
const service = require('../services/lessonPracticeService');
const coursePurchaseService = require('../services/lessonPracticePurchaseService');
const PaymentSession = require('../models/PaymentSession');

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

router.get('/backup/export', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.exportBackup();
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

const backupUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/backup/import', ...requireAdmin, (req, res, next) => {
  backupUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: 'Không đọc được file (tối đa 50MB)' });
    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn file sao lưu' });
    let payload;
    try {
      payload = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'File không phải JSON hợp lệ' });
    }
    const data = await service.importBackup(payload);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/subjects', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listSubjectsAdmin();
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/courses', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.listCoursesForAdmin();
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/subjects', ...requireAdmin, async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Môn học được đồng bộ từ khóa học. Hãy tạo hoặc chỉnh sửa khóa học để thay đổi danh sách môn.',
  });
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
      data: { id: asset._id, url: asset.url, originalName: asset.originalName },
    });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/subjects', ...requireStudent, async (req, res) => {
  try {
    const data = await service.listSubjectsForStudent(studentId(req));
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/my/courses/:id/checkout', ...requireStudent, async (req, res) => {
  try {
    const data = await coursePurchaseService.checkoutCourse({
      user: req.user,
      courseId: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/course-purchase-sessions/:sessionId', ...requireStudent, async (req, res) => {
  try {
    const session = await PaymentSession.findOne({
      sessionId: req.params.sessionId,
      studentId: studentId(req),
      kind: 'course_purchase',
    }).select('status amount ref').lean();
    if (!session) return res.json({ success: true, paid: false, status: 'not_found' });
    return res.json({
      success: true,
      paid: session.status === 'paid',
      status: session.status,
      amount: session.amount,
      ref: session.ref,
    });
  } catch (err) { return sendError(res, err); }
});

router.post('/my/course-purchase-sessions/:sessionId/simulate-paid', ...requireStudent, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Không tìm thấy endpoint' });
  }
  try {
    const data = await coursePurchaseService.simulateCoursePurchase({
      studentId: studentId(req),
      sessionId: req.params.sessionId,
    });
    return res.json({ success: true, paid: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/subjects/:id/units', ...requireStudent, async (req, res) => {
  try {
    const data = await service.listUnitsForStudent(studentId(req), req.params.id, req.query.courseId || '');
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.get('/my/units/:id', ...requireStudent, async (req, res) => {
  try {
    const data = await service.getUnitForStudent(studentId(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/my/units/:id/sections/:section', ...requireStudent, async (req, res) => {
  try {
    const data = await service.markUnitSection(studentId(req), req.params.id, req.params.section, req.body?.itemId || '');
    return res.json({ success: true, data });
  } catch (err) { return sendError(res, err); }
});

router.post('/my/units/:id/reset-practice', ...requireStudent, async (req, res) => {
  try {
    const data = await service.resetPractice(studentId(req), req.params.id);
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
