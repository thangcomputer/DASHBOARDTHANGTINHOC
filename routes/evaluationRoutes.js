const express = require('express');
const Evaluation = require('../models/Evaluation');
const { authMiddleware, branchFilter, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { listStudentIdsInActorBranch } = require('../utils/branchScope');
const {
  submitTeacherRating,
  moderateRating,
  publicRatingFilter,
  aggregateStars,
} = require('../services/ratingLifecycleService');
const logger = require('../config/logger');

const router = express.Router();

function canModerateRatings(role) {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'staff';
}

// ─── ADMIN lấy danh sách phản hồi mật ──────────────────────────────────────
router.get('/admin', authMiddleware, branchFilter, async (req, res) => {
  try {
    if (!canModerateRatings(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const filter = { type: 'admin_feedback' };
    const sIds = await listStudentIdsInActorBranch(req);
    if (sIds) filter.studentId = { $in: sIds };

    const evals = await Evaluation.find(filter).sort({ createdAt: -1 });
    const data = evals.map(e => ({
      ...e.toObject(),
      id: e._id,
      date: new Date(e.createdAt).toLocaleDateString('vi-VN')
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── ADMIN hàng đợi duyệt rating GV (Phase 11) ───────────────────────────────
router.get(
  '/admin/ratings',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.VIEW_EVALUATIONS),
  async (req, res) => {
    try {
      if (!canModerateRatings(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Không có quyền duyệt đánh giá' });
      }

      const filter = { type: 'teacher_rating' };
      if (req.query.status) filter.status = String(req.query.status);
      const sIds = await listStudentIdsInActorBranch(req);
      if (sIds) filter.studentId = { $in: sIds };

      const evals = await Evaluation.find(filter).sort({ createdAt: -1 }).limit(500);
      const data = evals.map((e) => ({
        ...e.toObject(),
        id: e._id,
        date: new Date(e.createdAt).toLocaleDateString('vi-VN'),
      }));
      return res.json({ success: true, data });
    } catch (err) {
      logger.error('[EVAL] admin ratings:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  },
);

// ─── Lấy Review Công khai của Giáo viên (chỉ approved) ───────────────────────
router.get('/teacher/:teacherId', authMiddleware, async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    const includeAll = canModerateRatings(role) && req.query.all === '1';

    const filter = includeAll
      ? { type: 'teacher_rating', targetTeacherId: req.params.teacherId }
      : publicRatingFilter({ targetTeacherId: req.params.teacherId });

    const evals = await Evaluation.find(filter).sort({ createdAt: -1 });
    const data = evals.map(e => ({
      ...e.toObject(),
      id: e._id,
      date: new Date(e.createdAt).toLocaleDateString('vi-VN')
    }));
    const agg = aggregateStars(evals);
    return res.json({
      success: true,
      data,
      meta: { avg: agg.avg, count: agg.count, publicOnly: !includeAll },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Học viên gửi đánh giá ──────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      studentId, targetTeacherId, courseId, type, criteria, content,
      studentName, teacherName, courseName, milestone, enrollmentId, stars,
    } = req.body;

    // Authorization: Học viên chỉ gửi đánh giá cho chính mình
    if (req.user.role === 'student' && String(req.user.id) !== String(studentId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi đánh giá thay người khác' });
    }

    // admin_feedback giữ flow cũ
    if (type === 'admin_feedback') {
      if (req.user.role === 'student' && String(req.user.id) !== String(studentId)) {
        return res.status(403).json({ success: false, message: 'Không có quyền' });
      }
      const newEval = new Evaluation({
        studentId, targetTeacherId, courseId, type, criteria, content,
        studentName, teacherName, courseName, milestone,
        status: 'approved', // feedback nội bộ không cần moderate public
      });
      await newEval.save();
      const io = req.app.get('io');
      if (io) {
        io.to('admin_room').emit('evaluation:admin_feedback', newEval);
      }
      return res.json({ success: true, data: newEval });
    }

    // teacher_rating — Phase 11 lifecycle
    const result = await submitTeacherRating({
      studentId,
      targetTeacherId,
      courseId,
      enrollmentId,
      criteria,
      content,
      studentName,
      teacherName,
      courseName,
      milestone,
      stars,
      actor: { id: req.user.id, role: req.user.role },
      io: req.app.get('io'),
      reqMeta: {
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        branchId: req.userBranchId || null,
      },
    });

    return res.json({
      success: true,
      data: result.evaluation,
      meta: {
        status: result.status,
        created: result.created,
        pendingModeration: result.status === 'pending',
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status < 500) {
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code || undefined,
      });
    }
    logger.error('[EVAL] submit:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/evaluations/:id/moderate — approve|reject|hide ─────────────────
router.put(
  '/:id/moderate',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.VIEW_EVALUATIONS),
  async (req, res) => {
    try {
      if (!canModerateRatings(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Không có quyền duyệt đánh giá' });
      }

      const { action, reason = '' } = req.body || {};
      const doc = await moderateRating({
        evaluationId: req.params.id,
        action,
        reason,
        actor: { id: req.user.id, role: req.user.role },
        io: req.app.get('io'),
        reqMeta: {
          ip: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          branchId: req.userBranchId || null,
        },
      });

      return res.json({
        success: true,
        message: `Đã ${doc.status} đánh giá`,
        data: doc,
      });
    } catch (err) {
      const status = err.status || 500;
      if (status < 500) {
        return res.status(status).json({ success: false, message: err.message });
      }
      logger.error('[EVAL] moderate:', err);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  },
);

// ─── Đánh dấu đã đọc đánh giá ───────────────────────────────────────────────
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const ev = await Evaluation.findById(req.params.id);
    if (!ev) return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá' });

    // Authorization: GV chỉ được đánh dấu đã đọc đánh giá của mình
    if (req.user.role === 'teacher' && String(ev.targetTeacherId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    // GV không đọc được pending (chưa public)
    if (
      req.user.role === 'teacher'
      && ev.type === 'teacher_rating'
      && ev.status
      && ev.status !== 'approved'
    ) {
      return res.status(403).json({ success: false, message: 'Đánh giá chưa được duyệt công khai' });
    }

    ev.read = true;
    ev.isReadByAdmin = (req.user.role === 'admin' || req.user.role === 'staff');
    await ev.save();

    return res.json({ success: true, message: 'Đã đánh dấu đã xem' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
