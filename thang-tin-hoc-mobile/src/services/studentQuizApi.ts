import { mobileApiRequest } from './apiClient';
import type { DemoUser } from '../types';

type Raw = Record<string, unknown>;

export type StudentQuiz = {
  id: string;
  title: string;
  courseName: string;
  teacherName: string;
  timeLimitMinutes: number;
  startTime: string;
  deadline: string;
  questionsCount: number;
  targetStudentIds: string[];
  mySubmission: {
    submittedAt: string;
    score: number | null;
    correctCount: number | null;
    totalQuestions: number | null;
    passed: boolean;
    forfeit: boolean;
    status: string;
  } | null;
};

export type StudentQuizQuestion = {
  id: string;
  questionText: string;
  options: string[];
};

export type StudentQuizReview = {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  userAnswer: number | null;
  isCorrect: boolean;
  explanation: string;
};

export type StudentQuizResult = {
  score: number;
  correctCount: number;
  totalQuestions: number;
  status: string;
  forfeit: boolean;
  exitReason: string;
  submittedAt: string;
  detailedReview: StudentQuizReview[];
};

export type StudentQuizDetail = {
  id: string;
  title: string;
  courseName: string;
  teacherName: string;
  timeLimitMinutes: number;
  questions: StudentQuizQuestion[];
  mySubmission: StudentQuizResult | null;
  detailedReview: StudentQuizReview[];
};

export type StudentEvaluationActivity = {
  id: string;
  type: string;
  courseName: string;
  content: string;
  createdAt: string;
  criteria: Raw;
  milestone: string;
  updatedAt: string;
};

function record(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return value == null || value === '' || !Number.isFinite(parsed) ? null : parsed;
}

function isFreePortalWithoutRealCourse(user?: DemoUser | null): boolean {
  if (!user || user.role !== 'student') return false;
  const hasRealEnrollment = Array.isArray(user.enrollments) && user.enrollments.some((enrollment) => {
    const label = String(enrollment?.courseName || '').trim().toLocaleLowerCase('vi');
    return Boolean(label) && label !== 'tài khoản miễn phí' && enrollment.status === 'Đang học';
  });
  if (hasRealEnrollment) return false;
  return user.freePortal === true || String(user.course || '').trim().toLocaleLowerCase('vi') === 'tài khoản miễn phí';
}

export async function getStudentQuizzes(user: DemoUser): Promise<StudentQuiz[]> {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải bài trắc nghiệm: tài khoản học viên không hợp lệ.');
  }
  if (user.previewMode) return [];
  if (isFreePortalWithoutRealCourse(user) && user.freeUnlocked !== true) return [];

  let response: { data?: Raw[] };
  try {
    response = await mobileApiRequest<{ data?: Raw[] }>('/quizzes/student');
  } catch (err) {
    if ((err as { status?: number })?.status === 403) return [];
    throw err;
  }
  if (!Array.isArray(response.data)) {
    throw new Error('Phản hồi danh sách bài trắc nghiệm không hợp lệ.');
  }
  return response.data.map((raw, index) => {
    const submission = raw.mySubmission ? record(raw.mySubmission) : null;
    const score = numberOrNull(submission?.score);
    const id = text(raw._id || raw.id);
    if (!id) throw new Error(`Bài trắc nghiệm thứ ${index + 1} thiếu mã định danh.`);
    return {
      id,
      title: text(raw.title) || 'Bài trắc nghiệm',
      courseName: text(raw.courseName || raw.course),
      teacherName: text(raw.teacherName) || 'Giảng viên',
      timeLimitMinutes: Math.max(1, numberOrNull(raw.timeLimitMinutes) ?? 15),
      startTime: text(raw.startTime),
      deadline: text(raw.deadline),
      questionsCount: Math.max(0, numberOrNull(raw.questionsCount) ?? 0),
      targetStudentIds: Array.isArray(raw.targetStudentIds)
        ? raw.targetStudentIds.map((target) => {
          const targetRecord = record(target);
          return text(targetRecord._id || targetRecord.id || target);
        }).filter(Boolean)
        : [],
      mySubmission: submission ? {
        submittedAt: text(submission.submittedAt || submission.createdAt || submission.updatedAt),
        score,
        correctCount: numberOrNull(submission.correctCount),
        totalQuestions: numberOrNull(submission.totalQuestions),
        passed: submission.status === 'passed' || (score != null && score >= 70),
        forfeit: submission.forfeit === true,
        status: text(submission.status),
      } : null,
    };
  });
}

function mapQuizReview(value: unknown, index: number): StudentQuizReview {
  const raw = record(value);
  const correctAnswer = numberOrNull(raw.correctAnswer);
  const userAnswer = numberOrNull(raw.userAnswer);
  if (correctAnswer == null) throw new Error(`Đáp án đúng của câu ${index + 1} không hợp lệ.`);
  return {
    id: text(raw._id || raw.id) || `question-${index + 1}`,
    questionText: text(raw.questionText),
    options: Array.isArray(raw.options) ? raw.options.map(text) : [],
    correctAnswer,
    userAnswer,
    isCorrect: raw.isCorrect === true,
    explanation: text(raw.explanation),
  };
}

function mapQuizResult(value: unknown): StudentQuizResult {
  const raw = record(value);
  const detailedReview = Array.isArray(raw.detailedReview)
    ? raw.detailedReview.map(mapQuizReview)
    : [];
  return {
    score: numberOrNull(raw.score) ?? 0,
    correctCount: numberOrNull(raw.correctCount) ?? 0,
    totalQuestions: numberOrNull(raw.totalQuestions) ?? 0,
    status: text(raw.status),
    forfeit: raw.forfeit === true,
    exitReason: text(raw.exitReason),
    submittedAt: text(raw.submittedAt),
    detailedReview,
  };
}

export async function getStudentQuizForExam(user: DemoUser, quizId: string): Promise<StudentQuizDetail> {
  if (user.role !== 'student' || !user.id || !quizId.trim()) {
    throw new Error('Không thể mở bài trắc nghiệm: thông tin học viên hoặc bài thi không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: Raw }>(`/quizzes/${encodeURIComponent(quizId)}`);
  const raw = record(response.data);
  if (!raw._id && !raw.id) throw new Error('Máy chủ không trả về thông tin bài trắc nghiệm.');
  if (!Array.isArray(raw.questions)) throw new Error('Danh sách câu hỏi từ máy chủ không hợp lệ.');
  const submission = raw.mySubmission ? mapQuizResult(raw.mySubmission) : null;
  const detailReview = Array.isArray(raw.detailedReview)
    ? raw.detailedReview.map(mapQuizReview)
    : submission?.detailedReview || [];
  return {
    id: text(raw._id || raw.id),
    title: text(raw.title) || 'Bài trắc nghiệm',
    courseName: text(raw.courseName),
    teacherName: text(raw.teacherName) || 'Giảng viên',
    timeLimitMinutes: Math.max(1, numberOrNull(raw.timeLimitMinutes) ?? 15),
    questions: raw.questions.map((question, index) => {
      const item = record(question);
      const id = text(item._id || item.id) || `question-${index + 1}`;
      if (!Array.isArray(item.options) || !item.options.length) {
        throw new Error(`Câu hỏi ${index + 1} chưa có phương án trả lời hợp lệ.`);
      }
      return {
        id,
        questionText: text(item.questionText),
        options: item.options.map(text),
      };
    }),
    mySubmission: submission,
    detailedReview: detailReview,
  };
}

export async function submitStudentQuiz(
  user: DemoUser,
  quizId: string,
  answers: Array<number | null>,
  options: { forfeit?: boolean; exitReason?: string } = {},
): Promise<StudentQuizResult> {
  if (user.role !== 'student' || !user.id || !quizId.trim()) {
    throw new Error('Không thể nộp bài trắc nghiệm: thông tin học viên hoặc bài thi không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: Raw }>(
    `/quizzes/${encodeURIComponent(quizId)}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        forfeit: options.forfeit === true,
        exitReason: options.exitReason || '',
      }),
    },
  );
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Máy chủ chưa xác nhận kết quả bài trắc nghiệm.');
  }
  return mapQuizResult(response.data);
}

export async function getStudentEvaluationActivity(user: DemoUser): Promise<StudentEvaluationActivity[]> {
  if (user.role !== 'student' || !user.id) {
    throw new Error('Không thể tải nhật ký đánh giá: tài khoản học viên không hợp lệ.');
  }
  if (user.previewMode) return [];

  const student = await mobileApiRequest<{ data?: { student?: Raw } }>(
    `/students/${encodeURIComponent(user.id)}/full-detail`,
  );
  const rawStudent = record(student.data?.student);
  const enrollments = Array.isArray(rawStudent.enrollments) ? rawStudent.enrollments.map(record) : [];
  const hasRealCourse = enrollments.some((enrollment) => {
    const status = text(enrollment.status || 'active').toLowerCase();
    if (['cancelled', 'refunded', 'pending_payment', 'completed', 'hoàn thành', 'hoan thanh'].includes(status)) return false;
    const label = text(enrollment.courseName).toLowerCase();
    return Boolean(label) && label !== 'tài khoản miễn phí';
  });
  if (rawStudent.freePortal === true && !hasRealCourse) return [];
  const teacherIds = [...new Set(enrollments.map((enrollment) => {
    const teacher = record(enrollment.teacherId);
    return text(teacher._id || teacher.id || enrollment.teacherId);
  }).filter(Boolean))];
  const [privateResponse, teacherResponses] = await Promise.all([
    mobileApiRequest<{ data?: Raw[] }>('/evaluations/mine').catch(() => ({ data: [] })),
    Promise.all(teacherIds.map((teacherId) => mobileApiRequest<{ data?: Raw[] }>(
      `/evaluations/teacher/${encodeURIComponent(teacherId)}`,
    ).catch(() => ({ data: [] })))),
  ]);
  if (!Array.isArray(privateResponse.data) || teacherResponses.some((response) => !Array.isArray(response.data))) {
    throw new Error('Phản hồi nhật ký đánh giá không hợp lệ.');
  }

  const ratings = teacherResponses.flatMap((response) => response.data || [])
    .filter((rating) => {
      const studentId = record(rating.studentId);
      return text(studentId._id || studentId.id || rating.studentId) === user.id;
    });
  const seen = new Set<string>();
  return [...(privateResponse.data || []), ...ratings]
    .filter((evaluation) => {
      const id = text(evaluation._id || evaluation.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((evaluation) => ({
      id: text(evaluation._id || evaluation.id),
      type: text(evaluation.type),
      courseName: text(evaluation.courseName),
      content: text(evaluation.content || evaluation.comment),
      createdAt: text(evaluation.createdAt || evaluation.updatedAt),
      criteria: record(evaluation.criteria),
      milestone: text(evaluation.milestone),
      updatedAt: text(evaluation.updatedAt),
    }));
}
