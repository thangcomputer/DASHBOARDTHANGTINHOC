const express = require('express');
const { courseRepository } = require('../repositories');
const Course = require('../models/Course'); // Temp for new Course
const { authMiddleware, requireInternalToken } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { sanitizeRegex } = require('../../../middleware/sanitizeRegex');
const logger = require('../../../config/logger');
const cache = require('../../../utils/cache');
const { getCachedSettings } = require('../../system/settingsCache');
const {
  sanitizeExamSubjects,
  resolveExamSubjectsForCourse,
  inferExamSubjectsFromCourseName,
} = require('../../exam/services/examSubjectCatalog');

const router = express.Router();
const courseController = require('../controllers/CourseController');
const courseWriteGuard = [authMiddleware, requireInternalToken, authorize(NEW_PERMISSIONS.COURSE_UPDATE)];
const COURSE_TTL = 120;
const COURSE_STATS_KEY = 'courses:stats';

async function invalidateCourseCache() {
  await cache.delByPrefix('courses:');
}

/** Catalog mặc định ẩn soft-deleted (`deletedAt: null` khớp cả field thiếu). */
function notDeletedFilter(includeDeleted = false) {
  if (includeDeleted === true || includeDeleted === '1' || includeDeleted === 'true') {
    return {};
  }
  return { deletedAt: null };
}

// ─── GET /api/courses/stats/summary — đặt trước /:id ───────────────────────────
router.get('/stats/summary',courseController.get_stats_summary);

// ─── GET /api/courses ─────────────────────────────────────────────────────────
router.get('/',courseController.get_root);

// ─── GET /api/courses/:id ─────────────────────────────────────────────────────
router.get('/:id',courseController.get_id);

function calcEffectivePrice(price, discountPercent) {
  if (!discountPercent || discountPercent <= 0) return price;
  return Math.round(price * (1 - discountPercent / 100));
}

async function loadCustomExamSubjects() {
  const settings = await getCachedSettings();
  return settings?.examSubjectsCustomRaw;
}

async function sanitizeCourseExamSubjects(list) {
  const custom = await loadCustomExamSubjects();
  return sanitizeExamSubjects(list, custom);
}

async function inferExamSubjects(body) {
  const custom = await loadCustomExamSubjects();
  return inferExamSubjectsFromCourseName(body.name, body.category, custom);
}

// ─── POST /api/courses ────────────────────────────────────────────────────────
router.post('/', courseWriteGuard,courseController.post_root);

// ─── PUT /api/courses/:id ─────────────────────────────────────────────────────
router.put('/:id', courseWriteGuard,courseController.put_id);

// ─── PATCH /api/courses/:id/price ─────────────────────────────────────────────
router.patch('/:id/price', courseWriteGuard,courseController.patch_id_price);

// ─── DELETE /api/courses/:id — soft-delete (không đụng ledger / enrollment) ───
router.delete('/:id', courseWriteGuard,courseController.delete_id);

// ─── POST /api/courses/:id/restore — khôi phục soft-delete ───────────────────
router.post('/:id/restore', courseWriteGuard,courseController.post_id_restore);

// ─── POST /api/courses/seed — chỉ non-production ─────────────────────────────
router.post('/seed', courseWriteGuard,courseController.post_seed);

module.exports = router;
