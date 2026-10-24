import type { MobileAuthenticatedRequestOptions } from '../../services/mobileAuthService';
import type { LearningCourse, LearningLesson, LearningProgressMap } from './learningTypes';
import { mapBackendCourse, mapBackendLesson, mapBackendProgress } from './learningMapper';

export type AuthenticatedLearningRequest = <T>(
  path: string,
  options?: MobileAuthenticatedRequestOptions,
) => Promise<T>;

type BackendEnvelope = {
  success?: boolean;
  data?: unknown;
  message?: string;
};

function requireSuccess(payload: BackendEnvelope | undefined, operation: string): BackendEnvelope {
  if (!payload || payload.success !== true) {
    throw new Error(payload?.message || `Learning API error while ${operation}.`);
  }
  return payload;
}

export const learningApiRepository = {
  async listCourses(request: AuthenticatedLearningRequest): Promise<LearningCourse[]> {
    const payload = await request<BackendEnvelope>('/api/training-lms/courses');
    requireSuccess(payload, 'loading courses');
    const rows = Array.isArray(payload.data) ? payload.data : [];
    return rows.map((row) => mapBackendCourse(row));
  },

  async listLessons(courseId: string, request: AuthenticatedLearningRequest): Promise<LearningLesson[]> {
    const payload = await request<BackendEnvelope>(`/api/training-lms/courses/${encodeURIComponent(courseId)}/lessons`);
    requireSuccess(payload, 'loading lessons');
    const rows = Array.isArray(payload.data) ? payload.data : [];
    return rows.map((row) => mapBackendLesson(row));
  },

  async getProgress(request: AuthenticatedLearningRequest): Promise<LearningProgressMap> {
    const payload = await request<BackendEnvelope>('/api/training-lms/progress/me');
    requireSuccess(payload, 'loading lesson progress');
    return mapBackendProgress(payload.data);
  },

  async saveProgress(
    request: AuthenticatedLearningRequest,
    payload: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration?: number },
  ) {
    const response = await request<BackendEnvelope>('/api/training-lms/save-watch-progress', {
      method: 'POST',
      body: {
        courseId: payload.courseId,
        lessonId: payload.lessonId,
        watchedSeconds: payload.watchedSeconds,
        videoDuration: payload.videoDuration ?? payload.watchedSeconds,
      },
    });
    return requireSuccess(response, 'saving watch progress');
  },

  async completeLesson(
    request: AuthenticatedLearningRequest,
    payload: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration?: number },
  ) {
    const response = await request<BackendEnvelope>('/api/training-lms/complete-lesson', {
      method: 'POST',
      body: {
        courseId: payload.courseId,
        lessonId: payload.lessonId,
        watchedSeconds: payload.watchedSeconds,
        videoDuration: payload.videoDuration ?? payload.watchedSeconds,
      },
    });
    return requireSuccess(response, 'marking lesson complete');
  },
};
