/**
 * Điều kiện vào / nộp trắc nghiệm GV giao. Không đụng chấm điểm hay thông báo.
 */

function studentCourseNames(student) {
  const names = [
    student?.course,
    ...(student?.enrollments || []).map((e) => e.courseName || e.name),
  ];
  return [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))];
}

function studentAssignedToQuiz(quiz, student) {
  if (!quiz || !student) return false;
  const studentId = String(student._id || student.id || '');
  const targets = Array.isArray(quiz.targetStudentIds) ? quiz.targetStudentIds : [];
  if (targets.length) return targets.some((id) => String(id) === studentId);
  const course = String(quiz.courseName || '').trim();
  if (!course) return false;
  return studentCourseNames(student).includes(course);
}

function quizWindow(quiz, now = Date.now()) {
  const start = quiz?.startTime ? new Date(quiz.startTime).getTime() : 0;
  const deadline = quiz?.deadline ? new Date(quiz.deadline).getTime() : 0;
  return {
    notYetOpen: Boolean(start && Number.isFinite(start) && now < start),
    expired: Boolean(deadline && Number.isFinite(deadline) && now > deadline),
  };
}

function existingSubmissionPayload(existing) {
  if (!existing) return null;
  return {
    score: existing.score,
    correctCount: existing.correctCount,
    totalQuestions: existing.totalQuestions,
    status: existing.status,
    forfeit: !!existing.forfeit,
    exitReason: existing.exitReason || '',
    submittedAt: existing.submittedAt,
    detailedReview: [],
  };
}

async function claimQuizSubmission(QuizModel, quizId, studentId, submissionData) {
  const claimed = await QuizModel.findOneAndUpdate(
    {
      _id: quizId,
      submissions: {
        $not: {
          $elemMatch: { studentId },
        },
      },
    },
    { $push: { submissions: submissionData } },
    { returnDocument: 'after', runValidators: true },
  );
  if (claimed) return { created: true, quiz: claimed, existing: null };

  const current = await QuizModel.findById(quizId).select('submissions').lean();
  const existing = (current?.submissions || []).find(
    (submission) => String(submission.studentId) === String(studentId),
  ) || null;
  return { created: false, quiz: current, existing };
}

module.exports = {
  studentCourseNames,
  studentAssignedToQuiz,
  quizWindow,
  existingSubmissionPayload,
  claimQuizSubmission,
};
