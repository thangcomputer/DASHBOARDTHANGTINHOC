'use strict';
const { evaluationRepository } = require('./../repositories');
const Evaluation = require('./../models/Evaluation'); // Temp for new Evaluation
const Teacher = require('./../../teacher/models/Teacher');

// ─── ADMIN lấy danh sách phản hồi mật ──────────────────────────────────────

class EvaluationApplicationService {
  async get_admin(data) {
  try {
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff') {
      return { _status: 403, _body: { success: false, message: 'Không có quyền truy cập' } };
    }

    const evals = await evaluationRepository.findMany({ type: 'admin_feedback' }).sort({ updatedAt: -1, createdAt: -1 });
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
    return { _status: 200, _body: { success: true, data } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async get_teacher_teacherId(data) {
  try {
    const evals = await evaluationRepository.findMany({ type: 'teacher_rating', targetTeacherId: data.teacherId }).sort({ updatedAt: -1, createdAt: -1 });
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
    return { _status: 200, _body: { success: true, data } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_root(data) {
  try {
    const { studentId, targetTeacherId, courseId, type, criteria, content, studentName, teacherName, courseName, milestone, finalizeCourseEnd } = data.body;
    
    // Authorization: Học viên chỉ gửi đánh giá cho chính mình
    if (data.currentUser.role === 'student' && String(data.currentUser.id) !== String(studentId)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền gửi đánh giá thay người khác' } };
    }

    let evalDoc = null;
    let isUpdate = false;
    if (type === 'teacher_rating') {
      evalDoc = await evaluationRepository.findOne({ studentId, targetTeacherId, type: 'teacher_rating' });
      // Khóa sau lần gửi cuối khóa. Popup cuối khóa gửi finalizeCourseEnd = lần sửa cuối được phép.
      const allowFinalEdit = Boolean(finalizeCourseEnd);
      if (!allowFinalEdit) {
        const finalQ = {
          studentId,
          type: 'admin_feedback',
          milestone: 'course_end_teacher',
        };
        if (courseName) finalQ.courseName = courseName;
        const finalized = await evaluationRepository.findOne(finalQ);
        if (finalized) {
          return {
            _status: 409,
            _body: {
              success: false,
              code: 'TEACHER_RATING_LOCKED',
              message: 'Bạn đã hoàn tất đánh giá cuối khóa. Không thể sửa hoặc gửi lại đánh giá giảng viên.',
              data: evalDoc || null,
            },
          };
        }
      }
    } else if (type === 'admin_feedback') {
      evalDoc = await evaluationRepository.findOne({ studentId, courseName, milestone, type: 'admin_feedback' });
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
      evalDoc = evaluationRepository.createInstance({
        studentId, targetTeacherId, courseId, type, criteria, content, studentName, teacherName, courseName, milestone
      });
      await evalDoc.save();
    }

    // Tự động tính toán lại điểm averageRating của Teacher trong MongoDB
    if (type === 'teacher_rating' && targetTeacherId && targetTeacherId !== 'current') {
      try {
        const allTeacherRatings = await evaluationRepository.findMany({ targetTeacherId, type: 'teacher_rating' }).sort({ updatedAt: -1, createdAt: -1 });
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

    const io = data.app.get('io');
    const Student = require('../../student/models/Student');
    const studentInfo = await Student.findById(studentId);

    if (io) {
      if (type === 'admin_feedback') {
        io.to('admin_room').emit('evaluation:admin_feedback', evalDoc);
      } else {
        io.to(`teacher_${targetTeacherId}`).emit('evaluation:teacher_rating', evalDoc);
        
        // Notify Teacher
        if (targetTeacherId && targetTeacherId !== 'current') {
           const NotificationService = require('../../notification/services/NotificationService');
           const { maskStudentName } = require('../../../utils/maskName');
           const evalId = String(evalDoc._id || evalDoc.id);
           const stars = evalDoc?.criteria?.stars;
           const rawName = studentInfo?.name || 'Vô danh';
           const hvLabel = maskStudentName(rawName);
           const starsBit = stars != null ? ` ${stars}/5 sao` : '';
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
           
           io.emit('data:refresh', { type: 'evaluation', targetId: targetTeacherId });
        }
      }
    }
    return { _status: 200, _body: { success: true, data: evalDoc, meta: { isUpdate: !!isUpdate } } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_id_read(data) {
  try {
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff' && data.currentUser.role !== 'teacher') {
      return { _status: 403, _body: { success: false, message: 'Không có quyền' } };
    }

    const ev = await evaluationRepository.findById(data.id);
    if (!ev) return { _status: 404, _body: { success: false, message: 'Không tìm thấy đánh giá' } };
    
    // Authorization: GV chỉ được đánh dấu đã đọc đánh giá của mình
    if (data.currentUser.role === 'teacher' && String(ev.targetTeacherId) !== String(data.currentUser.id)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền' } };
    }

    ev.read = true;
    ev.isReadByAdmin = (data.currentUser.role === 'admin' || data.currentUser.role === 'staff');
    await ev.save();
    
    return { _status: 200, _body: { success: true, message: 'Đã đánh dấu đã xem' } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

}

module.exports = new EvaluationApplicationService();
