import { DeviceEventEmitter } from 'react-native';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';
import { emitDailyPracticeStats } from './dailyPracticeApi';
import { LEARNING_GOAL_CHANGED_EVENT } from './learningGoalApi';
import { SOCKET_EVENTS } from './socketService';

export type LessonPracticeSubject = {
  id: string;
  name: string;
  slug?: string;
  summary?: string;
  icon?: string;
  color?: string;
  opened?: boolean;
  completedUnitCount?: number;
  totalUnitCount?: number;
  videoCount?: number;
  contentCount?: number;
  questionCount?: number;
  thumbnail?: string;
  previewUnits?: LessonPracticeUnit[];
};

export type LessonPracticeCourse = {
  id: string;
  sourceCourseId?: string;
  name: string;
  parentCourseName?: string;
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
  pairs?: Array<{ id?: string; left: string; right: string }>;
  region?: { x: number; y: number; w: number; h: number } | null;
  confirmed?: boolean;
  correct?: boolean | null;
  explanation?: string;
  feedback?: string;
  timeLimitSec?: number;
  answer?: Record<string, unknown> | null;
  correctOptionId?: string;
  correctOptionIds?: string[];
  videoId?: string;
  checkpointSec?: number;
  sortOrder?: number;
  atSec?: number;
  milestoneSec?: number;
};

export type LessonPracticeUnit = {
  id: string;
  title: string;
  antiSeek?: boolean;
  locked?: boolean;
  status?: 'not_started' | 'completed' | 'in_progress' | 'locked' | 'open';
  hasPractice?: boolean;
  questionCount?: number;
  videoDurationSeconds?: number;
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
  if (!Array.isArray(payload.data?.subjects)) {
    throw new Error('Máy chủ trả về danh sách môn học không hợp lệ.');
  }
  const courses = Array.isArray(payload.data?.courses) ? payload.data.courses : [];
  return {
    subjects: payload.data.subjects,
    courses: courses.map((course) => ({
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

export type StudyResumePoint = {
  subjectId: string;
  subjectName: string;
  courseId: string;
  unitId: string;
  unitTitle: string;
  sectionId: string;
  kind: 'video' | 'note' | 'practice' | '';
  itemTitle: string;
};

export async function getStudyResumePoint() {
  const payload = await mobileApiRequest<{ data?: StudyResumePoint | null }>('/lesson-practice/my/resume-point');
  return payload.data?.unitId ? payload.data : null;
}

export async function saveStudyResumePoint(point: { unitId: string; sectionId: string; courseId: string }) {
  await mobileApiRequest('/lesson-practice/my/resume-point', {
    method: 'PUT',
    body: JSON.stringify(point),
  });
}

export async function markCourseUnitSection(unitId: string, section: 'video' | 'note', itemId: string, watchRatio?: number) {
  await mobileApiRequest(`/lesson-practice/my/units/${encodeURIComponent(unitId)}/sections/${section}`, {
    method: 'POST',
    body: JSON.stringify({
      itemId,
      ...(watchRatio !== undefined ? { watchRatio } : section === 'video' ? { watchRatio: 1 } : {}),
    }),
  });
  if (section === 'video') {
    DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT);
  }
}

export type StreakHonorPayload = {
  id?: string;
  studentId?: string;
  studentName: string;
  studentAvatar?: string;
  streak: number;
  rewardXp?: number;
  achievedAt?: string;
  message?: string;
};

export type ConfirmCoursePracticePayload = {
  retry?: boolean;
  item?: LessonPracticeItem;
  unitStatus?: 'not_started' | 'in_progress' | 'completed';
  alreadyConfirmed?: boolean;
  isReview?: boolean;
  xpDelta?: number;
  questionXpDelta?: number;
  streakBonusXp?: number;
  xpTotal?: number;
  streak?: number;
  bestStreak?: number;
  playedToday?: boolean;
  streakHonor?: StreakHonorPayload | null;
  xpExhausted?: boolean;
  message?: string;
};

export async function confirmCoursePracticeItem(itemId: string, answer: Record<string, unknown>) {
  const res = await mobileApiRequest<{ data?: ConfirmCoursePracticePayload }>(
    `/lesson-practice/my/items/${encodeURIComponent(itemId)}/confirm`,
    { method: 'POST', body: JSON.stringify(answer) },
  );
  const data = res?.data;
  if (
    data
    && (typeof data.xpTotal === 'number' || typeof data.streak === 'number' || data.playedToday)
  ) {
    emitDailyPracticeStats({
      ...(typeof data.xpTotal === 'number' ? { xpTotal: data.xpTotal } : {}),
      ...(typeof data.xpDelta === 'number' && data.xpDelta < 0
        ? { spendXp: Math.abs(data.xpDelta) }
        : {}),
      ...(typeof data.streak === 'number' ? { streak: data.streak } : {}),
      ...(typeof data.bestStreak === 'number' ? { bestStreak: data.bestStreak } : {}),
      ...(data.playedToday ? { playedToday: true } : {}),
    });
  }
  if (data?.streakHonor) {
    DeviceEventEmitter.emit(SOCKET_EVENTS.STREAK_HONOR, data.streakHonor);
  }
  if (data && !data.retry) {
    DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT);
  }
  return res;
}

export async function resetCoursePractice(unitId: string, practiceGroupId: string) {
  return mobileApiRequest<{ data?: { unit?: LessonPracticeUnit; items?: LessonPracticeItem[] } }>(
    `/lesson-practice/my/units/${encodeURIComponent(unitId)}/reset-practice`,
    { method: 'POST', body: JSON.stringify({ practiceGroupId }) },
  );
}

export type CourseCheckout = {
  owned: boolean;
  sessionId?: string;
  ref?: string;
  amount: number;
  courseTitle?: string;
};

export type CenterBankAccount = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export async function checkoutCourse(courseId: string): Promise<CourseCheckout> {
  const payload = await mobileApiRequest<{ data?: CourseCheckout }>(
    `/lesson-practice/my/courses/${encodeURIComponent(courseId)}/checkout`,
    { method: 'POST', body: '{}' },
  );
  if (!payload.data) throw new Error('Máy chủ không tạo được phiên thanh toán.');
  return payload.data;
}

export async function getCoursePurchaseSession(sessionId: string) {
  const payload = await mobileApiRequest<{ paid?: boolean; status?: string }>(
    `/lesson-practice/my/course-purchase-sessions/${encodeURIComponent(sessionId)}`,
  );
  return { paid: payload.paid === true || payload.status === 'paid', status: payload.status || '' };
}

export async function simulateCoursePurchase(sessionId: string) {
  await mobileApiRequest(
    `/lesson-practice/my/course-purchase-sessions/${encodeURIComponent(sessionId)}/simulate-paid`,
    { method: 'POST', body: '{}' },
  );
}

export async function getCenterBankAccount(): Promise<CenterBankAccount | null> {
  const payload = await mobileApiRequest<{ data?: Partial<CenterBankAccount> }>('/settings/payment');
  const data = payload.data;
  if (!data?.bankCode || !data.accountNumber) return null;
  return {
    bankCode: data.bankCode,
    bankName: data.bankName || data.bankCode,
    accountNumber: data.accountNumber,
    accountName: data.accountName || '',
  };
}

export function buildVietQrUrl(bank: CenterBankAccount, amount: number, description: string) {
  const params = new URLSearchParams({
    amount: String(Math.round(Number(amount) || 0)),
    addInfo: description,
    accountName: bank.accountName,
  });
  return `https://img.vietqr.io/image/${bank.bankCode}-${bank.accountNumber}-qr_only.png?${params.toString()}`;
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
