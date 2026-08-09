'use strict';
const { lessonQuizRepository } = require('./../repositories');
const LessonQuiz = require('./../models/LessonQuiz'); // Temp for new LessonQuiz
const Student = require('./../../student/models/Student');
const logger = require('./../../../config/logger');

// ── GET /api/quizzes/teacher: Lấy danh sách trắc nghiệm do giảng viên tạo ─────

class QuizApplicationService {
  async get_teacher(data) {
  try {
    const teacherId = data.currentUser.id || data.currentUser._id;
    const quizzes = await lessonQuizRepository.findMany({ teacherId })
      .sort({ createdAt: -1 })
      .lean();
    return { _status: 200, _body: ({ success: true, data: quizzes });
  } catch (err) {
    logger.error('[QUIZ] Teacher fetch error:', err.message);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi máy chủ khi tải danh sách trắc nghiệm' });
  }
}

  async post_create(data) {
  try {
    const teacherId = data.currentUser.id || data.currentUser._id;
    const teacherName = data.currentUser.name || 'Giảng viên';
    const { title, courseName, targetStudentIds, timeLimitMinutes, startTime, deadline, questions } = data.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return { _status: 400, _body: ({ success: false, message: 'Vui lòng nhập tên bài thi và ít nhất 1 câu hỏi' });
    }

    const quiz = await lessonQuizRepository.create({
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

    return { _status: 200, _body: ({ success: true, data: quiz, message: 'Tạo bài trắc nghiệm thành công' });
  } catch (err) {
    logger.error('[QUIZ] Create error:', err.message);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi tạo bài trắc nghiệm' });
  }
}

  async delete_id(data) {
  try {
    const quizId = data.id;
    const teacherId = data.currentUser.id || data.currentUser._id;
    const quiz = await lessonQuizRepository.deleteOne({ _id: quizId, teacherId });
    if (!quiz) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài trắc nghiệm' });
    }
    return { _status: 200, _body: ({ success: true, message: 'Đã xóa bài trắc nghiệm' });
  } catch (err) {
    logger.error('[QUIZ] Delete error:', err.message);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi xóa bài trắc nghiệm' });
  }
}

  async get_student(data) {
  try {
    const studentId = data.currentUser.id || data.currentUser._id;
    const student = await Student.findById(studentId).lean();
    if (!student) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
    }

    const studentCourses = [student.course, ...(student.enrollments || []).map(e => e.courseName)].filter(Boolean);

    // Lọc quiz dành cho lớp của học viên HOẶC đích danh học viên
    const quizzes = await lessonQuizRepository.findMany({
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

    return { _status: 200, _body: ({ success: true, data: result });
  } catch (err) {
    logger.error('[QUIZ] Student fetch error:', err.message);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi tải bài trắc nghiệm' });
  }
}

  async get_id(data) {
  try {
    const quizId = data.id;
    const quiz = await lessonQuizRepository.findById(quizId).lean();
    if (!quiz) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy bài trắc nghiệm' });
    }

    // Không trả về đáp án đúng trước khi học viên nộp bài
    const safeQuestions = (quiz.questions || []).map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
    }));

    const studentId = data.currentUser.id || data.currentUser._id;
    const mySub = (quiz.submissions || []).find(s => String(s.studentId) === String(studentId));

    return { _status: 200, _body: ({
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
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi tải đề thi trắc nghiệm' });
  }
}

  async post_id_submit(data) {
  try {
    const quizId = data.id;
    const studentId = data.currentUser.id || data.currentUser._id;
    const { answers } = data.body; // Array of option indices e.g. [0, 2, 1, 3]

    const quiz = await lessonQuizRepository.findById(quizId);
    if (!quiz) {
      return { _status: 404, _body: ({ success: false, message: 'Bài trắc nghiệm không tồn tại' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return { _status: 404, _body: ({ success: false, message: 'Không tìm thấy học viên' });
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

    return { _status: 200, _body: ({
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
    return { _status: 500, _body: ({ success: false, message: 'Lỗi khi chấm điểm nộp bài' });
  }
}

  async get_admin_all(data) {
  try {
    const quizzes = await lessonQuizRepository.findMany()
      .sort({ createdAt: -1 })
      .lean();

    return { _status: 200, _body: ({ success: true, data: quizzes });
  } catch (err) {
    logger.error('[QUIZ] Admin fetch all error:', err.message);
    return { _status: 500, _body: ({ success: false, message: 'Lỗi máy chủ khi tải lịch sử trắc nghiệm Admin' });
  }
}

}

module.exports = new QuizApplicationService();
