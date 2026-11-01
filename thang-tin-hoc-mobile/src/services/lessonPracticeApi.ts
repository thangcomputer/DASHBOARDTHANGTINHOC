/**
 * lessonPracticeApi.ts
 * Mobile LessonPractice API — tương đương lessonPracticeApi.js của web.
 * Luyện bài theo bài học: catalog khóa học, chapters/units, player bài tập.
 */
import { mobileApiRequest } from './apiClient';

export type LPSubject = {
  id: string;
  name: string;
  description?: string;
  totalUnitCount?: number;
  completedUnitCount?: number;
};

export type LPCourse = {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  enrolled: boolean;
  price?: number;
  originalPrice?: number;
  deliveryMode?: 'self' | 'instructor';
  offerType?: 'single' | 'bundle';
  subjects?: LPSubject[];
  lessonCount?: number;
  totalSessions?: number;
  bannerColorStart?: string;
  bannerColorEnd?: string;
  discountStartsAt?: string;
  discountEndsAt?: string;
};

export type LPUnit = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  completed?: boolean;
  locked?: boolean;
  quizCount?: number;
  videoCount?: number;
  duration?: number;
};

export type LPChapter = {
  id: string;
  title: string;
  units: LPUnit[];
};

export type LPQuestion = {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'fill_blank';
  text: string;
  options?: string[];
  correctAnswer?: number | number[] | string;
  explanation?: string;
  imageUrl?: string;
};

export type LPLesson = {
  id: string;
  title: string;
  videoUrl?: string;
  content?: string;
  questions?: LPQuestion[];
  duration?: number;
};

const lessonPracticeApi = {
  /** Danh sách khóa học học viên có thể truy cập */
  async getCatalog(): Promise<LPCourse[]> {
    return mobileApiRequest<LPCourse[]>('/lesson-practice/catalog', { method: 'GET' });
  },

  /** Danh sách chapters và units của 1 subject */
  async getSubjectUnits(subjectId: string): Promise<{
    subject: LPSubject;
    chapters: LPChapter[];
    course: { id: string; name: string };
  }> {
    return mobileApiRequest(`/lesson-practice/subjects/${subjectId}/units`, { method: 'GET' });
  },

  /** Nội dung bài học (video + câu hỏi) */
  async getUnit(unitId: string): Promise<{
    unit: LPUnit;
    lessons: LPLesson[];
    subject: LPSubject;
    course: { id: string; name: string };
  }> {
    return mobileApiRequest(`/lesson-practice/units/${unitId}`, { method: 'GET' });
  },

  /** Đánh dấu hoàn thành 1 bài học */
  async completeLesson(unitId: string, lessonId: string): Promise<void> {
    await mobileApiRequest(`/lesson-practice/units/${unitId}/lessons/${lessonId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /** Nộp câu trả lời cho quiz trong bài học */
  async submitQuiz(unitId: string, lessonId: string, answers: Record<string, unknown>): Promise<{
    score: number;
    total: number;
    feedback: Array<{ questionId: string; correct: boolean; explanation?: string }>;
  }> {
    return mobileApiRequest(`/lesson-practice/units/${unitId}/lessons/${lessonId}/quiz`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  /** Progress tổng thể của học viên */
  async getProgress(): Promise<Record<string, { completed: number; total: number }>> {
    return mobileApiRequest('/lesson-practice/progress', { method: 'GET' });
  },
};

export default lessonPracticeApi;
