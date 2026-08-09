const express = require('express');
const Evaluation = require('../models/Evaluation');
const Teacher = require('../models/Teacher');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowEvaluation } = require('../middleware/policyShadowEvaluation');
const { evaluationsCutoverGate } = require('../middleware/evaluationsCutoverGate');
const { emitDataRefresh } = require('../utils/realtimeEmit');

const router = express.Router();

/** Phase 7.25: policyShadowEvaluation → evaluationsCutoverGate */
function evaluationsGuard(action) {
  return [policyShadowEvaluation(action), evaluationsCutoverGate(action)];
}

// ─── ADMIN lấy danh sách phản hồi mật ──────────────────────────────────────
router.get('/admin', authMiddleware, ...evaluationsGuard('admin_list'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const evals = await Evaluation.find({ type: 'admin_feedback' }).sort({ updatedAt: -1, createdAt: -1 });
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

// ─── Học viên gửi hoặc cập nhật đánh giá ───────────────────────────────────
router.post('/', authMiddleware, ...evaluationsGuard('create'), async (req, res) => {
  try {
    const { studentId, targetTeacherId, courseId, type, criteria, content, studentName, teacherName, courseName, milestone } = req.body;
    
    // Authorization: Học viên chỉ gửi đánh giá cho chính mình
    if (req.user.role === 'student' && String(req.user.id) !== String(studentId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi đánh giá thay người khác' });
    }

    let evalDoc = null;
    if (type === 'teacher_rating') {
      evalDoc = await Evaluation.findOne({ studentId, targetTeacherId, type: 'teacher_rating' });
    } else if (type === 'admin_feedback') {
      evalDoc = await Evaluation.findOne({ studentId, courseName, milestone, type: 'admin_feedback' });
    }

    if (evalDoc) {
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
        await Teacher.findByIdAndUpdate(targetTeacherId, { averageRating: avgRating });
      } catch (tErr) {
        console.error('Lỗi khi tính lại averageRating cho GV:', tErr);
      }
    }

    const io = req.app.get('io');
    const Student = require('../models/Student');
    const studentInfo = await Student.findById(studentId);

    if (io) {
      if (type === 'admin_feedback') {
        io.to('admin_room').emit('evaluation:admin_feedback', evalDoc);
      } else {
        io.to(`teacher_${targetTeacherId}`).emit('evaluation:teacher_rating', evalDoc);
        
        // Notify Teacher
        if (targetTeacherId && targetTeacherId !== 'current') {
           const NotificationService = require('../services/NotificationService');
           await NotificationService.send(io, {
             type: 'EVALUATION',
             title: '⭐ Đánh giá mới từ học viên',
             content: `Học viên ${studentInfo?.name || 'Vô danh'} đã đánh giá bạn.`,
             receivers: targetTeacherId.toString(),
             payload: { evaluationId: evalDoc._id },
             link: '/teacher'
           });

           const teacherDoc = await Teacher.findById(targetTeacherId).select('branchId').lean();
           emitDataRefresh(io, { type: 'evaluation', targetId: targetTeacherId }, {
             branchId: teacherDoc?.branchId || studentInfo?.branchId || null,
             userIds: [targetTeacherId, studentId].filter(Boolean),
           });
        }
      }
    }
    return res.json({ success: true, data: evalDoc });
  } catch (err) {
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
