const express = require('express');
const router = express.Router();
const systemController = require('../controllers/SystemController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const systemRepository = require('./repositories');
const { verifyAdminPassword } = require('../../utils/adminPassword');
const { authMiddleware } = require('../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../shared/middleware/authorize');
const legacyMapping = require('../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../shared/constants/permissions');
const { PERMISSIONS } = require('../../constants/permissions');
const logger = require('../../config/logger');
const { normalizeMulterFile } = require('../../utils/escapeRegex');
const {
  getMergedExamCatalog,
  normalizeCustomList,
  sanitizeCustomExamSubjectEntry,
  mergeCourseSubjectsIntoCustom,
  inferExamSubjectsFromCourseName,
  BUILTIN_EXAM_SUBJECT_IDS,
} = require('../exam/services/examSubjectCatalog');
const { getCachedSettings, invalidateSettingsCache } = require('./settingsCache');
const Course = require('../course/models/Course');

/** Chuyển URL đầy đủ http(s)://.../uploads/... → /uploads/... (tránh mixed-content trên HTTPS) */
function normalizeUploadFileUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const m = url.match(/\/uploads\/[^\s?#]+/i);
  return m ? m[0] : url;
}

function normalizeTrainingDataUrls(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  for (const key of ['files', 'videos', 'guides', 'assignments']) {
    if (!Array.isArray(out[key])) continue;
    out[key] = out[key].map((item) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };
      if (next.fileUrl) next.fileUrl = normalizeUploadFileUrl(next.fileUrl);
      if (next.submittedFileUrl) next.submittedFileUrl = normalizeUploadFileUrl(next.submittedFileUrl);
      return next;
    });
  }
  return out;
// ── Multer config cho upload banner popup ─────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'popup');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `popup_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ cho phép file ảnh'));
  },
});

// Helper: get or create singleton settings (lean, không secret) — có cache
async function getSettings() {
  return getCachedSettings();
}

async function updateMainSettings(update, options = {}) {
  const settings = await systemRepository.updateMain(update, options);
  await invalidateSettingsCache();
  return settings;
}

// ── GET /api/settings/bank ─────────────────────────────────── (Public - chỉ bank info)
// Chỉ trả thông tin ngân hàng để hiển thị QR - an toàn public
router.get('/bank', systemController.get_bank1);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── GET /api/settings ─────────────────────────────────────────── (Admin only)
router.get('/', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.getRoot2);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── PUT /api/settings ─────────────────────────────────────────── (Admin only)
router.put('/', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.putRoot3);

    return res.json({ success: true, data: settings, message: 'Đã lưu cấu hình' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── POST /api/settings/upload-popup-image ── Upload banner popup ─────────────
router.post('/upload-popup-image', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), upload.single('image'), systemController.post_upload_popup_image4);
    const imageUrl = `/uploads/popup/${req.file.filename}`;

    await updateMainSettings({ $set: { popupImageUrl: imageUrl } });

    return res.json({ success: true, imageUrl, message: 'Upload thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/upload-invoice-signature ── Upload chữ ký hóa đơn ─────────
const sigDir = path.join(__dirname, '..', 'uploads', 'signature');
if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });

const sigStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sigDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `signature_${Date.now()}${ext}`);
  },
});
const uploadSig = multer({
  storage: sigStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ cho phép file ảnh'));
  },
});

router.post('/upload-invoice-signature', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), uploadSig.single('image'), systemController.post_upload_invoice_signature5);
    const signatureUrl = `/uploads/signature/${req.file.filename}`;

    await updateMainSettings({ $set: { invoiceSignatureUrl: signatureUrl } });

    return res.json({ success: true, signatureUrl, message: 'Upload chữ ký thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/settings/popup ──── Public (Student & Teacher gọi khi login) ─────
router.get('/popup', authMiddleware, systemController.get_popup6);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── GET /api/settings/payment ── PUBLIC — Lấy thông tin ngân hàng trung tâm ──
// Không cần auth: trang đăng ký học viên mới gọi endpoint này mà không có token
router.get('/payment', systemController.get_payment7);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── GET /api/settings/web ── PUBLIC — Logo, Loading style, Staff popup ────────
// Frontend gọi ngay khi khởi tạo App để render loading screen + logo
router.get('/web', systemController.get_web8);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── PUT /api/settings/web ── Admin only — Cập nhật cài đặt web ───────────────
router.put('/web', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.put_web9);

    return res.json({ success: true, data: settings, message: 'Đã lưu cấu hình Web' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// ── GET /api/settings/training-data ── Lấy training data (Cho mọi user) ───────────
router.get('/training-data', authMiddleware, systemController.get_training_data10);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── PUT /api/settings/training-data ── Cập nhật training data (Admin) ─────────────
router.put('/training-data', authMiddleware, authorizeAny(NEW_PERMISSIONS.COURSE_UPDATE, NEW_PERMISSIONS.EXAM_MANAGE), systemController.put_training_data11);
    // Broadcast via socket that training data was updated
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');

    return res.json({ success: true, message: 'Đã cập nhật training data' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/settings/student-training-data ── Lấy student training data (Cho mọi user) ───────────
router.get('/student-training-data', authMiddleware, systemController.get_student_training_data12);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── PUT /api/settings/student-training-data ── Cập nhật student training data (Admin) ─────────────
router.put('/student-training-data', authMiddleware, authorize(NEW_PERMISSIONS.COURSE_UPDATE), systemController.put_student_training_data13);
    // Broadcast via socket that data was updated
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');

    return res.json({ success: true, message: 'Đã cập nhật dữ liệu học viên' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const DEFAULT_EXAM_MINUTES_SERVER = { coban: 90, word: 90, excel: 90, powerpoint: 90, canva: 90 };
const DEFAULT_ESSAY_EXAM_MINUTES_SERVER = { coban: 60, word: 60, excel: 60, powerpoint: 60, canva: 60 };

function sanitizeStudentExamMinutesPayload(body) {
  const out = { ...DEFAULT_EXAM_MINUTES_SERVER };
  if (!body || typeof body !== 'object') return out;
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return out;
}

function sanitizeStudentEssayExamMinutesPayload(body) {
  const out = { ...DEFAULT_ESSAY_EXAM_MINUTES_SERVER };
  if (!body || typeof body !== 'object') return out;
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return out;
}

function sanitizeStudentExamFilesPayload(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const [k, v] of Object.entries(body)) {
    if (!v || typeof v !== 'object') continue;
    const sid = String(k).trim().slice(0, 40);
    if (!sid) continue;
    const fileUrl = String(v.fileUrl || '').trim();
    if (!fileUrl.startsWith('/uploads/')) continue;
    out[sid] = {
      fileUrl: fileUrl.slice(0, 500),
      fileName: String(v.fileName || '').trim().slice(0, 255),
      fileType: String(v.fileType || '').trim().slice(0, 20).toUpperCase(),
    };
  }
  return out;
}

/**
 * Catalog môn thi = builtin + custom settings + môn gắn trên Course (đồng bộ DB).
 * Nếu tìm thấy môn còn thiếu → ghi vào examSubjectsCustomRaw để lần sau dùng chung.
 * Khóa học cũ thiếu examSubjects → backfill từ tên/category.
 */
async function examCatalogPayload(settings) {
  let custom = normalizeCustomList(settings?.examSubjectsCustomRaw);
  try {
    const courses = await Course.find({}).select('name category examSubjects').lean();

    // Backfill examSubjects cho khóa học cũ (chỉ những bản ghi đang trống)
    const toBackfill = courses.filter((c) => !Array.isArray(c.examSubjects) || c.examSubjects.length === 0);
    if (toBackfill.length) {
      await Promise.all(toBackfill.map(async (c) => {
        const ids = inferExamSubjectsFromCourseName(c.name, c.category, custom);
        if (!ids.length) return;
        await Course.updateOne({ _id: c._id }, { $set: { examSubjects: ids } });
        c.examSubjects = ids;
      }));
      logger.info(`[EXAM-SUBJECTS] Backfilled examSubjects for ${toBackfill.length} course(s)`);
    }

    const { custom: mergedCustom, added } = mergeCourseSubjectsIntoCustom(custom, courses);
    if (added.length) {
      custom = mergedCustom;
      await updateMainSettings({ $set: { examSubjectsCustomRaw: custom } });
      logger.info(`[EXAM-SUBJECTS] Synced ${added.length} subject(s) from courses: ${added.map((s) => s.id).join(', ')}`);
    }
  } catch (err) {
    logger.warn('[EXAM-SUBJECTS] Course sync skipped:', err.message);
  }
  return {
    custom,
    merged: getMergedExamCatalog(custom),
  };
}

// ── GET /api/settings/student-exam-config ── Ngân hàng TN HV + phút làm bài (mọi role đăng nhập)
router.get('/student-exam-config', authMiddleware, systemController.get_student_exam_config14);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

const DEFAULT_TEACHER_EXAM_MINUTES_SERVER = { coban: 90, word: 90, excel: 90, powerpoint: 90, canva: 90, situation: 90, computer: 90, other: 90 };
const DEFAULT_TEACHER_ESSAY_EXAM_MINUTES_SERVER = { coban: 60, word: 60, excel: 60, powerpoint: 60, canva: 60, situation: 60, computer: 60, other: 60 };

function rawTeacherExamMinutesPayload(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return Object.keys(out).length ? out : null;
}

function rawTeacherEssayExamMinutesPayload(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeTeacherExamMinutesPayload(body) {
  const out = { ...DEFAULT_TEACHER_EXAM_MINUTES_SERVER };
  if (!body || typeof body !== 'object') return out;
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return out;
}

function sanitizeTeacherEssayExamMinutesPayload(body) {
  const out = { ...DEFAULT_TEACHER_ESSAY_EXAM_MINUTES_SERVER };
  if (!body || typeof body !== 'object') return out;
  for (const k of Object.keys(body)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 600) out[k] = Math.round(n);
  }
  return out;
}

function sanitizeTeacherExamTimeLimitMinutes(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 5 || rounded > 600) return null;
  return rounded;
}

// ── GET /api/settings/teacher-exam-config ── Ngân hàng câu hỏi thi GV (mọi role đăng nhập — chỉ GV cần)
router.get('/teacher-exam-config', authMiddleware, systemController.get_teacher_exam_config15);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ── PUT /api/settings/teacher-exam-config ── Admin/Staff lưu ngân hàng thi GV (+ phút làm bài tùy chọn)
router.put('/teacher-exam-config', authMiddleware, authorizeAny(NEW_PERMISSIONS.COURSE_UPDATE, NEW_PERMISSIONS.EXAM_MANAGE), systemController.put_teacher_exam_config16);
      }
      $set.teacherExamBankRawData = questions;
    }
    if (timeLimitMinutes !== undefined) {
      if (timeLimitMinutes === null || timeLimitMinutes === '') {
        $set.teacherExamTimeLimitMinutes = null;
      } else {
        const n = sanitizeTeacherExamTimeLimitMinutes(timeLimitMinutes);
        if (n === null) {
          return res.status(400).json({
            success: false,
            message: 'timeLimitMinutes phải từ 5 đến 600 (phút), hoặc null để tự động',
          });
        }
        $set.teacherExamTimeLimitMinutes = n;
      }
    }
    if (teacherExamMinutes !== undefined) {
      const prev =
        settings?.teacherExamMinutesRaw && typeof settings.teacherExamMinutesRaw === 'object'
          ? { ...settings.teacherExamMinutesRaw }
          : {};
      if (teacherExamMinutes && typeof teacherExamMinutes === 'object') {
        for (const [k, v] of Object.entries(teacherExamMinutes)) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 1 && n <= 600) prev[k] = Math.round(n);
        }
      }
      $set.teacherExamMinutesRaw = prev;
    }
    if (teacherEssayExamMinutes !== undefined) {
      const prev =
        settings?.teacherEssayExamMinutesRaw && typeof settings.teacherEssayExamMinutesRaw === 'object'
          ? { ...settings.teacherEssayExamMinutesRaw }
          : {};
      if (teacherEssayExamMinutes && typeof teacherEssayExamMinutes === 'object') {
        for (const [k, v] of Object.entries(teacherEssayExamMinutes)) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 1 && n <= 600) prev[k] = Math.round(n);
        }
      }
      $set.teacherEssayExamMinutesRaw = prev;
    }
    if (Object.keys($set).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cần gửi questions, timeLimitMinutes, teacherExamMinutes hoặc teacherEssayExamMinutes',
      });
    }
    await updateMainSettings({ $set });
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');
    const fresh = await getSettings();
    const freshTn = fresh?.teacherExamMinutesRaw;
    const freshTl = fresh?.teacherEssayExamMinutesRaw;
    return res.json({
      success: true,
      message: 'Đã lưu cấu hình thi giảng viên',
      data: {
        hasTeacherExamMinutes: freshTn != null && typeof freshTn === 'object',
        hasTeacherEssayExamMinutes: freshTl != null && typeof freshTl === 'object',
        teacherExamMinutes: rawTeacherExamMinutesPayload(freshTn),
        teacherEssayExamMinutes: rawTeacherEssayExamMinutesPayload(freshTl),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/settings/exam-subjects ── Danh muc mon thi (mac dinh + tuy chinh + sync Course)
router.get('/exam-subjects', authMiddleware, systemController.get_exam_subjects17);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/exam-subjects ── Admin them mon thi moi
router.post('/exam-subjects', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.post_exam_subjects18);
    if (!entry) {
      return res.status(400).json({ success: false, message: 'Tên môn thi không hợp lệ (ít nhất 2 ký tự)' });
    }
    if (BUILTIN_EXAM_SUBJECT_IDS.includes(entry.id)) {
      return res.status(409).json({ success: false, message: 'Ma mon trung voi mon mac dinh he thong' });
    }
    const settings = await getSettings();
    const custom = normalizeCustomList(settings?.examSubjectsCustomRaw);
    if (custom.some((c) => c.id === entry.id)) {
      return res.status(409).json({ success: false, message: 'Ma mon thi da ton tai' });
    }
    custom.push(entry);
    const minsRaw = settings.studentExamMinutesRaw && typeof settings.studentExamMinutesRaw === 'object'
      ? { ...settings.studentExamMinutesRaw }
      : { ...DEFAULT_EXAM_MINUTES_SERVER };
    minsRaw[entry.id] = entry.minutes;
    await updateMainSettings({
      $set: {
        examSubjectsCustomRaw: custom,
        studentExamMinutesRaw: sanitizeStudentExamMinutesPayload(minsRaw),
      },
    });
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');
    return res.status(201).json({
      success: true,
      message: `Da them mon thi "${entry.label}"`,
      data: { subject: entry, merged: getMergedExamCatalog(custom) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/settings/exam-subjects/:id ── Admin xoa mon tuy chinh
router.delete('/exam-subjects/:id', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.delete_exam_subjects_id19);
    }
    const settings = await getSettings();
    const custom = normalizeCustomList(settings?.examSubjectsCustomRaw).filter((c) => c.id !== id);
    await updateMainSettings({ $set: { examSubjectsCustomRaw: custom } });
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');
    return res.json({ success: true, message: 'Da xoa mon thi', data: { merged: getMergedExamCatalog(custom) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/settings/student-exam-config ── Admin/Staff lưu ngân hàng + thời gian thi HV
router.put('/student-exam-config', authMiddleware, authorize(NEW_PERMISSIONS.COURSE_UPDATE), systemController.put_student_exam_config20);
      }
      updates.studentExamBankRawData = studentQuestions;
    }
    if (studentExamMinutes !== undefined) {
      updates.studentExamMinutesRaw = sanitizeStudentExamMinutesPayload(studentExamMinutes);
    }
    if (studentEssayExamMinutes !== undefined) {
      updates.studentEssayExamMinutesRaw = sanitizeStudentEssayExamMinutesPayload(studentEssayExamMinutes);
    }
    if (studentExamFiles !== undefined) {
      updates.studentExamFilesRaw = sanitizeStudentExamFilesPayload(studentExamFiles);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu để lưu' });
    }
    await updateMainSettings({ $set: updates });
    const io = req.app.get('io');
    if (io) io.emit('data:refresh');
    return res.json({ success: true, message: 'Đã lưu cấu hình thi học viên' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/upload-training-file ── Tài liệu đào tạo GV/HV (Admin) ──
const trainingDir = path.join(__dirname, '..', 'uploads', 'training');
if (!fs.existsSync(trainingDir)) fs.mkdirSync(trainingDir, { recursive: true });

const ALLOWED_TRAINING_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.jfif', '.svg',
]);

const TRAINING_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
};

function resolveTrainingUploadExt(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (ALLOWED_TRAINING_EXT.has(ext)) return ext;
  const mime = String(mimetype || '').toLowerCase();
  if (TRAINING_MIME_EXT[mime]) return TRAINING_MIME_EXT[mime];
  if (mime.startsWith('image/')) return '.jpg';
  return '';
}

function isAllowedTrainingUpload(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (ALLOWED_TRAINING_EXT.has(ext)) return true;
  const mime = String(mimetype || '').toLowerCase();
  return mime.startsWith('image/') || Boolean(TRAINING_MIME_EXT[mime]);
}

const trainingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, trainingDir),
  filename: (req, file, cb) => {
    const ext = resolveTrainingUploadExt(file.originalname, file.mimetype);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `training-${uniqueSuffix}${ext}`);
  },
});

const uploadTraining = multer({
  storage: trainingStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (isAllowedTrainingUpload(file.originalname, file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Chỉ cho phép PDF, Word, Excel, PowerPoint, ZIP, RAR hoặc hình ảnh (JPG, PNG, WebP, GIF).'));
  },
});

router.post('/upload-training-file', authMiddleware, authorizeAny(NEW_PERMISSIONS.COURSE_UPDATE, NEW_PERMISSIONS.EXAM_MANAGE), (req, res) => {
  uploadTraining.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File quá lớn (tối đa 25MB).' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Lỗi upload' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa chọn file' });
    }
    normalizeMulterFile(req.file);
    const fileUrl = `/uploads/training/${req.file.filename}`;
    return res.json({
      success: true,
      fileUrl,
      fileOriginalName: req.file.originalname || req.file.filename,
      message: 'Tải tài liệu thành công',
    });
  });
});

// ── POST /api/settings/upload-logo ── Upload logo thương hiệu ────────────────
const logoDir = path.join(__dirname, '..', 'uploads', 'logo');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ cho phép file ảnh'));
  },
});

router.post('/upload-logo', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), uploadLogo.single('logo'), systemController.post_upload_logo21);
    const logoUrl = `/uploads/logo/${req.file.filename}`;
    await updateMainSettings({ $set: { logoUrl } });
    return res.json({ success: true, logoUrl, message: 'Upload logo thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/upload-favicon ── Upload favicon (public | admin) ─────
const faviconDir = path.join(__dirname, '..', 'uploads', 'favicon');
if (!fs.existsSync(faviconDir)) fs.mkdirSync(faviconDir, { recursive: true });

const faviconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, faviconDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const kind = String(req.query?.kind || 'public').toLowerCase() === 'admin' ? 'admin' : 'public';
    cb(null, `favicon_${kind}_${Date.now()}${ext}`);
  },
});
const uploadFavicon = multer({
  storage: faviconStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml' || file.mimetype === 'image/x-icon';
    if (ok) cb(null, true);
    else cb(new Error('Chỉ cho phép file ảnh (PNG, SVG, ICO, WEBP...)'));
  },
});

router.post('/upload-favicon', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), uploadFavicon.single('favicon'), systemController.post_upload_favicon22);
    const kind = String(req.query?.kind || req.body?.kind || 'public').toLowerCase() === 'admin' ? 'admin' : 'public';
    const faviconPath = `/uploads/favicon/${req.file.filename}`;
    const field = kind === 'admin' ? 'faviconAdminUrl' : 'faviconUrl';
    await updateMainSettings({ $set: { [field]: faviconPath } });
    return res.json({
      success: true,
      kind,
      faviconUrl: faviconPath,
      [field]: faviconPath,
      message: kind === 'admin' ? 'Upload favicon Admin thành công' : 'Upload favicon thành công',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/upload-invoice-logo ── Upload logo dành riêng cho hóa đơn ──
const invLogoDir = path.join(__dirname, '..', 'uploads', 'invoice_logo');
if (!fs.existsSync(invLogoDir)) fs.mkdirSync(invLogoDir, { recursive: true });

const invLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, invLogoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `inv_logo_${Date.now()}${ext}`);
  },
});
const uploadInvLogo = multer({
  storage: invLogoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ cho phép file ảnh'));
  },
});

router.post('/upload-invoice-logo', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), uploadInvLogo.single('logo'), systemController.post_upload_invoice_logo23);
    const logoUrl = `/uploads/invoice_logo/${req.file.filename}`;
    await updateMainSettings({ $set: { invoiceLogoUrl: logoUrl } });
    return res.json({ success: true, logoUrl, message: 'Upload logo hóa đơn thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/settings/reset-data ── Làm mới dữ liệu hệ thống (Super Admin) ──
const Teacher = require('../teacher/models/Teacher');
const Student = require('../student/models/Student');
const Schedule = require('../attendance/models/Schedule');
const Transaction = require('../transaction/models/Transaction');
const Invoice = require('../invoice/models/Invoice');
const Message = require('../chat/models/Message');
const SystemLog = require('../report/models/SystemLog');
const Notification = require('../notification/models/Notification');
const Assignment = require('../course/models/Assignment');
const Submission = require('../course/models/Submission');
const Evaluation = require('../exam/models/Evaluation');
const ExamResult = require('../exam/models/ExamResult');
const Group = require('../student/models/Group');
const ConversationVisibility = require('../chat/models/ConversationVisibility');
const PayrollLog = require('../finance/models/PayrollLog');
const Employee = require('../auth/models/Employee');
const mongoose = require('mongoose');

router.post('/reset-data', authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE), systemController.post_reset_data24);
  }

  try {
    // 1. Xác thực Super Admin — kiểm tra từ DB (SystemSettings) thay vì hardcode
    if (userId === 'admin') {
      const systemRepository = require('./repositories');
      const sysSettings = await systemRepository.findMain();
      const pwMatch = await verifyAdminPassword(password, sysSettings);
      if (!pwMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu Super Admin không đúng' });
      }
    } else {
      const adminUser = await Teacher.findById(userId).select('+password');
      if (!adminUser || adminUser.adminRole !== 'SUPER_ADMIN') {
        return res.status(400).json({ success: false, message: 'Chỉ Super Admin mới có quyền thao tác này' });
      }
      const isMatch = await adminUser.comparePassword(password);
      if (!isMatch) {
         return res.status(400).json({ success: false, message: 'Mật khẩu Super Admin không đúng' });
      }
    }

    // 2. Thực hiện xóa theo tùy chọn
    // Trung tâm kiểm soát đã xác thực Super Admin + chuỗi XOA_DU_LIEU + mật khẩu
    // → cho phép wipe tài chính (không phụ thuộc FINANCE_ALLOW_HARD_DELETE;
    //   flag đó chỉ chặn hard-delete từng HĐ/phiếu qua API thường).
    const isAll = options.all === true;

    if ((isAll || options.finance) && process.env.NODE_ENV === 'production') {
      logger.warn(
        '[SETTINGS] Control Center finance wipe by %s — bypass FINANCE_ALLOW_HARD_DELETE gate',
        userId,
      );
    }
    
    // NHÓM: HỌC VIÊN
    if (isAll || options.students) {
      await Student.deleteMany({});
      await ExamResult.deleteMany({});
      await Submission.deleteMany({});
      await Evaluation.deleteMany({});
      await Assignment.deleteMany({});
    }

    // NHÓM: TÀI CHÍNH — factory reset xóa kèm Ledger/CreditNote/Snapshot
    if (isAll || options.finance) {
      await Transaction.deleteMany({});
      await Invoice.deleteMany({});
      await PayrollLog.deleteMany({});
      try {
        const LedgerEntry = require('../finance/models/LedgerEntry');
        const CreditNote = require('../finance/models/CreditNote');
        const FinanceDailySnapshot = require('../finance/models/FinanceDailySnapshot');
        await LedgerEntry.deleteMany({});
        await CreditNote.deleteMany({});
        await FinanceDailySnapshot.deleteMany({});
      } catch (wipeErr) {
        logger.warn('[SETTINGS] finance ledger wipe: %s', wipeErr.message);
      }
    }

    // NHÓM: LỊCH DẠY
    if (isAll || options.schedules) {
      await Schedule.deleteMany({});
    }

    // NHÓM: TIN NHẮN & THÔNG BÁO
    if (isAll || options.communication) {
      await Message.deleteMany({});
      await Notification.deleteMany({});
      await Group.deleteMany({});
      await ConversationVisibility.deleteMany({});
    }

    // NHÓM: NHÂN SỰ (STAFF)
    if (isAll || options.hr) {
      await Employee.deleteMany({});
    }

    // NHÓM: LOGS
    if (isAll || options.logs) {
      await SystemLog.deleteMany({});
    }
    
    // NHÓM 2 - DỮ LIỆU GIỮ NGUYÊN
    // Không bao giờ xóa: Teacher (Users), SystemSettings, Branch, Course.
    
    // Auto-unlock tất cả giáo viên
    await Teacher.updateMany({}, { $set: { isLocked: false, loginAttempts: 0, lockReason: null } });

    // 3. Thông báo cho Socket
    const io = req.app.get('io');
    if (io) {
       io.emit('SYSTEM_RESET');
    }

    return res.json({ success: true, message: 'Làm mới dữ liệu hệ thống thành công' });

  } catch (err) {
    logger.error('[RESET DATA ERROR]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi reset data: ' + err.message });
  }
});

module.exports = router;
