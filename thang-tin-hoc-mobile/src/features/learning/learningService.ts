import { mockLearningCourses } from '../../mocks/data';
import type { LearningCourse, LearningLesson, LearningProgressMap } from './learningTypes';
import { learningApiRepository, type AuthenticatedLearningRequest } from './learningApiRepository';

export const isLearningApiEnabled = String(process.env.EXPO_PUBLIC_MOBILE_LEARNING_API || '').toLowerCase() === 'true';

export const learningService = {
  async courses(request?: AuthenticatedLearningRequest): Promise<LearningCourse[]> {
    if (!isLearningApiEnabled) return mockLearningCourses;
    if (!request) throw new Error('Learning REST API requires the authenticated mobile request helper.');
    return learningApiRepository.listCourses(request);
  },

  async lessons(courseId: string, request?: AuthenticatedLearningRequest): Promise<LearningLesson[]> {
    if (!isLearningApiEnabled) {
      const course = mockLearningCourses.find((item) => item._id === courseId);
      return course ? course.units.flatMap((unit) => unit.sections) : [];
    }
    if (!request) throw new Error('Learning REST API requires the authenticated mobile request helper.');
    return learningApiRepository.listLessons(courseId, request);
  },

  async progress(request?: AuthenticatedLearningRequest): Promise<LearningProgressMap> {
    if (!isLearningApiEnabled) {
      return Object.fromEntries(mockLearningCourses.map((course) => [course._id, course.progress]));
    }
    if (!request) throw new Error('Learning REST API requires the authenticated mobile request helper.');
    return learningApiRepository.getProgress(request);
  },

  async saveProgress(
    request: AuthenticatedLearningRequest,
    payload: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration?: number },
  ) {
    if (!isLearningApiEnabled) return { success: true };
    return learningApiRepository.saveProgress(request, payload);
  },

  async completeLesson(
    request: AuthenticatedLearningRequest,
    payload: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration?: number },
  ) {
    if (!isLearningApiEnabled) return { success: true };
    return learningApiRepository.completeLesson(request, payload);
  },
};
