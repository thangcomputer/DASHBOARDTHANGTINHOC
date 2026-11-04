/**
 * certPrepApi.ts
 * Mobile CertPrep API — tương đương certPrepApi.js của web app.
 * Ôn thi MOS/IC3: catalog, levels, tests, sessions.
 */
import { mobileApiRequest } from './apiClient';

export type CertPrepCourse = {
  id: string;
  name: string;
  description?: string;
  expiresAt?: string;
  levels: CertPrepLevel[];
};

export type CertPrepLevel = {
  id: string;
  title: string;
  subtitle?: string;
  courseId: string;
  courseName?: string;
};

export type CertPrepTest = {
  id: string;
  title: string;
  questionCount: number;
  timeLimitMinutes?: number;
  attempts?: number;
  lastScore?: number;
  lastSessionId?: string;
  status?: 'not_started' | 'in_progress' | 'completed';
};

type ApiEnvelope<T> = { data: T };

async function requestData<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await mobileApiRequest<ApiEnvelope<T>>(path, init);
  if (!response || !('data' in response)) {
    throw new Error('Dữ liệu ôn thi từ máy chủ không hợp lệ.');
  }
  return response.data;
}

function normalizeQuestion(question: Record<string, unknown>): CertPrepQuestion {
  const options = Array.isArray(question.options) ? question.options : [];
  return {
    ...question,
    id: String(question.id || question._id || ''),
    type: question.type as CertPrepQuestion['type'],
    text: String(question.questionText || question.text || ''),
    options: options.map((option) => (
      typeof option === 'string'
        ? option
        : String((option as Record<string, unknown>)?.text || '')
    )),
  };
}

function normalizeSession(session: Record<string, unknown>): CertPrepSession {
  const answers = Array.isArray(session.answers) ? session.answers : [];
  const questions = Array.isArray(session.questions) ? session.questions : [];
  return {
    ...session,
    id: String(session.id || session._id || ''),
    answers: Object.fromEntries(answers.map((answer) => {
      const row = answer as Record<string, unknown>;
      return [String(row.questionId || row.id || ''), row.value];
    })),
    questions: questions.map((question) => normalizeQuestion(question as Record<string, unknown>)),
    remainingSeconds: Number(session.remainingSeconds) || 0,
  } as CertPrepSession;
}

export type CertPrepQuestion = {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false_grid' | 'matching';
  text?: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer?: number;
  correctIndices?: number[];
  statements?: { text: string; correct?: boolean }[];
  matchingPairs?: { left: string; right: string }[];
};

export type CertPrepSession = {
  id: string;
  _id?: string;
  status: 'in_progress' | 'submitted' | 'abandoned';
  configSnapshot?: { levelId?: string; testId?: string };
  timeLimitSeconds?: number;
  startedAt?: string;
  remainingSeconds?: number;
  answers?: Record<string, unknown>;
  questions?: CertPrepQuestion[];
  feedbackMode?: 'immediate' | 'end';
};

export type CertPrepAttempt = {
  sessionId: string;
  attempt: number;
  score: number;
  passed: boolean;
  submittedAt?: string;
  durationSeconds: number;
};

export type CertPrepResult = {
  sessionId: string;
  testId?: string;
  score: number;
  total: number;
  correctCount: number;
  passed?: boolean;
  timeTaken?: number;
  submittedAt?: string;
};

const certPrepApi = {
  /** Lấy danh sách khóa ôn thi học viên có quyền truy cập */
  async getCatalog(): Promise<CertPrepCourse[]> {
    return requestData<CertPrepCourse[]>('/cert-prep/my-catalog', { method: 'GET' });
  },

  /** Lấy danh sách đề thi của 1 level */
  async getLevelTests(levelId: string): Promise<{
    level: CertPrepLevel;
    course: { id: string; name: string };
    expiresAt?: string;
    tests: CertPrepTest[];
  }> {
    const response = await requestData<{
      level: CertPrepLevel;
      course: { id: string; name: string };
      expiresAt?: string;
      tests: Array<Record<string, unknown>>;
    }>(`/cert-prep/levels/${encodeURIComponent(levelId)}/tests`, { method: 'GET' });
    return {
      ...response,
      tests: response.tests.map((test) => {
        const activeSessionId = String(test.activeSessionId || '');
        const submittedCount = Number(test.submittedCount) || 0;
        return {
          id: String(test.id || test._id || ''),
          title: String(test.name || test.title || ''),
          questionCount: Number(test.questionCount) || 0,
          timeLimitMinutes: Number(test.timeLimitMinutes) || undefined,
          attempts: submittedCount,
          lastSessionId: activeSessionId || undefined,
          status: activeSessionId ? 'in_progress' : submittedCount > 0 ? 'completed' : 'not_started',
        };
      }),
    };
  },

  /** Bắt đầu hoặc tiếp tục 1 phiên làm bài */
  async startSession(testId: string, options?: { resume?: boolean }): Promise<CertPrepSession> {
    const session = await requestData<Record<string, unknown>>('/cert-prep/sessions', {
      method: 'POST',
      body: JSON.stringify({ testId, ...options }),
    });
    return normalizeSession(session);
  },

  /** Lấy nội dung phiên làm bài đang diễn ra */
  async getSession(sessionId: string): Promise<CertPrepSession> {
    const session = await requestData<Record<string, unknown>>(
      `/cert-prep/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'GET' },
    );
    return normalizeSession(session);
  },

  /** Lưu câu trả lời theo payload PATCH của backend */
  async saveAnswers(sessionId: string, answers: Record<string, unknown>): Promise<void> {
    await requestData(`/cert-prep/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      }),
    });
  },

  /** Nộp bài */
  async submitSession(sessionId: string): Promise<void> {
    await requestData(
      `/cert-prep/sessions/${encodeURIComponent(sessionId)}/submit`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  },

  /** Tạm dừng/thoát bài */
  async pauseSession(sessionId: string): Promise<void> {
    await requestData(`/cert-prep/sessions/${encodeURIComponent(sessionId)}/pause`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /** Lấy kết quả sau khi nộp */
  async getResult(sessionId: string): Promise<CertPrepResult & { answers?: Record<string, unknown>; questions?: CertPrepQuestion[] }> {
    const result = await requestData<Record<string, unknown>>(
      `/cert-prep/sessions/${encodeURIComponent(sessionId)}/result`,
      { method: 'GET' },
    );
    const scoreMax = Number(result.scoreMax) || 1000;
    return {
      ...result,
      score: Math.round((Number(result.score) || 0) * 100 / scoreMax),
      total: Number(result.totalQuestions) || 0,
      correctCount: Number(result.correctCount) || 0,
      passed: Boolean(result.passed),
      testId: result.testId ? String(result.testId) : undefined,
    } as CertPrepResult & { testId?: string; answers?: Record<string, unknown>; questions?: CertPrepQuestion[] };
  },

  /** Lịch sử các lần nộp bài của 1 đề */
  async getAttempts(testId: string): Promise<CertPrepAttempt[]> {
    const rows = await requestData<Array<Record<string, unknown>>>(
      `/cert-prep/tests/${encodeURIComponent(testId)}/attempts`,
      { method: 'GET' },
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      sessionId: String(row.sessionId || ''),
      attempt: Number(row.attempt) || 0,
      score: Number(row.score) || 0,
      passed: Boolean(row.passed),
      submittedAt: String(row.submittedAt || row.startedAt || ''),
      durationSeconds: Number(row.durationSeconds) || 0,
    }));
  },
};

export default certPrepApi;
