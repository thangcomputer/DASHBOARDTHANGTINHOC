const express    = require('express');
const router     = express.Router();
const ExamResult = require('../models/ExamResult');
const { authMiddleware } = require('../middleware/auth');
const NotificationService = require('../services/NotificationService');
const logger = require('../config/logger');

// GET /api/exam-results — lấy tất cả (hoặc lọc theo type)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    
    // Authorization: Admin/Staff/Teacher có thể xem tất cả, Student chỉ xem của mình
    if (req.user.role === 'student') {
      filter.studentId = req.user.id;
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
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Only Admin, Staff, or Teacher can create exam results
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền tạo kết quả thi' });
    }

    const result = new ExamResult(req.body);
    await result.save();

    // Notify student when an exam result is created/recorded
    const io = req.app.get('io');
    if (io && result.type === 'student' && result.studentId) {
      const subject = result.subject || 'bài thi';
      await NotificationService.send(io, {
        type: 'EXAM',
        title: '📝 Kết quả thi đã được ghi nhận',
        content: `Kết quả ${subject} của bạn đã được cập nhật. Vào mục Phòng Thi để xem chi tiết.`,
        receivers: String(result.studentId),
        payload: { examResultId: String(result._id), studentId: String(result.studentId), subject },
        link: '/student/exam'
      });
      io.emit('data:refresh', { type: 'examResult', id: result._id });
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/exam-results/:id — cập nhật (chấm điểm)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (!['admin', 'staff', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật kết quả thi' });
    }

    const existing = await ExamResult.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });

    const resolveScore = (doc) => {
      if (typeof doc.essayScore === 'number' && !Number.isNaN(doc.essayScore)) return doc.essayScore;
      const total = Number(doc.multipleChoiceTotal) || 0;
      const correct = Number(doc.multipleChoiceCorrect) || 0;
      if (total > 0) return Math.round((correct / total) * 100);
      return null;
    };

    const oldScore = resolveScore(existing);
    const patch = { ...req.body };
    delete patch.scoreHistory;

    const result = await ExamResult.findByIdAndUpdate(
      req.params.id,
      patch,
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

    // Notify student when result is graded/updated (pass/fail, score)
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
        payload: { examResultId: String(notifyDoc._id), studentId: String(notifyDoc.studentId), subject, passed: Boolean(notifyDoc.passed) },
        link: '/student/exam'
      });
      io.emit('data:refresh', { type: 'examResult', id: notifyDoc._id });
    }

    res.json({ success: true, data: refreshed || result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-results/:id — xóa
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xóa kết quả thi' });
    }

    const result = await ExamResult.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thi' });
    res.json({ success: true, message: 'Đã xóa kết quả thi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
