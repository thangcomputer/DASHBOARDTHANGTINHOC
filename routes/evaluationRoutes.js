const express = require('express');
const Evaluation = require('../models/Evaluation');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { authMiddleware, branchFilter } = require('../middleware/auth');
const { policyShadowEvaluation } = require('../middleware/policyShadowEvaluation');
const { evaluationsCutoverGate } = require('../middleware/evaluationsCutoverGate');
const { emitDataRefresh } = require('../utils/realtimeEmit');

const router = express.Router();

function enrollmentTeacherId(enr) {
  const et = enr?.teacherId;
  if (et && typeof et === 'object') return String(et._id || et.id || '');
  return String(et || '');
}

/** Công khai: cần ≥ 1/2 buổi đăng ký. Cuối khóa (finalizeCourseEnd) không dùng rule này. */
function teacherRatingHalfway(student, { teacherId, courseName } = {}) {
  const list = Array.isArray(student?.enrollments) ? student.enrollments : [];
  const courseKey = String(courseName || '').trim().toLowerCase();
  let enr = courseKey
    ? list.find((e) => String(e.courseName || e.name || '').trim().toLowerCase() === courseKey)
    : null;
  const tid = String(teacherId || '');
  if (!enr && tid) {
    enr = list.find((e) => enrollmentTeacherId(e) === tid) || null;
  }
  const completed = Math.max(0, Number(enr?.completedSessions ?? student?.completedSessions) || 0);
  const total = Math.max(1, Number(enr?.totalSessions ?? student?.totalSessions) || 12);
  return {
    ok: completed * 2 >= total,
    completed,
    total,
    need: Math.ceil(total / 2),
  };
}

/** Phase 7.25: policyShadowEvaluation → evaluationsCutoverGate */
function evaluationsGuard(action) {
  return [policyShadowEvaluation(action), evaluationsCutoverGate(action)];
}

// ─── ADMIN lấy danh sách phản hồi mật ──────────────────────────────────────
router.get('/admin', authMiddleware, branchFilter, ...evaluationsGuard('admin_list'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const bf = req.branchFilter || {};
    if (bf._id && bf._id.$in && Array.isArray(bf._id.$in) && bf._id.$in.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const query = { type: 'admin_feedback' };
    if (Object.prototype.hasOwnProperty.call(bf, 'branchId')) {
      const studentIds = await Student.find({ branchId: bf.branchId }).select('_id').lean();
      if (studentIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      query.studentId = { $in: studentIds.map((s) => s._id) };
    }

    const evals = await Evaluation.find(query).sort({ updatedAt: -1, createdAt: -1 });
    const seen = new Set();
    const uniqueEvals = [];
    for (const e of evals) {
      const key = `${e.studentId}_${e.courseName || ''}_${e.milestone || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvals.push(e);
      }
    }

    const data = uniqueEvals.map(e => ({
      ...e.toObject(),
      id: e._id,
      date: new Date(e.createdAt || e.updatedAt).toLocaleDateString('vi-VN')
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Lấy Review Công khai của Giáo viên ────────────────────────────────────
router.get('/teacher/:teacherId', authMiddleware, ...evaluationsGuard('teacher_ratings'), async (req, res) => {
  try {
    const evals = await Evaluation.find({ type: 'teacher_rating', targetTeacherId: req.params.teacherId }).sort({ updatedAt: -1, createdAt: -1 });
    const seen = new Set();
    const uniqueEvals = [];
    for (const e of evals) {
      const key = String(e.studentId);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvals.push(e);
      }
    }

    const data = uniqueEvals.map(e => ({
      ...e.toObject(),
      id: e._id,
      date: new Date(e.createdAt || e.updatedAt).toLocaleDateString('vi-VN')
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Học viên lấy đánh giá mốc của chính mình (chặn popup khi đã gửi) ─────
router.get('/mine', authMiddleware, ...evaluationsGuard('student_mine'), async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    const evals = await Evaluation.find({
      studentId: req.user.id,
      type: 'admin_feedback',
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const data = evals.map((e) => ({
      ...e,
      id: e._id,
      studentId: String(e.studentId || ''),
      comment: e.content || e.comment || '',
      date: new Date(e.createdAt || e.updatedAt).toLocaleDateString('vi-VN'),
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Học viên gửi hoặc cập nhật đánh giá ───────────────────────────────────
router.post('/', authMiddleware, ...evaluationsGuard('create'), async (req, res) => {
  try {
    const { studentId, targetTeacherId, courseId, type, criteria, content, studentName, teacherName, courseName, milestone, finalizeCourseEnd } = req.body;
    
    // Authorization: Học viên chỉ gửi đánh giá cho chính mình
    if (req.user.role === 'student' && String(req.user.id) !== String(studentId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi đánh giá thay người khác' });
    }

    let evalDoc = null;
    let isUpdate = false;
    if (type === 'teacher_rating') {
      evalDoc = await Evaluation.findOne({ studentId, targetTeacherId, type: 'teacher_rating' });
      // Khóa sau lần gửi cuối khóa. Popup cuối khóa gửi finalizeCourseEnd = lần sửa cuối được phép.
      const allowFinalEdit = Boolean(finalizeCourseEnd);
      if (!allowFinalEdit) {
        const finalQ = {
          studentId,
          type: 'admin_feedback',
          milestone: 'course_end_teacher',
        };
        if (courseName) finalQ.courseName = courseName;
        const finalized = await Evaluation.findOne(finalQ).select('_id').lean();
        if (finalized) {
          return res.status(409).json({
            success: false,
            code: 'TEACHER_RATING_LOCKED',
            message: 'Bạn đã hoàn tất đánh giá cuối khóa. Không thể sửa hoặc gửi lại đánh giá giảng viên.',
            data: evalDoc || null,
          });
        }
      }
      if (req.user.role === 'student' && !allowFinalEdit) {
        const studentDoc = await Student.findById(studentId)
          .select('completedSessions totalSessions enrollments')
          .lean();
        if (studentDoc) {
          const gate = teacherRatingHalfway(studentDoc, { teacherId: targetTeacherId, courseName });
          if (!gate.ok) {
            return res.status(403).json({
              success: false,
              code: 'TOO_EARLY_TO_RATE',
              message: `Chưa đủ buổi để được đánh giá. Cần học ít nhất ${gate.need}/${gate.total} buổi.`,
            });
          }
        }
      }
    } else if (type === 'admin_feedback') {
      evalDoc = await Evaluation.findOne({ studentId, courseName, milestone, type: 'admin_feedback' });
    }

    if (evalDoc) {
      isUpdate = true;
      if (criteria !== undefined) evalDoc.criteria = criteria;
      if (content !== undefined) evalDoc.content = content;
      if (studentName !== undefined) evalDoc.studentName = studentName;
      if (teacherName !== undefined) evalDoc.teacherName = teacherName;
      if (courseName !== undefined) evalDoc.courseName = courseName;
      if (courseId !== undefined) evalDoc.courseId = courseId;
      if (milestone !== undefined) evalDoc.milestone = milestone;
      evalDoc.read = false;
      evalDoc.isReadByAdmin = false;
      await evalDoc.save();
    } else {
      evalDoc = new Evaluation({
        studentId, targetTeacherId, courseId, type, criteria, content, studentName, teacherName, courseName, milestone
      });
      await evalDoc.save();
    }

    // Tự động tính toán lại điểm averageRating của Teacher trong MongoDB
    if (type === 'teacher_rating' && targetTeacherId && targetTeacherId !== 'current') {
      try {
        const allTeacherRatings = await Evaluation.find({ targetTeacherId, type: 'teacher_rating' }).sort({ updatedAt: -1, createdAt: -1 });
        const seenStudents = new Set();
        const validRatings = [];
        for (const r of allTeacherRatings) {
          const sid = String(r.studentId);
          if (!seenStudents.has(sid)) {
            seenStudents.add(sid);
            if (r.criteria && typeof r.criteria.stars === 'number' && !isNaN(r.criteria.stars)) {
              validRatings.push(r.criteria.stars);
            }
          }
        }
        const avgRating = validRatings.length > 0
          ? (Math.round((validRatings.reduce((s, v) => s + v, 0) / validRatings.length) * 10) / 10)
          : 0;
        await Teacher.findByIdAndUpdate(targetTeacherId, {
          averageRating: avgRating,
          ratingCount: validRatings.length,
        });
      } catch (tErr) {
        console.error('Lỗi khi tính lại averageRating cho GV:', tErr);
      }
    }

    const io = req.app.get('io');
    let studentInfo = null;
    try {
      studentInfo = await Student.findById(studentId);
    } catch (sErr) {
      console.error('[EVALUATIONS] studentInfo:', sErr.message);
    }

    if (io) {
      if (type === 'admin_feedback') {
        io.to('admin_room').emit('evaluation:admin_feedback', evalDoc);
        try {
          const NotificationService = require('../services/NotificationService');
          await NotificationService.send(io, {
            type: 'EVALUATION',
            title: '📢 Đánh giá nội bộ mới',
            content: `Học viên ${studentInfo?.name || 'Vô danh'} vừa gửi phản hồi mật${milestone ? ` (${milestone})` : ''}.`,
            receivers: 'ALL_ADMIN',
            payload: {
              kind: 'admin_feedback',
              evaluationId: String(evalDoc._id || evalDoc.id),
              studentId: String(studentId),
              milestone: milestone || null,
            },
            link: '/admin#evaluations',
          });
        } catch (nErr) {
          console.error('Notify admin feedback error:', nErr);
        }
      } else {
        io.to(`teacher_${targetTeacherId}`).emit('evaluation:teacher_rating', evalDoc);
        
        // Notify Teacher
        if (targetTeacherId && targetTeacherId !== 'current') {
           const NotificationService = require('../services/NotificationService');
           const evalId = String(evalDoc._id || evalDoc.id);
           const stars = evalDoc?.criteria?.stars;
           const rawName = studentInfo?.name || 'Vô danh';
           const hvLabel = `⟦student_detail:${studentId}:profile|${rawName}⟧`;
           const starsBit = stars != null ? ` ${stars}/5 sao` : '';
           try {
             await NotificationService.send(io, {
               type: 'EVALUATION',
               title: isUpdate
                 ? '⭐ Học viên cập nhật lại đánh giá'
                 : '⭐ Đánh giá mới từ học viên',
               content: isUpdate
                 ? `Học viên ${hvLabel} đã cập nhật lại đánh giá${starsBit}.`
                 : `Học viên ${hvLabel} đã đánh giá bạn${starsBit}.`,
               receivers: targetTeacherId.toString(),
               payload: {
                 kind: 'teacher_rating',
                 evaluationId: evalId,
                 studentId: String(studentId),
                 stars: stars ?? null,
                 isUpdate: !!isUpdate,
               },
               link: `/teacher?evaluationId=${encodeURIComponent(evalId)}`,
             });
           } catch (nErr) {
             console.error('Notify teacher rating error:', nErr);
           }

           // Fire-and-forget: đủ mốc thưởng sao thì báo GV (idempotent theo tháng)
           try {
             const { maybeNotifyStarBonusEligibility } = require('../services/teacherAdminNotifier');
             maybeNotifyStarBonusEligibility(io, targetTeacherId).catch(() => {});
           } catch (_) { /* ignore */ }

           const teacherDoc = await Teacher.findById(targetTeacherId).select('branchId').lean();
           emitDataRefresh(io, { type: 'evaluation', targetId: targetTeacherId }, {
             branchId: teacherDoc?.branchId || studentInfo?.branchId || null,
             userIds: [targetTeacherId, studentId].filter(Boolean),
           });
        }
      }
    }
    return res.json({ success: true, data: evalDoc, meta: { isUpdate: !!isUpdate } });
  } catch (err) {
    console.error('[EVALUATIONS] POST error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Đánh dấu đã đọc đánh giá ───────────────────────────────────────────────
router.post('/:id/read', authMiddleware, ...evaluationsGuard('mark_read'), async (req, res) => {
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

    ev.read = true;
    ev.isReadByAdmin = (req.user.role === 'admin' || req.user.role === 'staff');
    await ev.save();
    
    return res.json({ success: true, message: 'Đã đánh dấu đã xem' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
