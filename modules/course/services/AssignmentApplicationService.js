'use strict';
const mongoose = require('mongoose');
const { assignmentRepository } = require('./../repositories');
const Assignment = require('./../models/Assignment'); // Temp for new Assignment
const { submissionRepository } = require('./../repositories');
const Submission = require('./../models/Submission'); // Temp for new Submission
const Student = require('./../../student/models/Student');
const Teacher = require('./../../teacher/models/Teacher');
const logger = require('./../../../config/logger');
const { normalizeMulterFile } = require('./../../../utils/escapeRegex');

async function assignmentHasGradedSubmission(assignmentId) {
  const n = await submissionRepository.count({ assignmentId, status: 'graded' });
  return n > 0;
}
function normCourseLabel(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
/** Lấy teacherId theo đúng khóa enrollment (fallback teacher root). */
function resolveTeacherIdsForStudentCourse(student, courseName) {
  const ids = [];
  const want = normCourseLabel(courseName);
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments : [];
  enrollments.forEach((e) => {
    if (want && normCourseLabel(e.courseName || e.course) !== want) return;
    const tid = e.teacherId?._id || e.teacherId;
    if (tid) ids.push(String(tid));
  });
  if (!ids.length && student?.teacherId) {
    ids.push(String(student.teacherId._id || student.teacherId));
  }
  return [...new Set(ids.filter(Boolean))];
}
// Tự động tạo thư mục uploads/assignments nếu chưa có
const uploadDir = path.join(__dirname, '..', 'uploads', 'assignments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Cấu hình Multer cho Bài tập (Giới hạn 3MB)
const ALLOWED_ASSIGNMENT_EXT = new Set([
  '.zip', '.rar', '.tar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png',
]);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = ALLOWED_ASSIGNMENT_EXT.has(rawExt) ? rawExt : '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeField = String(file.fieldname || 'file').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeField}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // Giới hạn 3MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_ASSIGNMENT_EXT.has(ext)) {
      return cb(new Error('Định dạng file không được phép. Chỉ hỗ trợ ZIP/RAR/PDF/DOC/XLS/PPT/JPG/PNG.'));
    }
    const mime = String(file.mimetype || '').toLowerCase();
    const okMime = /^(application\/(zip|x-(rar|7z)-compressed|x-tar|pdf|msword|vnd\.|octet-stream)|image\/(jpeg|png))/.test(mime);
    if (!okMime) {
      return cb(new Error('MIME type không khớp định dạng cho phép.'));
    }
    cb(null, true);
  }
});
// ─── Tải file đính kèm/nộp bài chung ─────────────────────────────────────────

class AssignmentApplicationService {
  async post_upload(data) {
  try {
    if (!data.file) {
      return { _status: 400, _body: { success: false, message: 'Chưa chọn file để tải lên' } };
    }
    normalizeMulterFile(data.file);
    const fileUrl = `/uploads/assignments/${data.file.filename}`;
    try {
      const fileService = require('../../file/services/fileService');
      await fileService.registerUploadedFile(data.file, {
        category: 'assignments',
        uploadedBy: String(data.currentUser?.id || ''),
        uploadedByRole: data.currentUser?.role || '',
        relatedType: 'assignment',
      });
    } catch (regErr) {
      logger.warn({ err: regErr.message }, '[ASSIGNMENTS] FileAsset register failed');
    }
    return { _status: 200, _body: { success: true, fileUrl, message: 'Tải file lên thành công!' } };
  } catch (error) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server khi tải file' } };
  }
}

  async get_course_courseId(data) {
  try {
    const assignments = await assignmentRepository.findMany({ courseId: data.courseId }).sort({ createdAt: -1 });
    
    // Dành cho giáo viên: kèm theo submissions của bài đó
    const data = await Promise.all(assignments.map(async (a) => {
      const subs = await submissionRepository.findMany({ assignmentId: a._id }).populate('studentId', 'name email avatar');
      return { ...a.toObject(), submissions: subs };
    }));
    return { _status: 200, _body: { success: true, data } };
  } catch (err) {
    logger.error("error GET /course/:courseId:", err);
    return { _status: 500, _body: { success: false, message: 'Lỗi server', err: err.message } };
  }
}

  async get_student_studentId_course_courseId(data) {
  try {
    // Authorization: Học viên chỉ xem bài của mình
    if (data.currentUser.role === 'student' && String(data.currentUser.id || data.currentUser._id) !== String(data.studentId)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền xem bài tập của học viên khác' } };
    }

    // Khớp đúng tên khóa (không phân biệt hoa thường / khoảng trắng thừa).
    // Không dùng token substring (vd. "TIN") — sẽ làm CB và NC trùng nhau.
    const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rawCourse = String(data.courseId || '');
    const normalizedCourse = rawCourse.trim().replace(/\s+/g, ' ');
    if (!normalizedCourse) {
      return { _status: 200, _body: { success: true, data: [] } };
    }
    const spaced = escapeRegex(normalizedCourse).replace(/\\ /g, '\\s+');
    const exactCourseRegex = new RegExp(`^${spaced}$`, 'i');

    // Chỉ bài giao đích danh cho học viên này (bài cũ không có studentId không còn hiển thị ở đây)
    const sid = String(data.studentId || '');
    const studentOnlyScope = {
      $or: [
        { studentId: sid },
        ...(mongoose.Types.ObjectId.isValid(sid)
          ? [{ studentId: new mongoose.Types.ObjectId(sid) }]
          : []),
      ],
    };

    const assignments = await assignmentRepository.findMany({
      $and: [
        {
          $or: [
            { courseId: normalizedCourse },
            { courseId: { $regex: exactCourseRegex } },
          ],
        },
        studentOnlyScope,
      ],
    })
      .sort({ createdAt: -1 })
      .limit(200);
    const data = await Promise.all(assignments.map(async (a) => {
      const sub = await submissionRepository.findOne({ assignmentId: a._id, studentId: data.studentId });
      return { ...a.toObject(), mySubmission: sub };
    }));
    return { _status: 200, _body: { success: true, data } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_root(data) {
  try {
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền tạo bài tập' } };
    }

    const role = String(data.currentUser.role || '').toLowerCase();
    const userId = String(data.currentUser.id || data.currentUser._id || '');
    const userName = String(data.currentUser.name || data.currentUser.fullName || data.currentUser.username || '').trim();

    const payload = { ...data.body };
    if (payload.studentId != null && String(payload.studentId).trim() !== '') {
      const rawSid = String(payload.studentId).trim();
      if (mongoose.Types.ObjectId.isValid(rawSid)) {
        payload.studentId = rawSid;
      } else {
        delete payload.studentId;
      }
    } else {
      payload.studentId = null;
    }
    // Teacher tạo bài → tự gán teacherId nếu thiếu
    if (role === 'teacher' && !payload.teacherId) payload.teacherId = userId;
    // Admin/Staff tạo bài → teacherId optional (null)
    if ((role === 'admin' || role === 'staff') && (payload.teacherId === 'admin' || payload.teacherId === '')) {
      payload.teacherId = null;
    }

    payload.assignedById = userId;
    payload.assignedByRole = role;
    payload.assignedByName = userName || (role === 'teacher' ? 'Giảng viên' : 'Admin');

    const newAssignment = assignmentRepository.createInstance(payload);
    await newAssignment.save();

    const io = data.app.get('io');
    if (io) {
      if (newAssignment.studentId) {
        io.to(`student_${String(newAssignment.studentId)}`).emit('assignment:new', newAssignment);
      } else {
        io.to(`course_${data.courseId}`).emit('assignment:new', newAssignment);
      }

      try {
        const NotificationService = require('../../notification/services/NotificationService');

        let studentDoc = null;
        let studentIds;
        if (newAssignment.studentId) {
          studentIds = [newAssignment.studentId.toString()];
          studentDoc = await Student.findById(newAssignment.studentId)
            .select('name teacherId enrollments course')
            .lean();
        } else {
          const students = await Student.find({ course: data.courseId }, '_id name teacherId enrollments').lean();
          studentIds = students.map((s) => s._id.toString());
          studentDoc = students[0] || null;
        }

        if (studentIds.length > 0) {
          await NotificationService.send(io, {
            type: 'COURSE',
            title: '📝 Bài tập mới',
            content: `${newAssignment.assignedByRole === 'teacher' ? 'Giảng viên' : 'Admin'} vừa giao bài tập mới: "${newAssignment.title}"`,
            receivers: studentIds,
            link: '/student#materials'
          });
        }

        // Admin/Staff giao bài → báo GV phụ trách khóa đó
        if (role === 'admin' || role === 'staff') {
          let teacherIds = [];
          if (newAssignment.teacherId) teacherIds.push(String(newAssignment.teacherId));
          if (studentDoc) {
            teacherIds.push(...resolveTeacherIdsForStudentCourse(studentDoc, newAssignment.courseId));
          }
          teacherIds = [...new Set(teacherIds.filter(Boolean))];

          // Gắn teacherId lên bài (để nộp bài báo đúng GV) nếu còn thiếu
          if (!newAssignment.teacherId && teacherIds[0] && mongoose.Types.ObjectId.isValid(teacherIds[0])) {
            newAssignment.teacherId = teacherIds[0];
            await newAssignment.save();
          }

          const studentName = studentDoc?.name || 'học viên';
          if (teacherIds.length > 0) {
            const teacherMsg =
              `Admin giao bài tập "${newAssignment.title}" cho học viên ${studentName}. Hãy chấm bài khi học viên nộp.`;
            await NotificationService.send(io, {
              type: 'COURSE',
              title: '📝 Admin giao bài tập',
              content: teacherMsg,
              receivers: teacherIds,
              payload: {
                assignmentId: String(newAssignment._id),
                studentId: newAssignment.studentId ? String(newAssignment.studentId) : '',
                type: 'assignment',
              },
              link: '/teacher#students',
            });
            teacherIds.forEach((tid) => {
              io.to(`teacher_${tid}`).emit('assignment:new', newAssignment);
            });
          }
        }

        io.emit('data:refresh', { type: 'assignment', action: 'create' });
      } catch (e) {
        logger.error('Error sending notif for new assignment:', e);
      }
    }
    return { _status: 200, _body: { success: true, data: newAssignment } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async put_id(data) {
  try {
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền chỉnh sửa bài tập' } };
    }

    if (await assignmentHasGradedSubmission(data.id)) {
      return { _status: 403, _body: {
        success: false,
        message: 'Bài tập đã được chấm điểm — không thể chỉnh sửa. Chỉ có thể sửa điểm.',
      } };
    }

    const updated = await assignmentRepository.updateById(data.id, data.body, { returnDocument: 'after' });
    if (!updated) return { _status: 404, _body: { success: false, message: 'Không tìm thấy bài tập' } };
    
    const io = data.app.get('io');
    if (io) io.to(`course_${updated.courseId}`).emit('assignment:updated', updated);
    
    return { _status: 200, _body: { success: true, data: updated } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async delete_id(data) {
  try {
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền xóa bài tập' } };
    }

    if (await assignmentHasGradedSubmission(data.id)) {
      return { _status: 403, _body: {
        success: false,
        message: 'Bài tập đã được chấm điểm — không thể xóa.',
      } };
    }

    const deleted = await assignmentRepository.deleteById(data.id);
    if (!deleted) return { _status: 404, _body: { success: false, message: 'Không tìm thấy bài tập' } };
    
    await Submission.deleteMany({ assignmentId: data.id });
    
    const io = data.app.get('io');
    if (io) io.to(`course_${deleted.courseId}`).emit('assignment:deleted', deleted._id);
    
    return { _status: 200, _body: { success: true } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async post_id_submit(data) {
  try {
    const { studentId, teacherId, submittedFileUrl } = data.body;

    const assignmentForSubmit = await assignmentRepository.findById(data.id);
    if (!assignmentForSubmit) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy bài tập' } };
    }
    if (assignmentForSubmit.studentId && String(assignmentForSubmit.studentId) !== String(studentId)) {
      return { _status: 403, _body: { success: false, message: 'Bài tập này không được giao cho bạn' } };
    }

    if (data.currentUser.role === 'student' && !assignmentForSubmit.studentId) {
      return { _status: 403, _body: {
        success: false,
        message: 'Bài tập không gắn học viên. Vui lòng nhờ giảng viên giao lại bài.',
      } };
    }

    // Authorization: Học viên chỉ được nộp bài cho chính mình
    if (data.currentUser.role === 'student' && String(data.currentUser.id || data.currentUser._id) !== String(studentId)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền nộp bài cho học viên khác' } };
    }

    let submission = await submissionRepository.updateOne(
      { assignmentId: data.id, studentId },
      { submittedFileUrl, status: 'submitted', teacherId, submittedAt: new Date() },
      { returnDocument: 'after', upsert: true }
    );

    const io = data.app.get('io');
    const Notification = require('../../notification/models/Notification');
    const student = await Student.findById(studentId);

    let resolvedTeacherId = teacherId;
    if (!resolvedTeacherId || resolvedTeacherId === 'current') {
      const fromEnrollment = resolveTeacherIdsForStudentCourse(student, assignmentForSubmit.courseId)[0];
      resolvedTeacherId =
        assignmentForSubmit.teacherId ||
        fromEnrollment ||
        student?.teacherId ||
        null;
    }
    if (resolvedTeacherId) resolvedTeacherId = String(resolvedTeacherId);

    if (resolvedTeacherId && String(submission.teacherId || '') !== resolvedTeacherId) {
      submission = await submissionRepository.updateById(
        submission._id,
        { teacherId: resolvedTeacherId },
        { returnDocument: 'after' },
      );
    }

    if (resolvedTeacherId) {
      const assignment = assignmentForSubmit;
      const isAdminAssign = ['admin', 'staff'].includes(String(assignment?.assignedByRole || '').toLowerCase());
      const submitTitle = '📋 Bài tập mới được nộp';
      const submitContent = isAdminAssign
        ? `Học viên ${student?.name || 'Vô danh'} vừa nộp bài "${assignment?.title || ''}" (Admin giao). Hãy chấm bài.`
        : `Học viên ${student?.name || 'Vô danh'} vừa nộp bài tập "${assignment?.title || ''}".`;

      await Notification.create({
        type: 'COURSE',
        title: submitTitle,
        content: submitContent,
        receivers: [resolvedTeacherId],
        payload: { studentId, assignmentId: data.id, type: 'assignment' },
        path: `/teacher#assignments?courseId=${assignment?.courseId || ''}&assignmentId=${data.id}&studentId=${studentId}`
      });

      if (io) {
        const NotificationService = require('../../notification/services/NotificationService');
        io.to(`teacher_${resolvedTeacherId}`).emit('submission:new', submission);

        await NotificationService.send(io, {
          type: 'COURSE',
          title: submitTitle,
          content: submitContent,
          receivers: resolvedTeacherId,
          payload: { studentId, assignmentId: data.id },
          link: `/teacher#assignments?courseId=${assignment?.courseId || ''}&assignmentId=${data.id}&studentId=${studentId}`
        });

        io.emit('data:refresh', { type: 'submission', action: 'create' });
      }
    }
    return { _status: 200, _body: { success: true, data: submission } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

  async put_submissions_submissionId_grade(data) {
  try {
    if (!['admin', 'staff', 'teacher'].includes(data.currentUser.role)) {
      return { _status: 403, _body: { success: false, message: 'Không có quyền chấm điểm' } };
    }

    const { grade, teacherFeedback } = data.body;
    const existingSubmission = await submissionRepository.findById(data.submissionId);
    if (!existingSubmission) {
      return { _status: 404, _body: { success: false, message: 'Không tìm thấy bài nộp' } };
    }

    const newGrade = Number(grade);
    if (!Number.isFinite(newGrade) || newGrade < 0 || newGrade > 10) {
      return { _status: 400, _body: { success: false, message: 'Điểm không hợp lệ (0-10)' } };
    }

    const isRegrade = existingSubmission.status === 'graded'
      || (existingSubmission.grade != null && Number(existingSubmission.grade) !== newGrade);
    const prevGrade = existingSubmission.grade != null ? Number(existingSubmission.grade) : null;
    const auditAction = isRegrade ? 'assignment.regrade' : 'assignment.grade';

    const historyEntry = {
      at: new Date(),
      oldGrade: isRegrade ? prevGrade : null,
      newGrade,
      actorUserId: String(data.currentUser?.id || ''),
      actorRole: String(data.currentUser?.role || ''),
      actorName: String(data.currentUser?.name || ''),
      note: String(teacherFeedback || '').slice(0, 300),
    };

    const submission = await submissionRepository.updateById(
      data.submissionId,
      {
        $set: { grade: newGrade, teacherFeedback, status: 'graded' },
        $push: { gradeHistory: historyEntry },
      },
      { returnDocument: 'after' },
    );

    try {
      const { writeAudit } = require('../../report/services/auditLogService');
      await writeAudit({
        action: auditAction,
        actorUserId: String(data.currentUser?.id || ''),
        actorRole: String(data.currentUser?.role || ''),
        studentId: submission.studentId,
        entityType: 'submission',
        entityId: String(submission._id),
        oldValue: { grade: prevGrade },
        newValue: { grade: newGrade },
        ip: data.ip,
        userAgent: data.headers['user-agent'] || '',
      });
    } catch (auditErr) {
      logger.warn('[ASSIGNMENTS] grade audit: %s', auditErr.message);
    }

    // Lấy thông tin Assignment để làm "note" (VD: Chấm bài: Thực hành Excel Buổi 3)
    const assignment = await assignmentRepository.findById(submission.assignmentId);
    if (assignment) {
      const student = await Student.findById(submission.studentId);
      const grades = [...(student?.grades || [])];
      const assignmentIdStr = String(assignment._id);
      const titleLower = assignment.title.toLowerCase();

      const matchesAssignment = (g) => {
        if (g.assignmentId && String(g.assignmentId) === assignmentIdStr) return true;
        const note = (g.note || '').toLowerCase();
        if (!note.includes(titleLower)) return false;
        return note.startsWith('bài nộp:') || note.startsWith('cập nhật điểm:') || note.startsWith('sửa điểm:');
      };

      const feedback = teacherFeedback
        || (isRegrade ? 'Giảng viên đã sửa điểm' : 'Đã chấm điểm trực tiếp');

      const newEntry = {
        date: new Date().toISOString(),
        note: isRegrade
          ? `Cập nhật điểm: ${assignment.title} (${prevGrade} → ${grade}) - ${feedback}`
          : `Bài nộp: ${assignment.title} - ${feedback}`,
        grade: Number(grade),
        assignmentId: assignment._id,
      };

      if (isRegrade || grades.some(matchesAssignment)) {
        const filtered = grades.filter((g) => !matchesAssignment(g));
        filtered.push(newEntry);
        await Student.findByIdAndUpdate(submission.studentId, { $set: { grades: filtered } });
      } else {
        await Student.findByIdAndUpdate(submission.studentId, { $push: { grades: newEntry } });
      }
    }

    const io = data.app.get('io');
    if (io) {
      // Emit to student
      io.to(`student_${submission.studentId}`).emit('submission:graded', submission);
      
      try {
        const NotificationService = require('../../notification/services/NotificationService');
        await NotificationService.send(io, {
          type: 'EVALUATION',
          title: isRegrade ? '📝 Điểm bài tập đã được cập nhật' : '✅ Bài tập đã được chấm',
          content: isRegrade
            ? `Giảng viên đã sửa điểm bài tập "${assignment?.title || 'không tên'}". Điểm mới: ${grade}/10.`
            : `Giảng viên đã chấm điểm bài tập "${assignment?.title || 'không tên'}". Điểm: ${grade}/10.`,
          receivers: submission.studentId.toString(),
          link: '/student#materials'
        });
        
        io.emit('data:refresh', { type: 'submission', id: submission._id });
      } catch (e) {
        logger.error('Error sending notif for grading:', e);
      }
    }
    return { _status: 200, _body: { success: true, data: submission } };
  } catch (err) {
    return { _status: 500, _body: { success: false, message: 'Lỗi server' } };
  }
}

}

module.exports = new AssignmentApplicationService();
