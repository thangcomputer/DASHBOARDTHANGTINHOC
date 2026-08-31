const express = require('express');
const router = express.Router();
const ExamResult = require('../models/ExamResult');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const {
  authMiddleware,
  branchFilter,
  userHasPermission,
} = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const NotificationService = require('../services/NotificationService');
const logger = require('../config/logger');
const { emitDataRefresh } = require('../utils/realtimeEmit');
const { pickExamResultCreate, pickExamResultUpdate } = require('../utils/examResultDto');
const { policyShadowExamResult } = require('../middleware/policyShadowExamResult');
const { examResultsCutoverGate } = require('../middleware/examResultsCutoverGate');

/**
 * Phase 7.30 — Controlled cutover for LIVE /api/exam-results ONLY.
 *
 * Flow: auth → branchFilter → policyShadowExamResult → examResultsCutoverGate → handler
 * Legacy: list/create/update authz remains handler-owned (authorizeExamMutation / list gates);
 *         delete MANAGE_* permission retained inside examResultsCutoverGate + handler branchAllows.
 * Notifications / emit / audit remain handler-owned.
 */
const examGuard = (action) => [
  authMiddleware,
  branchFilter,
  policyShadowExamResult(action),
  examResultsCutoverGate(action),
];

async function resolveExamRefreshScope(result) {
  if (result?.type === 'student' && result.studentId) {
    const student = await Student.findById(result.studentId).select('branchId teacherId').lean();
    return {
      branchId: student?.branchId || null,
      userIds: [result.studentId, student?.teacherId].filter(Boolean),
    };
  }
  if (result?.type === 'teacher' && result.teacherId) {
    const teacher = await Teacher.findById(result.teacherId).select('branchId').lean();
    return {
      branchId: teacher?.branchId || null,
      userIds: [result.teacherId],
    };
  }
  return { branchId: null, userIds: [] };
}

/** Trusted branch of the subject (student or teacher). Client branchId ignored. */
async function resolveSubjectBranch(doc) {
  if (doc?.type === 'student' && doc.studentId) {
    const student = await Student.findById(doc.studentId)
      .select('branchId teacherId enrollments')
      .lean();
    return {
      branchId: student?.branchId || null,
      student,
      teacher: null,
    };
  }
  if (doc?.type === 'teacher' && doc.teacherId) {
    const teacher = await Teacher.findById(doc.teacherId).select('branchId').lean();
    return {
      branchId: teacher?.branchId || null,
      student: null,
      teacher,
    };
  }
  return { branchId: null, student: null, teacher: null };
}

/**
 * Branch-bound actors: DENY when subject branch differs or cannot be proven.
 * Super (no userBranchId): ALLOW.
 */
function branchAllows(req, subjectBranchId) {
  if (!req.userBranchId) return { ok: true };
  if (!subjectBranchId) {
    return { ok: false, status: 403, message: 'Không xác định được chi nhánh của kết quả thi' };
  }
  if (String(subjectBranchId) !== String(req.userBranchId)) {
    return { ok: false, status: 403, message: 'Không có quyền thao tác kết quả thi chi nhánh khác' };
  }
  return { ok: true };
}

async function staffCanManageExam(req, type) {
  if (req.user?.id === 'admin') return true;
  if (type === 'teacher') {
    return userHasPermission(req.user, PERMISSIONS.MANAGE_TRAINING);
  }
  const a = await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS);
  const b = await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENT_TRAINING);
  return a || b;
}

async function authorizeExamMutation(req, doc) {
  const role = String(req.user?.role || '').toLowerCase();
  const { branchId } = await resolveSubjectBranch(doc);
  const br = branchAllows(req, branchId);
  if (!br.ok) return br;

  if (role === 'student') {
    return { ok: false, status: 403, message: 'Học viên không được tạo/sửa kết quả thi' };
  }

  if (role === 'teacher') {
    return {
      ok: false,
      status: 403,
      message: 'Giảng viên không được tự tạo hoặc sửa kết quả thi',
    };
  }

  if (role === 'admin' || role === 'staff') {
    const allowed = await staffCanManageExam(req, doc.type);
    if (!allowed) {
      return { ok: false, status: 403, message: 'Thiếu quyền quản lý kết quả thi' };
    }
    return { ok: true, branchId };
  }

  return { ok: false, status: 403, message: 'Không có quyền' };
}

// GET /api/exam-results
router.get('/', examGuard('list'), async (req, res) => {
  try {
    const role = String(req.user.role || '').toLowerCase();
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    if (role === 'student') {
      filter.studentId = String(req.user.id);
    } else if (role === 'teacher') {
      const myStudents = await Student.find({
        $or: [
          { teacherId: req.user.id },
          { 'enrollments.teacherId': req.user.id },
        ],
      }).select('_id').lean();
      const sids = myStudents.map((s) => String(s._id));
      filter.$or = [
        { type: 'teacher', teacherId: String(req.user.id) },
        { type: 'student', studentId: { $in: sids } },
      ];
    } else if (role === 'admin' || role === 'staff') {
      const can =
        (await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS))
        || (await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENT_TRAINING))
        || (await userHasPermission(req.user, PERMISSIONS.MANAGE_TRAINING));
      if (!can) {
        return res.status(403).json({ success: false, message: 'Thiếu quyền xem kết quả thi' });
      }
      if (req.userBranchId) {
        const [branchTeachers, branchStudents] = await Promise.all([
          Teacher.find({ branchId: req.userBranchId }).select('_id').lean(),
          Student.find({ branchId: req.userBranchId }).select('_id').lean(),
        ]);
        const tids = branchTeachers.map((t) => String(t._id));
        const sids = branchStudents.map((s) => String(s._id));
        filter.$or = [
          { type: 'teacher', teacherId: { $in: tids } },
          { type: 'student', studentId: { $in: sids } },
        ];
      }
    } else {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const skip = (pageNum - 1) * limitNum;

    const [results, total] = await Promise.all([
      ExamResult.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      ExamResult.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exam-results
router.post('/', examGuard('create'), async (req, res) => {
  try {
    const data = pickExamResultCreate(req.body);
    // Ignore client spoof of branch/tenant/system fields (not in allowlist)
    if (!['student', 'teacher'].includes(data.type)) {
      return res.status(400).json({ success: false, message: 'type không hợp lệ' });
    }
    if (data.type === 'student' && !data.studentId) {
      return res.status(400).json({ success: false, message: 'Thiếu studentId' });
    }
    if (data.type === 'teacher' && !data.teacherId) {
      return res.status(400).json({ success: false, message: 'Thiếu teacherId' });
    }

    const authz = await authorizeExamMutation(req, data);
    if (!authz.ok) {
      return res.status(authz.status).json({ success: false, message: authz.message });
    }

    const result = new ExamResult(data);
    await result.save();

    const io = req.app.get('io');
    if (io && result.type === 'student' && result.studentId) {
      const subject = result.subject || 'bài thi';
      await NotificationService.send(io, {
        type: 'EXAM',
        title: '📝 Kết quả thi đã được ghi nhận',
        content: `Kết quả ${subject} của bạn đã được cập nhật. Vào mục Phòng Thi để xem chi tiết.`,
        receivers: String(result.studentId),
        payload: { examResultId: String(result._id), studentId: String(result.studentId), subject },
        link: '/student/exam',
      });
      const scope = await resolveExamRefreshScope(result);
      emitDataRefresh(io, { type: 'examResult', id: result._id }, scope);
    }

    if (io && result.type === 'teacher' && result.teacherId) {
      const subject = result.subject || 'bài thi GV';
      const outcome = result.passed ? 'ĐẠT' : 'CHƯA ĐẠT';
      const name = result.teacherName || 'Giảng viên';
      await NotificationService.notifyAdmins(
        io,
        result.passed ? '🎉 Giảng viên thi đạt' : '❌ Giảng viên thi chưa đạt',
        `GV ${name} — ${subject}: ${outcome}.`,
        {
          examResultId: String(result._id),
          teacherId: String(result.teacherId),
          passed: Boolean(result.passed),
        },
        '/admin#training',
      );
      await NotificationService.send(io, {
        type: 'EXAM',
        title: result.passed ? '🎉 Bạn đã thi đạt' : '📊 Kết quả thi đã ghi nhận',
        content: `${subject}: ${outcome}.`,
        receivers: String(result.teacherId),
        payload: {
          examResultId: String(result._id),
          teacherId: String(result.teacherId),
          passed: Boolean(result.passed),
        },
        link: '/teacher/test',
      });
      const scope = await resolveExamRefreshScope(result);
      emitDataRefresh(io, { type: 'examResult', id: result._id }, scope);
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/exam-results/:id
router.put('/:id', examGuard('update'), async (req, res) => {
  try {
    const existing = await ExamResult.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });

    const authz = await authorizeExamMutation(req, existing);
    if (!authz.ok) {
      return res.status(authz.status).json({ success: false, message: authz.message });
    }

    const resolveScore = (doc) => {
      if (typeof doc.essayScore === 'number' && !Number.isNaN(doc.essayScore)) return doc.essayScore;
      const total = Number(doc.multipleChoiceTotal) || 0;
      const correct = Number(doc.multipleChoiceCorrect) || 0;
      if (total > 0) return Math.round((correct / total) * 100);
      return null;
    };

    const oldScore = resolveScore(existing);
    const patch = pickExamResultUpdate(req.body);

    const result = await ExamResult.findByIdAndUpdate(
      req.params.id,
      { $set: patch },
      { returnDocument: 'after', runValidators: true },
    );

    const newScore = resolveScore(result);
    const scoreChanged = newScore != null && oldScore !== newScore;

    if (scoreChanged) {
      await ExamResult.findByIdAndUpdate(req.params.id, {
        $push: {
          scoreHistory: {
            at: new Date(),
            oldScore,
            newScore,
            actorUserId: String(req.user?.id || ''),
            actorRole: String(req.user?.role || ''),
            actorName: String(req.user?.name || ''),
            note: String(req.body.essayNote || '').slice(0, 300),
          },
        },
      });
      try {
        const { writeAudit } = require('../services/auditLogService');
        await writeAudit({
          action: 'exam.score_change',
          actorUserId: String(req.user?.id || ''),
          actorRole: String(req.user?.role || ''),
          entityType: 'examResult',
          entityId: String(result._id),
          studentId: result.studentId || null,
          oldValue: { oldScore },
          newValue: { newScore },
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });
      } catch (auditErr) {
        logger.warn('[EXAM] score audit: %s', auditErr.message);
      }
    }

    const refreshed = await ExamResult.findById(req.params.id);
    const notifyDoc = refreshed || result;

    const io = req.app.get('io');
    if (io && notifyDoc.type === 'student' && notifyDoc.studentId) {
      const subject = notifyDoc.subject || 'bài thi';
      const mc = (notifyDoc.multipleChoiceTotal || 0) > 0
        ? `Trắc nghiệm: ${notifyDoc.multipleChoiceCorrect || 0}/${notifyDoc.multipleChoiceTotal}`
        : '';
      const essay = typeof notifyDoc.essayScore === 'number'
        ? `Tự luận/Thực hành: ${notifyDoc.essayScore}`
        : '';
      const parts = [mc, essay].filter(Boolean).join(' · ');
      const outcome = notifyDoc.passed ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT';
      await NotificationService.send(io, {
        type: 'EXAM',
        title: `📊 Kết quả thi: ${outcome}`,
        content: parts ? `${subject} — ${outcome}. ${parts}.` : `${subject} — ${outcome}.`,
        receivers: String(notifyDoc.studentId),
        payload: {
          examResultId: String(notifyDoc._id),
          studentId: String(notifyDoc.studentId),
          subject,
          passed: Boolean(notifyDoc.passed),
        },
        link: '/student/exam',
      });
      const scope = await resolveExamRefreshScope(notifyDoc);
      emitDataRefresh(io, { type: 'examResult', id: notifyDoc._id }, scope);
    }

    if (io && notifyDoc.type === 'teacher' && notifyDoc.teacherId) {
      const subject = notifyDoc.subject || 'bài thi GV';
      const outcome = notifyDoc.passed ? 'ĐẠT' : 'CHƯA ĐẠT';
      const name = notifyDoc.teacherName || 'Giảng viên';
      await NotificationService.notifyAdmins(
        io,
        notifyDoc.passed ? '🎉 Giảng viên thi đạt' : '❌ Giảng viên thi chưa đạt',
        `GV ${name} — ${subject}: ${outcome}.`,
        {
          examResultId: String(notifyDoc._id),
          teacherId: String(notifyDoc.teacherId),
          passed: Boolean(notifyDoc.passed),
        },
        '/admin#training',
      );
      await NotificationService.send(io, {
        type: 'EXAM',
        title: `📊 Kết quả thi: ${notifyDoc.passed ? '✅ ĐẠT' : '❌ CHƯA ĐẠT'}`,
        content: `${subject} — ${outcome}.`,
        receivers: String(notifyDoc.teacherId),
        payload: {
          examResultId: String(notifyDoc._id),
          teacherId: String(notifyDoc.teacherId),
          passed: Boolean(notifyDoc.passed),
        },
        link: '/teacher/test',
      });
      const scope = await resolveExamRefreshScope(notifyDoc);
      emitDataRefresh(io, { type: 'examResult', id: notifyDoc._id }, scope);
    }

    res.json({ success: true, data: refreshed || result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-results/:id
router.delete(
  '/:id',
  examGuard('delete'),
  async (req, res) => {
    try {
      const existing = await ExamResult.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });

      const { branchId } = await resolveSubjectBranch(existing);
      const br = branchAllows(req, branchId);
      if (!br.ok) {
        return res.status(br.status).json({ success: false, message: br.message });
      }

      await ExamResult.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Đã xóa kết quả thi' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
module.exports._test = {
  pickExamResultCreate,
  pickExamResultUpdate,
  branchAllows,
  authorizeExamMutation,
  resolveSubjectBranch,
};
