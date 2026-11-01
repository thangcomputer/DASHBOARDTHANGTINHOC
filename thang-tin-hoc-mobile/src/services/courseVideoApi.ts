import { mobileApiRequest } from './apiClient';

export type LessonPracticeSubject = {
  id: string;
  name: string;
  opened?: boolean;
  completedUnitCount?: number;
  totalUnitCount?: number;
  thumbnail?: string;
  previewUnits?: LessonPracticeUnit[];
};

export type LessonPracticeCourse = {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  bannerColorStart?: string;
  bannerColorEnd?: string;
  price?: number;
  originalPrice?: number | null;
  discountPercent?: number;
  totalSessions?: number;
  offerType?: 'single' | 'bundle';
  subjects: LessonPracticeSubject[];
  lessonCount?: number;
  enrolled: boolean;
  deliveryMode: 'video' | 'instructor';
  hiddenByEnrollment?: boolean;
};

export type LessonPracticeUnit = {
  id: string;
  title: string;
  locked?: boolean;
  status?: 'completed' | 'in_progress' | 'locked' | 'open';
  videos?: Array<{ id: string; title: string; url: string }>;
  contents?: Array<{ id: string; title: string; content: string }>;
  videoUrl?: string;
};

type CatalogPayload = {
  data?: {
    subjects?: LessonPracticeSubject[];
    courses?: LessonPracticeCourse[];
  };
};

function apiMediaUrl(path: string) {
  const value = path.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const apiBaseUrl = String(process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL || '').trim();
  if (!apiBaseUrl || !value) return '';
  return new URL(value, `${apiBaseUrl.replace(/\/+$/, '')}/`).toString();
}

export async function getCourseVideoCatalog() {
  const payload = await mobileApiRequest<CatalogPayload>('/lesson-practice/my/subjects');
  if (!Array.isArray(payload.data?.subjects) || !Array.isArray(payload.data?.courses)) {
    throw new Error('Máy chủ trả về danh sách khóa học không hợp lệ.');
  }
  return {
    subjects: payload.data.subjects,
    courses: payload.data.courses.map((course) => ({
      ...course,
      thumbnail: course.thumbnail ? apiMediaUrl(course.thumbnail) : '',
    })),
  };
}

export async function getCourseSubjectUnits(subjectId: string, courseId: string) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  const payload = await mobileApiRequest<{ data?: { units?: LessonPracticeUnit[] } }>(
    `/lesson-practice/my/subjects/${encodeURIComponent(subjectId)}/units${query}`,
  );
  if (!Array.isArray(payload.data?.units)) {
    throw new Error('Máy chủ trả về danh sách bài học không hợp lệ.');
  }
  return payload.data.units;
}

export async function openCourseVideoUnit(unitId: string) {
  const payload = await mobileApiRequest<{
    data?: {
      unit?: LessonPracticeUnit;
    };
  }>(`/lesson-practice/my/units/${encodeURIComponent(unitId)}`);
  if (!payload.data?.unit) throw new Error('Máy chủ không trả về nội dung buổi học.');
  return payload.data.unit;
}
