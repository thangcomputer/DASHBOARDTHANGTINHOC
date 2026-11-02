import type { DemoQuiz, DemoUser } from '../types';
import { mobileApiRequest } from './apiClient';

type Raw = Record<string, unknown>;

export type TeacherQuizQuestionInput = {
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

function record(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function idOf(value: unknown) {
  if (typeof value === 'string') return value;
  const raw = record(value);
  return text(raw._id || raw.id);
}

function requireTeacher(user: DemoUser) {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Tài khoản giảng viên không hợp lệ.');
  }
}

function mapTeacherQuiz(value: unknown, index: number): DemoQuiz {
  const raw = record(value);
  const id = idOf(raw._id || raw.id);
  if (!id) throw new Error(`Bài trắc nghiệm thứ ${index + 1} thiếu mã định danh.`);
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  const targetStudentIds = Array.isArray(raw.targetStudentIds)
    ? raw.targetStudentIds.map(idOf).filter(Boolean)
    : [];
  const submissions = Array.isArray(raw.submissions) ? raw.submissions.map((entry, submissionIndex) => {
    const submission = record(entry);
    const score = Number(submission.score);
    if (!Number.isFinite(score)) {
      throw new Error(`Bài nộp thứ ${submissionIndex + 1} của "${text(raw.title) || 'bài trắc nghiệm'}" thiếu điểm hợp lệ.`);
    }
    return {
      studentName: text(submission.studentName) || 'Học viên',
      studentPhone: text(submission.studentPhone),
      submittedAt: text(submission.submittedAt),
      score,
      correctCount: Number.isFinite(Number(submission.correctCount)) ? Number(submission.correctCount) : undefined,
      totalQuestions: Number.isFinite(Number(submission.totalQuestions)) ? Number(submission.totalQuestions) : undefined,
      status: submission.status === 'passed' ? 'passed' as const : 'failed' as const,
      forfeit: submission.forfeit === true,
      exitReason: text(submission.exitReason),
    };
  }) : [];

  return {
    id,
    title: text(raw.title) || `Bài trắc nghiệm ${index + 1}`,
    courseName: text(raw.courseName) || 'Chưa chọn khóa học',
    timeLimitMinutes: Math.max(1, Number(raw.timeLimitMinutes) || 15),
    startTime: text(raw.startTime) || undefined,
    deadline: text(raw.deadline) || 'Không giới hạn',
    questions: questions.length,
    targetStudentIds,
    studentCount: targetStudentIds.length || undefined,
    submissions,
    sampleQuestions: questions.map((entry, questionIndex) => {
      const question = record(entry);
      return {
        text: text(question.questionText) || `Câu ${questionIndex + 1}`,
        options: Array.isArray(question.options) ? question.options.map((option) => String(option)) : [],
        correctOption: Number(question.correctAnswer) || 0,
      };
    }),
  };
}

export async function getTeacherQuizzes(user: DemoUser): Promise<DemoQuiz[]> {
  requireTeacher(user);
  const response = await mobileApiRequest<{ data?: unknown }>('/quizzes/teacher');
  if (!Array.isArray(response.data)) {
    throw new Error('Máy chủ trả về danh sách trắc nghiệm giảng viên không hợp lệ.');
  }
  return response.data.map(mapTeacherQuiz);
}

export async function createTeacherQuiz(
  user: DemoUser,
  input: {
    title: string;
    courseName: string;
    targetStudentIds: string[];
    timeLimitMinutes: number;
    startTime: string | null;
    deadline: string | null;
    questions: TeacherQuizQuestionInput[];
  },
) {
  requireTeacher(user);
  const response = await mobileApiRequest<{ data?: Raw }>('/quizzes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.data || !idOf(response.data._id || response.data.id)) {
    throw new Error('Máy chủ chưa xác nhận bài trắc nghiệm đã được tạo.');
  }
}

export async function deleteTeacherQuiz(user: DemoUser, quizId: string) {
  requireTeacher(user);
  if (!quizId.trim()) throw new Error('Không thể xóa bài trắc nghiệm: thiếu mã định danh.');
  await mobileApiRequest(`/quizzes/${encodeURIComponent(quizId)}`, { method: 'DELETE' });
}

export async function generateTeacherQuizQuestions(
  user: DemoUser,
  input: { topic: string; courseName: string; count: number; difficulty: string },
) {
  requireTeacher(user);
  const response = await mobileApiRequest<{
    data?: { source?: string; questions?: unknown[] };
    message?: string;
  }>('/quizzes/generate-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const questions = response.data?.questions;
  if (!Array.isArray(questions) || !questions.length) {
    throw new Error(response.message || 'Máy chủ không tạo được câu hỏi trắc nghiệm.');
  }
  return {
    source: text(response.data?.source),
    message: text(response.message),
    questions: questions.map((entry, index) => {
      const question = record(entry);
      const options = Array.isArray(question.options)
        ? question.options.map((option) => String(option))
        : [];
      const correctAnswer = Number(question.correctAnswer);
      if (!text(question.questionText) || options.length < 4 || options.some((option) => !option.trim())
        || !Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
        throw new Error(`Câu hỏi AI thứ ${index + 1} có dữ liệu không hợp lệ.`);
      }
      return {
        questionText: text(question.questionText),
        options: options.slice(0, 4),
        correctAnswer,
        explanation: text(question.explanation),
      };
    }),
  };
}
