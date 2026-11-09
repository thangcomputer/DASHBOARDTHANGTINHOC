import type {
  DemoSoftwareLink,
  DemoTeacherTrainingOverview,
  DemoTrainingCourse,
  DemoTrainingFile,
  DemoTrainingGuide,
  DemoUser,
} from '../types';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

export type TeacherProfile = Record<string, unknown> & {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  zalo?: string;
  address?: string;
  age?: number;
  specialty?: string;
  voiceRegion?: string;
  bio?: string;
  status?: string;
  testScore?: number;
  baseSalaryPerSession?: number;
  startDate?: string;
  bankAccount?: Record<string, unknown>;
};

export type TeacherPublicCard = {
  id: string;
  _id: string;
  name: string;
  age: number | null;
  experience: string;
  specialty: string;
  averageRating: number;
  ratingCount: number;
  voiceRegion: string;
  avatar: string;
};

export type TeacherProfileUpdate = {
  email: string;
  zalo: string;
  age: number | null;
  address: string;
  bio: string;
  voiceRegion: string;
  bankAccount: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    bankBranch: string;
  };
};

export type TeacherFinanceOverview = {
  totalSessions: number;
  paidAmount: number;
  unpaidAmount: number;
  salaryPerSession: number;
  pendingSessionsCount: number;
  transactions: Array<{
    id: string;
    description: string;
    month: string;
    amount: number;
    status: 'pending' | 'confirmed' | 'cancelled';
    createdAt: string;
    confirmedBy: string;
    note: string;
    sessions: number;
    starBonusAmount: number;
    paymentSessionDetails: Array<{
      sessionId: string;
      studentId: string;
      studentName: string;
      date: string;
      courseName: string;
      allocatedAmount: number;
    }>;
  }>;
  pendingSessions: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    course: string;
    studentName: string;
    sessionNo: number | null;
    amount: number;
  }>;
};

export type TeacherDashboardMetrics = {
  monthlyIncome: number;
  ratingAverage: number;
  ratingCount: number;
  fiveStarStudentCount: number;
  recentRatings: Array<{
    id: string;
    studentName: string;
    stars: number;
    comment: string;
    createdAt: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const raw = asText(value);
  if (!raw) return null;
  const localDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = localDate
    ? new Date(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1]))
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getTeacherDashboardMetrics(user: DemoUser): Promise<TeacherDashboardMetrics> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải tổng quan giảng viên: tài khoản không hợp lệ.');
  }
  if (user.previewMode) {
    return {
      monthlyIncome: 0,
      ratingAverage: 0,
      ratingCount: 0,
      fiveStarStudentCount: 0,
      recentRatings: [],
    };
  }

  const [transactionsResponse, ratingsResponse] = await Promise.all([
    mobileApiRequest<{ data?: unknown }>(
      `/transactions/teacher/${encodeURIComponent(user.id)}`,
    ),
    mobileApiRequest<{ data?: unknown }>(
      `/evaluations/teacher/${encodeURIComponent(user.id)}`,
    ),
  ]);
  if (!Array.isArray(transactionsResponse.data) || !Array.isArray(ratingsResponse.data)) {
    throw new Error('Máy chủ trả về dữ liệu tổng quan giảng viên không hợp lệ.');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthlyIncome = transactionsResponse.data.reduce((total, entry) => {
    const transaction = asRecord(entry);
    const date = dateValue(transaction.date || transaction.createdAt);
    if (!date || date.getFullYear() !== year || date.getMonth() !== month) return total;
    return total + asNumber(transaction.amount);
  }, 0);

  const ratings = ratingsResponse.data.map((entry) => {
    const rating = asRecord(entry);
    const criteria = asRecord(rating.criteria);
    return {
      id: asText(rating.id || rating._id),
      studentId: asText(rating.studentId),
      studentName: asText(rating.studentName, 'Học viên'),
      stars: asNumber(criteria.stars),
      comment: asText(rating.content || rating.comment),
      createdAt: asText(rating.createdAt || rating.updatedAt),
    };
  }).filter((rating) => rating.stars > 0);
  const ratingAverage = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length) * 10) / 10
    : 0;
  const monthStart = new Date(year, month, 1).getTime();
  const nextMonthStart = new Date(year, month + 1, 1).getTime();
  const fiveStarStudentCount = new Set(ratings.filter((rating) => {
    const date = dateValue(rating.createdAt);
    return rating.stars >= 5
      && date != null
      && date.getTime() >= monthStart
      && date.getTime() < nextMonthStart;
  }).map((rating) => rating.studentId).filter(Boolean)).size;

  return {
    monthlyIncome,
    ratingAverage,
    ratingCount: ratings.length,
    fiveStarStudentCount,
    recentRatings: ratings.slice(0, 5).map(({ id, studentName, stars, comment, createdAt }) => ({
      id,
      studentName,
      stars,
      comment,
      createdAt,
    })),
  };
}

export async function getTeacherProfile(user: DemoUser): Promise<TeacherProfile> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải hồ sơ: tài khoản giảng viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: TeacherProfile }>(
    `/teachers/${encodeURIComponent(user.id)}`,
  );
  const profile = response.data;
  if (!profile || String(profile._id || profile.id || '') !== user.id) {
    throw new Error('Máy chủ trả về hồ sơ giảng viên không hợp lệ.');
  }
  return profile;
}

export async function getTeacherPublicCard(teacherId: string): Promise<TeacherPublicCard> {
  if (!teacherId.trim()) {
    throw new Error('Không thể tải thông tin: thiếu mã giảng viên.');
  }
  const response = await mobileApiRequest<{ data?: TeacherPublicCard }>(
    `/teachers/${encodeURIComponent(teacherId)}/public-card`,
  );
  const profile = response.data;
  if (!profile || String(profile.id || profile._id || '') !== teacherId) {
    throw new Error('Máy chủ trả về thông tin giảng viên không hợp lệ.');
  }
  return profile;
}

export async function updateTeacherProfile(user: DemoUser, updates: TeacherProfileUpdate): Promise<TeacherProfile> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể cập nhật hồ sơ: tài khoản giảng viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: TeacherProfile }>(
    `/teachers/${encodeURIComponent(user.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
  );
  const profile = response.data;
  if (!profile || String(profile._id || profile.id || '') !== user.id) {
    throw new Error('Máy chủ không xác nhận hồ sơ giảng viên đã cập nhật.');
  }
  return profile;
}

export async function getTeacherTrainingOverview(user: DemoUser): Promise<DemoTeacherTrainingOverview> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải đào tạo: tài khoản giảng viên không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: { courses?: unknown } }>(
    '/training-lms/teacher/overview',
  );
  const data = response.data as Record<string, unknown> | undefined;
  const rawSoftwareLinks = data?.softwareLinks ?? [];
  if (
    !data
    || !Array.isArray(data.courses)
    || !Array.isArray(data.guides)
    || !Array.isArray(data.files)
    || !Array.isArray(rawSoftwareLinks)
  ) {
    throw new Error('Phản hồi tổng quan đào tạo giảng viên không hợp lệ.');
  }
  const courses: DemoTrainingCourse[] = data.courses.map((entry, courseIndex) => {
    const raw = asRecord(entry);
    const id = asText(raw.id || raw._id);
    if (!id) throw new Error('Khóa đào tạo từ máy chủ thiếu mã định danh.');
    const lessons = Array.isArray(raw.videos) ? raw.videos : [];
    const files = Array.isArray(raw.files) ? raw.files : [];
    const notices = Array.isArray(raw.notices) ? raw.notices : [];
    return {
      id,
      title: asText(raw.title, `Khóa đào tạo ${courseIndex + 1}`),
      progress: Math.max(0, Math.min(100, asNumber(raw.progress))),
      lessons: lessons.map((lesson, lessonIndex) => {
        const lessonRecord = asRecord(lesson);
        return {
          id: asText(lessonRecord.id || lessonRecord._id, `${id}-lesson-${lessonIndex + 1}`),
          title: asText(lessonRecord.title, `Bài ${lessonIndex + 1}`),
          duration: asText(lessonRecord.duration, '-'),
          completed: lessonRecord.completed === true,
          url: asText(lessonRecord.url),
          watchedSeconds: Math.max(0, asNumber(lessonRecord.watchedSeconds)),
          antiSeek: lessonRecord.antiSeek === true,
        };
      }),
      files: files.map((file) => {
        const fileRecord = asRecord(file);
        return asText(fileRecord.title || fileRecord.name, 'Tài liệu');
      }),
      fileLinks: files.map((file) => {
        const fileRecord = asRecord(file);
        return {
          title: asText(fileRecord.title || fileRecord.name, 'Tài liệu'),
          url: asText(fileRecord.url || fileRecord.fileUrl || fileRecord.link),
          type: asText(fileRecord.type, 'Tài liệu'),
          size: asText(fileRecord.size),
        };
      }),
      notices: notices.filter((notice): notice is string => typeof notice === 'string'),
    };
  });
  const guides: DemoTrainingGuide[] = data.guides.map((entry, index) => {
    const raw = asRecord(entry);
    return {
      id: asText(raw.id || raw._id) || `guide-${index + 1}`,
      title: asText(raw.title, `Quy trình ${index + 1}`),
      description: asText(raw.desc || raw.description),
      icon: asText(raw.icon, '📄'),
    };
  });
  const files: DemoTrainingFile[] = data.files.map((entry, index) => {
    const raw = asRecord(entry);
    return {
      id: asText(raw.id || raw._id) || `training-file-${index + 1}`,
      title: asText(raw.title || raw.name || raw.fileOriginalName, `Tài liệu ${index + 1}`),
      type: asText(raw.type || raw.fileType, 'FILE'),
      size: asText(raw.size || raw.fileSize),
      url: resolveMobilePublicUrl(asText(raw.url || raw.fileUrl || raw.link)),
    };
  });
  const softwareLinks: DemoSoftwareLink[] = rawSoftwareLinks.map((entry, index) => {
    const raw = asRecord(entry);
    return {
      id: asText(raw.id || raw._id) || `software-${index + 1}`,
      name: asText(raw.name || raw.title, `Phần mềm ${index + 1}`),
      description: asText(raw.description || raw.desc),
      category: asText(raw.category || raw.type, 'Phần mềm khóa học'),
      url: resolveMobilePublicUrl(asText(raw.url || raw.link)),
    };
  });
  return { courses, guides, files, softwareLinks };
}

export async function getTeacherTrainingCourses(user: DemoUser): Promise<DemoTrainingCourse[]> {
  const overview = await getTeacherTrainingOverview(user);
  return overview.courses;
}

export async function saveTeacherTrainingWatchProgress(
  user: DemoUser,
  input: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration: number },
) {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể lưu tiến độ đào tạo: tài khoản giảng viên không hợp lệ.');
  }
  if (!input.courseId || !input.lessonId || !Number.isFinite(input.watchedSeconds) || !Number.isFinite(input.videoDuration)) {
    throw new Error('Không thể lưu tiến độ đào tạo: dữ liệu bài học không hợp lệ.');
  }
  await mobileApiRequest('/training-lms/save-watch-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function completeTeacherTrainingLesson(
  user: DemoUser,
  input: { courseId: string; lessonId: string; watchedSeconds: number; videoDuration: number },
) {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể hoàn tất bài đào tạo: tài khoản giảng viên không hợp lệ.');
  }
  if (!input.courseId || !input.lessonId || !Number.isFinite(input.watchedSeconds) || !Number.isFinite(input.videoDuration)) {
    throw new Error('Không thể hoàn tất bài đào tạo: dữ liệu bài học không hợp lệ.');
  }
  const response = await mobileApiRequest<{ data?: { status?: string } }>(
    '/training-lms/complete-lesson',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (response.data?.status !== 'completed') {
    throw new Error('Máy chủ chưa xác nhận hoàn thành bài đào tạo.');
  }
}

export async function getTeacherFinanceOverview(user: DemoUser): Promise<TeacherFinanceOverview> {
  if (user.role !== 'teacher' || !user.id) {
    throw new Error('Không thể tải tài chính: tài khoản giảng viên không hợp lệ.');
  }
  const [summaryResponse, transactionsResponse] = await Promise.all([
    mobileApiRequest<{ data?: Record<string, unknown> }>(
      `/teachers/${encodeURIComponent(user.id)}/finance`,
    ),
    mobileApiRequest<{ data?: unknown }>(
      `/transactions/teacher/${encodeURIComponent(user.id)}`,
    ),
  ]);
  const summary = summaryResponse.data;
  if (!summary || !Array.isArray(transactionsResponse.data)) {
    throw new Error('Phản hồi dữ liệu tài chính giảng viên không hợp lệ.');
  }
  const salaryPerSession = asNumber(summary.salaryPerSession);
  const unpaidAmount = asNumber(summary.unpaidAmount);
  return {
    totalSessions: asNumber(summary.totalSessions),
    paidAmount: asNumber(summary.paidAmount),
    unpaidAmount,
    salaryPerSession,
    pendingSessionsCount: salaryPerSession > 0 ? Math.round(unpaidAmount / salaryPerSession) : 0,
    transactions: transactionsResponse.data.map((entry) => {
      const transaction = asRecord(entry);
      const id = asText(transaction.id || transaction._id);
      const status = asText(transaction.status);
      if (!id || (status !== 'pending' && status !== 'confirmed' && status !== 'cancelled')) {
        throw new Error('Lịch sử giao dịch có dữ liệu không hợp lệ.');
      }
      return {
        id,
        description: asText(transaction.description),
        month: asText(transaction.month),
        amount: asNumber(transaction.amount),
        status,
        createdAt: asText(transaction.confirmedAt || transaction.createdAt),
        confirmedBy: asText(transaction.confirmedBy, 'Admin'),
        note: asText(transaction.note),
        sessions: Array.isArray(transaction.paymentSessionDetails)
          ? transaction.paymentSessionDetails.length
          : Array.isArray(transaction.paymentSessionIds)
            ? transaction.paymentSessionIds.length
            : 0,
        starBonusAmount: asNumber(transaction.starBonusAmount),
        paymentSessionDetails: Array.isArray(transaction.paymentSessionDetails)
          ? transaction.paymentSessionDetails.map((detail, index) => {
            const session = asRecord(detail);
            const paymentSessionIds = Array.isArray(transaction.paymentSessionIds)
              ? transaction.paymentSessionIds
              : [];
            return {
              sessionId: asText(session.id || session.sessionId || paymentSessionIds[index]),
              studentId: asText(session.studentId),
              studentName: asText(session.studentName, 'Học viên'),
              date: asText(session.date),
              courseName: asText(session.courseName),
              allocatedAmount: asNumber(session.allocatedAmount),
            };
          })
          : [],
      };
    }),
    pendingSessions: [],
  };
}
