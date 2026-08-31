'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const fileService = require('../services/fileService');
const logger = require('../config/logger');
const service = require('../services/certPrepService');

const requireCertPrepAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_CERT_PREP)];

function requireStudentRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  }
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được dùng chức năng này' });
  }
  return next();
}

const requireStudent = [authMiddleware, requireStudentRole];

function studentIdFromAuth(req) {
  return req.user.id || req.user._id;
}

function sendError(res, err) {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  logger.error('[CERT-PREP]', err);
  return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
}

function adminOrStudentForLevelTests(req, res, next) {
  if (req.user?.role === 'student') return next();
  return checkPermission(PERMISSIONS.MANAGE_CERT_PREP)(req, res, next);
}

// ── Upload adapter (reuse fileService; isolated from /api/files gate) ─────────
function certPrepUploadMiddleware(req, res, next) {
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
    next();
  });
}

function certPrepExcelUploadMiddleware(req, res, next) {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const name = String(file.originalname || '');
      const ok = /\.(xlsx|xls)$/i.test(name)
        || /sheet|excel|spreadsheet/i.test(String(file.mimetype || ''));
      if (!ok) return cb(new Error('Chỉ nhận file Excel (.xlsx / .xls)'));
      return cb(null, true);
    },
  }).single('file');
  uploader(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File quá lớn (tối đa 15MB)' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Lỗi upload Excel' });
    }
    return next();
  });
}

router.post('/upload', ...requireCertPrepAdmin, certPrepUploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa chọn file' });
    }
    const asset = await fileService.registerUploadedFile(req.file, {
      category: 'images',
      uploadedBy: String(req.user.id || req.user._id || ''),
      uploadedByRole: req.user.role || '',
      relatedType: 'cert_prep',
      relatedId: String(req.body?.relatedId || ''),
    });
    return res.status(201).json({
      success: true,
      message: 'Upload thành công',
      data: {
        id: asset._id,
        url: asset.url,
        fileUrl: asset.url,
        originalName: asset.originalName,
        size: asset.size,
        category: asset.category,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Student catalog / sessions (before parameterized admin twins where needed)
router.get('/my-catalog', ...requireStudent, async (req, res) => {
  try {
    const sid = studentIdFromAuth(req);
    // Catch-up: enrollment đã active nhưng access CertPrep chưa được cấp (mapping mới / re-enroll)
    try {
      const enroll = require('../services/certPrepEnrollmentService');
      await enroll.safeSyncStudentEnrollments(sid, {
        grantedBy: `catalog-sync:${sid}`,
      });
    } catch (syncErr) {
      logger.error('[CERT-PREP] catalog sync isolated: %s', syncErr.message);
    }
    const data = await service.getMyCatalog(sid);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/sessions', ...requireStudent, async (req, res) => {
  try {
    const data = await service.startSession(studentIdFromAuth(req), req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/sessions/:id', ...requireStudent, async (req, res) => {
  try {
    const data = await service.getSession(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/sessions/:id/pause', ...requireStudent, async (req, res) => {
  try {
    const data = await service.pauseSession(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/sessions/:id/result', ...requireStudent, async (req, res) => {
  try {
    const data = await service.getSessionResult(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/tests/:id/attempts', ...requireStudent, async (req, res) => {
  try {
    const data = await service.listStudentAttempts(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/sessions/:id', ...requireStudent, async (req, res) => {
  try {
    const data = await service.saveProgress(studentIdFromAuth(req), req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/sessions/:id/submit', ...requireStudent, async (req, res) => {
  try {
    const data = await service.submitSession(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/sessions/:id', ...requireStudent, async (req, res) => {
  try {
    const data = await service.abandonSession(studentIdFromAuth(req), req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Courses
router.get('/courses', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.listCourses();
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/courses', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.createCourse(req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/courses/:id/levels', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.listLevels(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/courses/:id/questions/export', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const { buffer, filename } = await service.exportCourseQuestionsWorkbook(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post(
  '/courses/:id/questions/import',
  ...requireCertPrepAdmin,
  certPrepExcelUploadMiddleware,
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'Chưa chọn file Excel' });
      }
      const replace = String(req.body?.replace || '').toLowerCase() === 'true'
        || req.body?.replace === true
        || req.body?.replace === '1';
      const data = await service.importCourseQuestionsFromWorkbook(req.params.id, req.file.buffer, { replace });
      return res.json({
        success: true,
        message: replace
          ? `Đã ghi đè: thêm ${data.created} câu (vô hiệu ${data.deactivated} câu cũ)`
          : `Đã thêm ${data.created} câu hỏi`,
        data,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
);

router.post('/courses/:id/levels', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.createLevel(req.params.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/courses/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.updateCourse(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/courses/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.deleteCourse(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Levels / tests (shared GET for student + admin)
router.get('/levels/:id/tests', authMiddleware, adminOrStudentForLevelTests, async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const data = await service.listTestsForStudent(studentIdFromAuth(req), req.params.id);
      return res.json({ success: true, data });
    }
    const data = await service.listTestsAdmin(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/levels/:id/tests', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.createTest(req.params.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/levels/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.updateLevel(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/levels/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.deleteLevel(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Tests / questions
router.get('/tests/:id/questions', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.listQuestions(req.params.id, req.query || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/tests/:id/questions', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.createQuestion(req.params.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/tests/:id/questions', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const permanent = req.query?.permanent === '1' || req.query?.permanent === 'true';
    const data = await service.deleteQuestionsByTest(req.params.id, { permanent });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/tests/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.updateTest(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/tests/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.deleteTest(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/questions/reorder', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.reorderQuestions(req.body?.items || req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/questions/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.updateQuestion(req.params.id, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/questions/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const permanent = req.query?.permanent === '1' || req.query?.permanent === 'true';
    const data = await service.deleteQuestion(req.params.id, { permanent });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Access
router.get('/students', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.searchStudents(req.query?.q);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/access', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.listAccess(req.query || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/enrollment-mappings', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const enroll = require('../services/certPrepEnrollmentService');
    const data = await enroll.listMappings();
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/enrollment-mappings', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const enroll = require('../services/certPrepEnrollmentService');
    const data = await enroll.upsertMapping(req.body || {}, studentIdFromAuth(req));
    try {
      await enroll.syncExistingEnrollments({
        grantedBy: `mapping-save:${studentIdFromAuth(req)}`,
      });
    } catch (syncErr) {
      logger.error('[CERT-PREP] mapping save sync isolated: %s', syncErr.message);
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/enrollment-mappings/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const enroll = require('../services/certPrepEnrollmentService');
    const actor = studentIdFromAuth(req);
    if (req.body?.isActive !== undefined && !req.body?.certPrepCourseId) {
      const data = await enroll.setMappingActive(req.params.id, req.body.isActive !== false, actor);
      return res.json({ success: true, data });
    }
    const data = await enroll.upsertMapping(req.body || {}, actor);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/enrollment-mappings/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const enroll = require('../services/certPrepEnrollmentService');
    const data = await enroll.setMappingActive(req.params.id, false, studentIdFromAuth(req));
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/enrollment-mappings/sync', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const enroll = require('../services/certPrepEnrollmentService');
    const data = await enroll.syncExistingEnrollments({
      studentId: req.body?.studentId,
      grantedBy: `enrollment-sync:${studentIdFromAuth(req)}`,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/access', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.grantAccess(req.body || {}, studentIdFromAuth(req));
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/access/:id', ...requireCertPrepAdmin, async (req, res) => {
  try {
    const data = await service.revokeAccess(req.params.id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
