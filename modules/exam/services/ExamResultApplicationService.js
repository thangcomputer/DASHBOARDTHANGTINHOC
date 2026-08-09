'use strict';
const { examResultRepository } = require('./../repositories');
const ExamResult = require('./../models/ExamResult'); // Temp for new ExamResult
const NotificationService = require('./../../notification/services/NotificationService');
const logger = require('./../../../config/logger');

const router     = express.Router();
// GET /api/exam-results — lấy tất cả (hoặc lọc theo type)

class ExamResultApplicationService {
  async get_root(data) {
  try {
    const filter = {};
    if (data.type) filter.type = data.type;
    
    // Authorization: Admin/Staff/Teacher có thể xem tất cả, Student chỉ xem của mình
    if (data.currentUser.role === 'student') {
      filter.studentId = data.currentUser.id;
    }

    const pageNum = Math.max(1, parseInt(data.page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(data.limit, 10) || 200));
    const skip = (pageNum - 1) * limitNum;

    const [results, total] = await Promise.all([
      examResultRepository.findMany(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      examResultRepository.count(filter),
    ]);
    return { _status: 200, _body: ({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

  async post_root(data) {
  try {
    // Only Admin, Staff, or Teacher can create exam results
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền tạo kết quả thi' });
    }

    const result = examResultRepository.createInstance(data.body);
    await result.save();

    // Notify student when an exam result is created/recorded
    const io = data.app.get('io');
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
        payload: { examResultId: String(result._id), teacherId: String(result.teacherId), passed: Boolean(result.passed) },
        link: '/teacher/test',
      });
      io.emit('data:refresh', { type: 'examResult', id: result._id });
    }

    return { _status: 201, _body: ({ success: true, data: result });
  } catch (err) {
    return { _status: 400, _body: ({ success: false, message: err.message });
  }
}

  async put_id(data) {
  try {
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền cập nhật kết quả thi' });
    }

    const existing = await examResultRepository.findById(data.id);
    if (!existing) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy kết quả thi' });

    const resolveScore = (doc) => {
      if (typeof doc.essayScore === 'number' && !Number.isNaN(doc.essayScore)) return doc.essayScore;
      const total = Number(doc.multipleChoiceTotal) || 0;
      const correct = Number(doc.multipleChoiceCorrect) || 0;
      if (total > 0) return Math.round((correct / total) * 100);
      return null;
    };

    const oldScore = resolveScore(existing);
    const patch = { ...data.body };
    delete patch.scoreHistory;

    const result = await examResultRepository.updateById(
      data.id,
      patch,
      { returnDocument: 'after', runValidators: true },
    );

    const newScore = resolveScore(result);
    const scoreChanged = newScore != null && oldScore !== newScore;

    if (scoreChanged) {
      await examResultRepository.updateById(data.id, {
        $push: {
          scoreHistory: {
            at: new Date(),
            oldScore,
            newScore,
            actorUserId: String(data.currentUser?.id || ''),
            actorRole: String(data.currentUser?.role || ''),
            actorName: String(data.currentUser?.name || ''),
            note: String(data.essayNote || '').slice(0, 300),
          },
        },
      });
      try {
        const { writeAudit } = require('../../report/services/auditLogService');
        await writeAudit({
          action: 'exam.score_change',
          actorUserId: String(data.currentUser?.id || ''),
          actorRole: String(data.currentUser?.role || ''),
          entityType: 'examResult',
          entityId: String(result._id),
          studentId: result.studentId || null,
          oldValue: { oldScore },
          newValue: { newScore },
          ip: data.ip,
          userAgent: data.headers['user-agent'] || '',
        });
      } catch (auditErr) {
        logger.warn('[EXAM] score audit: %s', auditErr.message);
      }
    }

    const refreshed = await examResultRepository.findById(data.id);
    const notifyDoc = refreshed || result;

    // Notify student when result is graded/updated (pass/fail, score)
    const io = data.app.get('io');
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
        payload: { examResultId: String(notifyDoc._id), teacherId: String(notifyDoc.teacherId), passed: Boolean(notifyDoc.passed) },
        link: '/teacher/test',
      });
      io.emit('data:refresh', { type: 'examResult', id: notifyDoc._id });
    }

    return { _status: 200, _body: ({ success: true, data: refreshed || result });
  } catch (err) {
    return { _status: 400, _body: ({ success: false, message: err.message });
  }
}

  async delete_id(data) {
  try {
    if (!['admin', 'staff'].includes(data.currentUser.role)) {
      return { _status: 403, _body: ({ success: false, message: 'Không có quyền xóa kết quả thi' });
    }

    const result = await examResultRepository.deleteById(data.id);
    if (!result) return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy kết quả thi' });
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa kết quả thi' });
  } catch (err) {
    return { _status: 500, _body: ({ success: false, message: err.message });
  }
}

}

module.exports = new ExamResultApplicationService();
