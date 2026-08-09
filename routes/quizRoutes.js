const express = require('express');
const router = express.Router();
const LessonQuiz = require('../models/LessonQuiz');
const Student = require('../models/Student');
const { authMiddleware, branchFilter } = require('../middleware/auth');
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const { policyShadowQuizAdminRead } = require('../middleware/policyShadowQuizAdminRead');
const { policyShadowQuiz } = require('../middleware/policyShadowQuiz');
const { quizzesCutoverGate } = require('../middleware/quizzesCutoverGate');

/** Phase 7.22: policyShadowQuiz → quizzesCutoverGate */
function quizzesGuard(action) {
  return [policyShadowQuiz(action), quizzesCutoverGate(action)];
}

/** Phase 7.22: admin/all uses quizAdminReadPolicy shadow */
function quizzesAdminGuard() {
  return [policyShadowQuizAdminRead(), quizzesCutoverGate('admin_read')];
}

// ── GET /api/quizzes/teacher: Lấy danh sách trắc nghiệm do giảng viên tạo ─────
router.get('/teacher', [authMiddleware, ...quizzesGuard('teacher_list')], async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const quizzes = await LessonQuiz.find({ teacherId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: quizzes });
  } catch (err) {
    logger.error('[QUIZ] Teacher fetch error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải danh sách trắc nghiệm' });
  }
});

// ── POST /api/quizzes/create: Giảng viên tạo bài trắc nghiệm mới ──────────────
router.post('/create', [authMiddleware, ...quizzesGuard('create')], async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const teacherName = req.user.name || 'Giảng viên';
    const { title, courseName, targetStudentIds, timeLimitMinutes, startTime, deadline, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên bài thi và ít nhất 1 câu hỏi' });
    }

    const quiz = await LessonQuiz.create({
      title,
      courseName: courseName || '',
      teacherId,
      teacherName,
      targetStudentIds: Array.isArray(targetStudentIds) ? targetStudentIds : [],
      timeLimitMinutes: Math.max(1, parseInt(timeLimitMinutes) || 15),
      startTime: startTime ? new Date(startTime) : new Date(),
      deadline: deadline ? new Date(deadline) : null,
      questions,
      status: 'active',
    });

    return res.json({ success: true, data: quiz, message: 'Tạo bài trắc nghiệm thành công' });
  } catch (err) {
    logger.error('[QUIZ] Create error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi tạo bài trắc nghiệm' });
  }
});

// ── DELETE /api/quizzes/:id: Giảng viên xóa bài trắc nghiệm ────────────────────
router.delete('/:id', [authMiddleware, ...quizzesGuard('delete')], async (req, res) => {
  try {
    const quizId = req.params.id;
    const teacherId = req.user.id || req.user._id;
    const quiz = await LessonQuiz.findOneAndDelete({ _id: quizId, teacherId });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài trắc nghiệm' });
    }
    return res.json({ success: true, message: 'Đã xóa bài trắc nghiệm' });
  } catch (err) {
    logger.error('[QUIZ] Delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa bài trắc nghiệm' });
  }
});

// ── GET /api/quizzes/student: Lấy danh sách trắc nghiệm được giao cho Học viên ─
router.get('/student', [authMiddleware, ...quizzesGuard('student_list')], async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const student = await Student.findById(studentId).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    const studentCourses = [student.course, ...(student.enrollments || []).map(e => e.courseName)].filter(Boolean);

    // Lọc quiz dành cho lớp của học viên HOẶC đích danh học viên
    const quizzes = await LessonQuiz.find({
      status: 'active',
      $or: [
        { targetStudentIds: studentId },
        { targetStudentIds: { $size: 0 }, courseName: { $in: studentCourses } },
        { targetStudentIds: { $exists: false } },
      ],
    }).sort({ createdAt: -1 }).lean();

    // Map thêm thông tin nộp bài của học viên này
    const result = quizzes.map(q => {
      const mySub = (q.submissions || []).find(s => String(s.studentId) === String(studentId));
      return {
        ...q,
        questionsCount: q.questions?.length || 0,
        mySubmission: mySub || null,
        // Giấu đáp án đúng khi gửi danh sách
        questions: undefined,
      };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[QUIZ] Student fetch error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải bài trắc nghiệm' });
  }
});

// ── GET /api/quizzes/:id: Học viên mở bài thi trắc nghiệm (Room Exam View) ────
router.get('/:id', [authMiddleware, ...quizzesGuard('get')], async (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = await LessonQuiz.findById(quizId).lean();
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài trắc nghiệm' });
    }

    // Không trả về đáp án đúng trước khi học viên nộp bài
    const safeQuestions = (quiz.questions || []).map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
    }));

    const studentId = req.user.id || req.user._id;
    const mySub = (quiz.submissions || []).find(s => String(s.studentId) === String(studentId));

    return res.json({
      success: true,
      data: {
        _id: quiz._id,
        title: quiz.title,
        courseName: quiz.courseName,
        teacherName: quiz.teacherName,
        timeLimitMinutes: quiz.timeLimitMinutes,
        questions: safeQuestions,
        mySubmission: mySub || null,
      },
    });
  } catch (err) {
    logger.error('[QUIZ] Detail fetch error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải đề thi trắc nghiệm' });
  }
});

// ── POST /api/quizzes/:id/submit: Nộp bài trắc nghiệm & Chấm điểm tự động ──────
router.post('/:id/submit', [authMiddleware, ...quizzesGuard('submit')], async (req, res) => {
  try {
    const quizId = req.params.id;
    const studentId = req.user.id || req.user._id;
    const { answers } = req.body; // Array of option indices e.g. [0, 2, 1, 3]

    const quiz = await LessonQuiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Bài trắc nghiệm không tồn tại' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    // Chấm điểm
    let correctCount = 0;
    const totalQuestions = quiz.questions.length;
    const userAnswers = Array.isArray(answers) ? answers : [];

    quiz.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        correctCount += 1;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const status = score >= 70 ? 'passed' : 'failed';

    const submissionData = {
      studentId: student._id,
      studentName: student.name,
      studentPhone: student.phone || student.zalo || '',
      answers: userAnswers,
      score,
      correctCount,
      totalQuestions,
      submittedAt: new Date(),
      status,
    };

    // Cập nhật hoặc lưu bài làm mới
    const existingIndex = quiz.submissions.findIndex(s => String(s.studentId) === String(studentId));
    if (existingIndex >= 0) {
      quiz.submissions[existingIndex] = submissionData;
    } else {
      quiz.submissions.push(submissionData);
    }

    await quiz.save();

    // Trả về kết quả kèm lời giải chi tiết
    const detailedReview = quiz.questions.map((q, idx) => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: userAnswers[idx] ?? null,
      isCorrect: userAnswers[idx] === q.correctAnswer,
      explanation: q.explanation || '',
    }));

    return res.json({
      success: true,
      message: 'Nộp bài thành công',
      data: {
        score,
        correctCount,
        totalQuestions,
        status,
        submittedAt: submissionData.submittedAt,
        detailedReview,
      },
    });
  } catch (err) {
    logger.error('[QUIZ] Submit error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi khi chấm điểm nộp bài' });
  }
});

// ── GET /api/quizzes/admin/all: Admin xem lịch sử trắc nghiệm (MANAGE_TRAINING)
// Flow: auth → branchFilter → policyShadowQuizAdminRead → quizzesCutoverGate → handler
// Legacy fallback: checkPermission(MANAGE_TRAINING); branch scope remains handler-owned.
router.get('/admin/all', [
  authMiddleware,
  branchFilter,
  ...quizzesAdminGuard(),
], async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    // Scope by teacher branch when staff is branch-bound (quiz has no branchId field)
    if (req.userBranchId) {
      const teacherIds = await Teacher.find({
        $or: [
          { branchId: req.userBranchId },
          { branchId: null },
        ],
      }).select('_id').lean();
      filter.teacherId = { $in: teacherIds.map((t) => t._id) };
    }

    const [quizzes, total] = await Promise.all([
      LessonQuiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LessonQuiz.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: quizzes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    logger.error('[QUIZ] Admin fetch all error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải lịch sử trắc nghiệm Admin' });
  }
});

module.exports = router;
