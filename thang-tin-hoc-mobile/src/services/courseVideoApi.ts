import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

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
  files?: LessonPracticeResource[];
};

export type LessonPracticeResource = {
  id?: string;
  _id?: string;
  title?: string;
  fileUrl?: string;
  url?: string;
  fileType?: string;
  type?: string;
  fileOriginalName?: string;
  fileSize?: string | number;
};

export type CourseLessonQuestion = {
  id: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  body: string;
  askerId: string;
  askerName: string;
  status: string;
  answer?: string;
  answeredByName?: string;
  answeredByRole?: string;
  answeredAt?: string | number | null;
  atSec: number;
  createdAt: number;
  thread: Array<{
    id: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    body: string;
    createdAt: number;
  }>;
};

export type CourseReview = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: number;
};

export type LessonPracticeItem = {
  id: string;
  type: string;
  practiceGroupId?: string;
  prompt?: string;
  options?: Array<{ id: string; text: string }>;
  imageUrl?: string;
  caption?: string;
  hint?: string;
  lefts?: Array<{ id: string; text: string }>;
  rights?: Array<{ id: string; text: string }>;
  confirmed?: boolean;
  correct?: boolean | null;
  explanation?: string;
  feedback?: string;
  timeLimitSec?: number;
  answer?: Record<string, unknown> | null;
};

export type LessonPracticeUnit = {
  id: string;
  title: string;
  antiSeek?: boolean;
  locked?: boolean;
  status?: 'completed' | 'in_progress' | 'locked' | 'open';
  hasPractice?: boolean;
  timeLimitSec?: number;
  practiceTimeLimits?: Array<{ groupId: string; timeLimitSec: number }>;
  note?: string;
  practiceGroupIds?: string[];
  practiceDoneGroupIds?: string[];
  videoDone?: boolean;
  noteDone?: boolean;
  practiceDone?: boolean;
  videoDoneIds?: string[];
  noteDoneIds?: string[];
  contentOrder?: string[];
  videos?: Array<{ id: string; title: string; url: string; antiSeek?: boolean }>;
  contents?: Array<{ id: string; title: string; content: string }>;
  videoUrl?: string;
  items?: LessonPracticeItem[];
};

type CatalogPayload = {
  data?: {
    subjects?: LessonPracticeSubject[];
    courses?: LessonPracticeCourse[];
  };
};

export async function getCourseVideoCatalog() {
  const payload = await mobileApiRequest<CatalogPayload>('/lesson-practice/my/subjects');
  if (!Array.isArray(payload.data?.subjects) || !Array.isArray(payload.data?.courses)) {
    throw new Error('Máy chủ trả về danh sách khóa học không hợp lệ.');
  }
  return {
    subjects: payload.data.subjects,
    courses: payload.data.courses.map((course) => ({
      ...course,
      thumbnail: course.thumbnail ? resolveMobilePublicUrl(course.thumbnail) : '',
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
      items?: LessonPracticeItem[];
    };
  }>(`/lesson-practice/my/units/${encodeURIComponent(unitId)}`);
  if (!payload.data?.unit) throw new Error('Máy chủ không trả về nội dung buổi học.');
  return { ...payload.data.unit, items: payload.data.items || [] };
}

export async function markCourseUnitSection(unitId: string, section: 'video' | 'note', itemId: string) {
  await mobileApiRequest(`/lesson-practice/my/units/${encodeURIComponent(unitId)}/sections/${section}`, {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
}

export async function confirmCoursePracticeItem(itemId: string, answer: Record<string, unknown>) {
  return mobileApiRequest<{ data?: { retry?: boolean; item?: LessonPracticeItem } }>(
    `/lesson-practice/my/items/${encodeURIComponent(itemId)}/confirm`,
    { method: 'POST', body: JSON.stringify(answer) },
  );
}

export async function resetCoursePractice(unitId: string, practiceGroupId: string) {
  return mobileApiRequest<{ data?: { unit?: LessonPracticeUnit; items?: LessonPracticeItem[] } }>(
    `/lesson-practice/my/units/${encodeURIComponent(unitId)}/reset-practice`,
    { method: 'POST', body: JSON.stringify({ practiceGroupId }) },
  );
}

export async function getCourseLessonQuestions(courseId: string, lessonId: string) {
  const query = new URLSearchParams({ courseId, lessonId, audience: 'student' });
  const payload = await mobileApiRequest<{ data?: CourseLessonQuestion[] }>(`/training-lms/qa?${query}`);
  if (!Array.isArray(payload.data)) {
    throw new Error('Máy chủ trả về danh sách hỏi đáp không hợp lệ.');
  }
  return payload.data;
}

export async function createCourseLessonQuestion(input: {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  body: string;
  videoUrl: string;
  atSec: number;
  videoDuration: number;
}) {
  const payload = await mobileApiRequest<{ data?: CourseLessonQuestion }>('/training-lms/qa', {
    method: 'POST',
    body: JSON.stringify({ ...input, audience: 'student' }),
  });
  if (!payload.data?.id) throw new Error('Máy chủ không xác nhận đã gửi câu hỏi.');
  return payload.data;
}

export async function replyCourseLessonQuestion(qaId: string, body: string) {
  const payload = await mobileApiRequest<{ data?: CourseLessonQuestion }>(
    `/training-lms/qa/${encodeURIComponent(qaId)}/reply`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
  if (!payload.data?.id) throw new Error('Máy chủ không xác nhận đã gửi phản hồi.');
  return payload.data;
}

export async function getCourseReviews(courseId: string) {
  const query = new URLSearchParams({ courseId, audience: 'student' });
  const payload = await mobileApiRequest<{
    data?: CourseReview[];
    avg?: number;
    count?: number;
  }>(`/training-lms/reviews?${query}`);
  if (!Array.isArray(payload.data)) {
    throw new Error('Máy chủ trả về danh sách đánh giá không hợp lệ.');
  }
  return { items: payload.data, average: Number(payload.avg) || 0, count: Number(payload.count) || 0 };
}

export async function submitCourseReview(input: {
  courseId: string;
  courseTitle: string;
  rating: number;
  comment: string;
}) {
  await mobileApiRequest<{ success?: boolean }>('/training-lms/reviews', {
    method: 'POST',
    body: JSON.stringify({ ...input, audience: 'student' }),
  });
}
