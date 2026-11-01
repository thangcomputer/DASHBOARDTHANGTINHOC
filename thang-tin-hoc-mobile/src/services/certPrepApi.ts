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
  questions?: CertPrepQuestion[];
  feedbackMode?: 'immediate' | 'end';
};

export type CertPrepResult = {
  sessionId: string;
  score: number;
  total: number;
  correctCount: number;
  timeTaken?: number;
  submittedAt?: string;
};

const certPrepApi = {
  /** Lấy danh sách khóa ôn thi học viên có quyền truy cập */
  async getCatalog(): Promise<CertPrepCourse[]> {
    return mobileApiRequest<CertPrepCourse[]>('/cert-prep/student/catalog', { method: 'GET' });
  },

  /** Lấy danh sách đề thi của 1 level */
  async getLevelTests(levelId: string): Promise<{
    level: CertPrepLevel;
    course: { id: string; name: string };
    expiresAt?: string;
    tests: CertPrepTest[];
  }> {
    return mobileApiRequest(`/cert-prep/student/levels/${levelId}/tests`, { method: 'GET' });
  },

  /** Bắt đầu hoặc tiếp tục 1 phiên làm bài */
  async startSession(testId: string, options?: { resume?: boolean }): Promise<CertPrepSession> {
    return mobileApiRequest('/cert-prep/student/sessions', {
      method: 'POST',
      body: JSON.stringify({ testId, ...options }),
    });
  },

  /** Lấy nội dung phiên làm bài đang diễn ra */
  async getSession(sessionId: string): Promise<CertPrepSession> {
    return mobileApiRequest(`/cert-prep/student/sessions/${sessionId}`, { method: 'GET' });
  },

  /** Lưu câu trả lời */
  async saveAnswer(sessionId: string, questionId: string, answer: unknown): Promise<void> {
    await mobileApiRequest(`/cert-prep/student/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, answer }),
    });
  },

  /** Nộp bài */
  async submitSession(sessionId: string): Promise<CertPrepResult> {
    return mobileApiRequest(`/cert-prep/student/sessions/${sessionId}/submit`, { method: 'POST', body: JSON.stringify({}) });
  },

  /** Tạm dừng/thoát bài */
  async pauseSession(sessionId: string): Promise<void> {
    await mobileApiRequest(`/cert-prep/student/sessions/${sessionId}/pause`, { method: 'POST', body: JSON.stringify({}) });
  },

  /** Lấy kết quả sau khi nộp */
  async getResult(sessionId: string): Promise<CertPrepResult & { answers?: Record<string, unknown>; questions?: CertPrepQuestion[] }> {
    return mobileApiRequest(`/cert-prep/student/sessions/${sessionId}/result`, { method: 'GET' });
  },
};

export default certPrepApi;
