const express    = require('express');
const router     = express.Router();
const ExamResult = require('../models/ExamResult');
const { authMiddleware, branchFilter } = require('../middleware/auth');
const NotificationService = require('../services/NotificationService');
const {
  examResultBranchClause,
  assertStudentBranch,
  assertTeacherBranch,
} = require('../utils/branchScope');

// GET /api/exam-results — lấy tất cả (hoặc lọc theo type) — branch-scoped cho Staff
router.get('/', authMiddleware, branchFilter, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    // Authorization: Student chỉ xem của mình
    if (req.user.role === 'student') {
      filter.studentId = req.user.id;
    } else if (req.user.role === 'teacher') {
      // GV: kết quả thi của mình (type teacher) hoặc không list all HV
      filter.teacherId = String(req.user.id);
    } else {
      const clause = await examResultBranchClause(req);
      if (clause) Object.assign(filter, clause);
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

// POST /api/exam-results — thêm kết quả thi mới
router.post('/', authMiddleware, branchFilter, async (req, res) => {
  try {
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền tạo kết quả thi' });
    }

    if (req.body.studentId) {
      const ok = await assertStudentBranch(req, res, req.body.studentId);
      if (!ok) return undefined;
    }
    if (req.body.teacherId && req.user.role !== 'teacher') {
      const ok = await assertTeacherBranch(req, res, req.body.teacherId);
      if (!ok) return undefined;
    }
    if (req.user.role === 'teacher') {
      req.body.teacherId = String(req.user.id);
    }

    const result = new ExamResult(req.body);
    await result.save();

    const io = req.app.get('io');
    if (io && result.type === 'student' && result.studentId) {
      const subject = result.subject || 'bài thi';
      const outcome = result.passed ? 'ĐẠT' : 'KHÔNG ĐẠT';
      try {
        await NotificationService.sendFromTemplate(io, {
          templateCode: 'EXAM_RESULT',
          receivers: [String(result.studentId)],
          data: { subject, outcome, detail: '' },
          eventId: `exam.result:${result._id}`,
          payload: { examResultId: String(result._id), studentId: String(result.studentId), subject, passed: result.passed },
        });
      } catch {
        await NotificationService.send(io, {
          type: 'EXAM',
          title: '📝 Kết quả thi đã được ghi nhận',
          content: `Kết quả ${subject} của bạn đã được cập nhật. Vào mục Phòng Thi để xem chi tiết.`,
          receivers: String(result.studentId),
          payload: { examResultId: String(result._id), studentId: String(result.studentId), subject },
          link: '/student/exam',
          eventId: `exam.result:${result._id}`,
        });
      }
      io.emit('data:refresh', { type: 'examResult', id: result._id });
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/exam-results/:id — cập nhật (chấm điểm)
router.put('/:id', authMiddleware, branchFilter, async (req, res) => {
  try {
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật kết quả thi' });
    }

    const existing = await ExamResult.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });

    if (existing.studentId) {
      const ok = await assertStudentBranch(req, res, existing.studentId);
      if (!ok) return undefined;
    } else if (existing.teacherId) {
      const ok = await assertTeacherBranch(req, res, existing.teacherId);
      if (!ok) return undefined;
    }

    const result = await ExamResult.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after', runValidators: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });

    const io = req.app.get('io');
    if (io && result.type === 'student' && result.studentId) {
      const subject = result.subject || 'bài thi';
      const mc = (result.multipleChoiceTotal || 0) > 0
        ? `Trắc nghiệm: ${result.multipleChoiceCorrect || 0}/${result.multipleChoiceTotal}`
        : '';
      const essay = typeof result.essayScore === 'number'
        ? `Tự luận/Thực hành: ${result.essayScore}`
        : '';
      const parts = [mc, essay].filter(Boolean).join(' · ');
      const outcome = result.passed ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT';
      await NotificationService.send(io, {
        type: 'EXAM',
        title: `📊 Kết quả thi: ${outcome}`,
        content: parts ? `${subject} — ${outcome}. ${parts}.` : `${subject} — ${outcome}.`,
        receivers: String(result.studentId),
        payload: { examResultId: String(result._id), studentId: String(result.studentId), subject, passed: result.passed },
        link: '/student/exam'
      });
      io.emit('data:refresh', { type: 'examResult', id: result._id });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-results/:id
router.delete('/:id', authMiddleware, branchFilter, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa kết quả thi' });
    }

    const existing = await ExamResult.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });
    if (existing.studentId) {
      const ok = await assertStudentBranch(req, res, existing.studentId);
      if (!ok) return undefined;
    } else if (existing.teacherId) {
      const ok = await assertTeacherBranch(req, res, existing.teacherId);
      if (!ok) return undefined;
    }

    await ExamResult.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa kết quả thi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
