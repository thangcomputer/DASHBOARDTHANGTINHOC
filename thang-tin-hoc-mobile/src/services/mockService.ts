import {
  mockAssignments,
  mockEvaluations,
  mockFeedPosts,
  mockFinanceTransactions,
  mockGradeQaFixtureRecords,
  mockLearningCourses,
  mockNews,
  mockQuizzes,
  mockStudentQuizzes,
  mockSoftwareLinks,
  mockTrainingCourses,
  mockMessages,
  mockMaterials,
  mockNotifications,
  mockTeacherSchedule,
  mockSchedule,
  mockStudentProfileQaEnrollments,
  mockStudentProfileQaVideoOrders,
  mockStudent,
  mockTeacher,
  mockTeacherAssignments,
  mockTeacherNotifications,
  mockTeacherStudents,
  mockTeacherThreads,
  mockStudentThreads,
} from '../mocks/data';
import type {
  AppNotification, ChatMessage, Conversation, DemoNewsItem, DemoSoftwareLink, DemoTeacherTrainingOverview, DemoTrainingCourse, DemoTrainingFile, DemoTrainingGuide, DemoUser, LearningMaterial, ScheduleItem, UserRole,
} from '../types';
import { Platform } from 'react-native';
import {
  clearMobileSession,
  loadMobileSession,
  mobileApiRequest,
  resolveMobilePublicUrl,
  saveMobileSession,
  setMobileApiTokens,
  type MobileStoredSession,
} from './apiClient';
import {
  getStudentAccountData,
  getStudentAssignments,
  getStudentExamResults,
  getStudentPaymentStatus,
  getTeacherAssignedStudents,
  getTeacherAssignedStudentDetail,
  updateTeacherAssignedStudent,
  failTeacherAssignedStudentExam,
  submitStudentAssignment,
  type RawStudent,
  type StudentPaymentStatus,
} from './studentApi';
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  getTeacherAssignments,
  gradeAssignmentSubmission,
  updateTeacherAssignment,
} from './assignmentApi';
import {
  addMessageGroupMembers, createMessageGroup, deleteMessageGroup, getMessageContacts, getMessageThread, getOlderMessages, leaveMessageGroup, markConversationRead, sendChatMessage,
  uploadChatAttachment, searchChatMessages, reactToChatMessage, recallChatMessage,
  deleteChatMessageForMe, setPinnedConversation, togglePinnedChatMessage, type ChatAttachmentUpload,
} from './messageApi';
import { emitMessageRead, joinChatGroup, leaveChatGroup as leaveSocketChatGroup } from './socketService';
import {
  getTeacherProfile,
  getTeacherFinanceOverview,
  getTeacherTrainingCourses,
  getTeacherTrainingOverview,
  updateTeacherProfile,
  type TeacherProfile,
  type TeacherProfileUpdate,
  type TeacherFinanceOverview,
} from './teacherApi';
import {
  getStudentEvaluations,
  submitPrivateEvaluation,
  submitTeacherRating,
} from './evaluationApi';
import { getStudentEvaluationActivity, getStudentQuizzes } from './studentQuizApi';
import {
  createTeacherQuiz, deleteTeacherQuiz, generateTeacherQuizQuestions, getTeacherQuizzes,
} from './teacherQuizApi';

const qaState = __DEV__ ? process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE : undefined;
const delay = (duration = qaState === 'loading' ? 3000 : 280) => new Promise((resolve) => setTimeout(resolve, duration));
const qaReadNotificationIds = new Set<string>();
const qaDismissedNotificationIds = new Set<string>();
let qaAllNotificationsRead = false;

function formatScheduleDateLabel(rawDate?: string | null) {
  if (!rawDate) return 'Chưa xác định';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatScheduleTime(startTime?: string | null, endTime?: string | null) {
  const start = String(startTime || '').trim();
  const end = String(endTime || '').trim();
  if (!start && !end) return 'Chưa xác định';
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function scheduleDateKey(value: unknown) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mapRealScheduleRow(raw: Record<string, any>, role: UserRole): ScheduleItem {
  const id = String(raw?._id || raw?.id || `${raw?.date || Date.now()}-${raw?.course || raw?.teacherName || role}`);
  const course = String(raw?.course || raw?.subject || raw?.title || 'Buổi học').trim() || 'Buổi học';
  const dateKey = scheduleDateKey(raw?.date);
  const startTime = String(raw?.startTime || raw?.start || '').trim();
  const endTime = String(raw?.endTime || raw?.end || '').trim();
  const teacherName = String(raw?.teacherName || raw?.teacherId?.name || 'Giảng viên').trim();
  const studentName = String(raw?.studentName || raw?.studentId?.name || 'Học viên').trim();
  const person = role === 'student' ? teacherName : studentName;
  const status = raw?.status === 'completed' ? 'completed' : raw?.status === 'cancelled' || raw?.status === 'no_show' ? 'cancelled' : 'upcoming';
  const attendanceStatus = raw?.studentConfirmStatus === 'pending'
    ? 'pending'
    : raw?.studentConfirmStatus === 'accepted' || raw?.status === 'completed'
      ? 'present'
      : raw?.status === 'no_show'
        ? 'absent'
        : 'pending';

  return {
    id,
    title: course,
    subject: course,
    person,
    dateLabel: formatScheduleDateLabel(raw?.date),
    time: formatScheduleTime(startTime, endTime),
    location: String(raw?.linkHoc || raw?.location || 'Trực tuyến').trim() || 'Trực tuyến',
    status,
    date: dateKey,
    courseName: course,
    teacherId: raw?.teacherId && typeof raw.teacherId === 'object'
      ? String(raw.teacherId._id || raw.teacherId.id || '')
      : String(raw?.teacherId || ''),
    teacherName,
    studentName,
    studentId: raw?.studentId && typeof raw.studentId === 'object' ? String(raw.studentId._id || raw.studentId.id || '') : String(raw?.studentId || ''),
    enrollmentId: String(raw?.enrollmentId?._id || raw?.enrollmentId || ''),
    startTime,
    endTime,
    note: String(raw?.attendancePendingNote || raw?.note || '').trim(),
    studentNote: String(raw?.studentNote || '').trim(),
    attendanceStatus,
    learningMode: raw?.linkHoc ? 'Trực tuyến' : 'Trực tiếp',
    meetingUrl: String(raw?.linkHoc || raw?.meetingUrl || '').trim(),
    confirmedByStudent: ['accepted', 'admin_approved'].includes(String(raw?.studentConfirmStatus || '')),
    attendanceConfirmPending: String(raw?.studentConfirmStatus || '') === 'pending',
    attendanceConfirmStatus: String(raw?.studentConfirmStatus || 'none'),
    attendanceDisputed: String(raw?.studentConfirmStatus || '') === 'disputed',
    attendanceRejected: String(raw?.studentConfirmStatus || '') === 'admin_rejected',
    confirmedByTeacher: String(raw?.status || '') === 'completed' || String(raw?.studentConfirmStatus || '') === 'admin_approved',
    grade: raw?.attendancePendingGrade ?? null,
    color: '#3B82F6',
  };
}

const FREE_PORTAL_COURSE_NAME = 'tài khoản miễn phí';

function isFreePortalWithoutRealCourse(user?: DemoUser | null): boolean {
  if (!user) return false;
  const role = String(user.role || 'student').toLowerCase();
  if (role !== 'student') return false;
  const hasRealEnrollment = Array.isArray(user.enrollments) && user.enrollments.some((enrollment) => {
    const label = String(enrollment?.courseName || '').trim().toLocaleLowerCase('vi');
    return Boolean(label) && label !== FREE_PORTAL_COURSE_NAME && enrollment.status === 'Đang học';
  });
  if (hasRealEnrollment) return false;
  return user.freePortal === true || String(user.course || '').trim().toLocaleLowerCase('vi') === FREE_PORTAL_COURSE_NAME;
}

async function readRealScheduleList(role: UserRole): Promise<ScheduleItem[]> {
  if (role === 'student') {
    const session = await loadMobileSession<DemoUser>().catch(() => null);
    if (isFreePortalWithoutRealCourse(session?.user)) return [];
  }
  try {
    const payload = await mobileApiRequest<{ data?: Record<string, any>[] }>('/schedules?limit=500');
    if (!Array.isArray(payload.data)) {
      throw new Error('Phản hồi danh sách lịch học không hợp lệ.');
    }
    return payload.data.map((row) => mapRealScheduleRow(row, role));
  } catch (err) {
    if ((err as { status?: number })?.status === 403) return [];
    throw err;
  }
}

type NotificationPage = {
  items: AppNotification[];
  page: number;
  pages: number;
  total: number;
  unread: number;
};

function mapRealNotification(raw: Record<string, any>): AppNotification {
  const createdAt = raw?.time || raw?.createdAt;
  const createdDate = createdAt ? new Date(createdAt) : null;
  const elapsedMinutes = createdDate && !Number.isNaN(createdDate.getTime())
    ? Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 60000))
    : null;
  const time = elapsedMinutes == null
    ? String(createdAt || 'Chưa xác định')
    : elapsedMinutes < 1
      ? 'Vừa xong'
      : elapsedMinutes < 60
        ? `${elapsedMinutes} phút trước`
        : elapsedMinutes < 1440
          ? `${Math.floor(elapsedMinutes / 60)} giờ trước`
          : createdDate!.toLocaleDateString('vi-VN');
  const type = String(raw?.type || raw?.category || 'SYSTEM').toUpperCase();
  const categoryByType: Record<string, string> = {
    SCHEDULE: 'Lịch học',
    ASSIGNMENT: 'Bài tập',
    FINANCE: 'Tài chính',
    MESSAGE: 'Tin nhắn',
    COURSE: 'Khóa học',
    EXAM: 'Thi',
    EVALUATION: 'Đánh giá',
    TRAINING: 'Đào tạo',
    NEWS: 'Tin tức',
    SYSTEM: 'Hệ thống',
  };
  const id = String(raw?.id || raw?._id || '').trim();
  if (!id) throw new Error('Thông báo từ máy chủ thiếu mã định danh.');
  return {
    id,
    title: String(raw?.title || 'Thông báo'),
    message: String(raw?.message || raw?.content || ''),
    time,
    category: categoryByType[type] || String(raw?.category || 'Thông báo'),
    type,
    targetPath: String(raw?.path || raw?.link || raw?.targetPath || ''),
    payload: raw?.payload && typeof raw.payload === 'object' ? raw.payload : undefined,
    unread: raw?.read !== true,
  };
}

async function readMockList<T>(items: T[]): Promise<T[]> {
  await delay();
  if (qaState === 'error') throw new Error('Mock UI QA error state');
  return qaState === 'empty' ? [] : items;
}

type CenterInfoSectionItem = {
  id: string;
  section: string;
  title: string;
  subtitle: string;
  description: string;
  detailHtml: string;
  imageUrl: string;
  icon: string;
  code: string;
  managerName: string;
  department: string;
  expertise: string;
  experience: string;
  city: string;
  showEmail: boolean;
  email: string;
  phone: string;
  address: string;
  url: string;
  mapsUrl: string;
  hours: string;
  duration: string;
  learningMode: string;
  priceInfo: string;
  examType: string;
  scheduleInfo: string;
  capacity: string;
  issuer: string;
  requirements: string;
  relatedExam: string;
  validity: string;
  verifyInfo: string;
  verifyUrl: string;
};

type CenterInfoSection = { title: string; items: CenterInfoSectionItem[] };

type CenterInfo = {
  published: boolean;
  name: string;
  logoUrl: string;
  bannerUrl: string;
  intro: string;
  mission: string;
  vision: string;
  coreValues: string;
  foundedYear: string;
  headquartersAddress: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  detailHtml: string;
  galleryUrls: string[];
  introVideoUrl: string;
  sections: CenterInfoSection[];
};

function rawRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rawText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function centerLink(value: unknown) {
  const url = rawText(value);
  if (!url || /^(https?:|mailto:|tel:)/i.test(url)) return url;
  return resolveMobilePublicUrl(url);
}

function newsDate(value: unknown) {
  if (!value) return 'Chưa xác định';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? 'Hôm nay'
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function plainNewsContent(value: unknown) {
  return rawText(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function mapRealNews(raw: Record<string, unknown>): DemoNewsItem {
  const id = rawText(raw.id || raw._id);
  if (!id) throw new Error('Bài viết từ máy chủ thiếu mã định danh.');
  const attachments = Array.isArray(raw.attachments) ? raw.attachments.map((entry, index) => {
    const file = rawRecord(entry);
    const url = rawText(file.url || file.fileUrl || file.path);
    const mimeType = rawText(file.mimeType || file.type).toLowerCase();
    const name = rawText(file.name || file.originalName || file.title) || `Tệp đính kèm ${index + 1}`;
    const extension = name.split('.').pop()?.toLowerCase() || '';
    const type: DemoNewsItem['attachments'][number]['type'] = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
      ? 'image'
      : mimeType.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(extension)
        ? 'video'
        : url
          ? 'link'
          : 'file';
    return {
      id: rawText(file.id || file._id) || `${id}-attachment-${index + 1}`,
      name,
      type,
      url: url ? resolveMobilePublicUrl(url) : undefined,
    };
  }) : [];
  const thumbnail = rawText(raw.thumbnailUrl);
  const contentHtml = rawText(raw.contentHtml || raw.content);
  return {
    id,
    slug: rawText(raw.slug) || id,
    title: rawText(raw.title) || 'Tin tức',
    topic: rawText(raw.topicName) || 'Tin tức',
    publishedAt: newsDate(raw.publishedAt || raw.createdAt),
    excerpt: plainNewsContent(raw.excerpt),
    content: plainNewsContent(contentHtml || raw.excerpt),
    contentHtml,
    views: Number(raw.viewCount) || 0,
    attachments,
    author: rawText(raw.authorName) || 'Trung tâm Thắng Tin Học',
    thumbnailUrl: thumbnail ? resolveMobilePublicUrl(thumbnail) : undefined,
    topicId: rawText(raw.topicId),
    targetAudience: ['teacher', 'student'].includes(rawText(raw.targetAudience))
      ? rawText(raw.targetAudience) as DemoNewsItem['targetAudience']
      : 'all',
    isNew: raw.isNew === true,
  };
}

function mapCenterInfoItem(value: unknown, index: number): CenterInfoSectionItem {
  const item = rawRecord(value);
  return {
    id: rawText(item.id || item._id) || `center-info-${index + 1}`,
    section: rawText(item.section),
    title: rawText(item.title) || 'Thông tin',
    subtitle: rawText(item.subtitle),
    description: rawText(item.description),
    detailHtml: rawText(item.detailHtml),
    imageUrl: item.imageUrl ? resolveMobilePublicUrl(rawText(item.imageUrl)) : '',
    icon: rawText(item.icon),
    code: rawText(item.code),
    managerName: rawText(item.managerName),
    department: rawText(item.department),
    expertise: rawText(item.expertise),
    experience: rawText(item.experience),
    city: rawText(item.city),
    showEmail: item.showEmail === true,
    email: rawText(item.email),
    phone: rawText(item.phone),
    address: rawText(item.address),
    url: centerLink(item.url),
    mapsUrl: centerLink(item.mapsUrl),
    hours: rawText(item.hours),
    duration: rawText(item.duration),
    learningMode: rawText(item.learningMode),
    priceInfo: rawText(item.priceInfo),
    examType: rawText(item.examType),
    scheduleInfo: rawText(item.scheduleInfo),
    capacity: rawText(item.capacity),
    issuer: rawText(item.issuer),
    requirements: rawText(item.requirements),
    relatedExam: rawText(item.relatedExam),
    validity: rawText(item.validity),
    verifyInfo: rawText(item.verifyInfo),
    verifyUrl: centerLink(item.verifyUrl),
  };
}

function mapCenterInfo(payload: Record<string, unknown>): CenterInfo {
  const data = rawRecord(payload.data);
  const overview = rawRecord(data.overview);
  const rawSections = rawRecord(data.sections);
  const labels: Record<string, string> = {
    staff: 'Nhân sự',
    branch: 'Chi nhánh',
    social: 'Mạng xã hội',
    service: 'Dịch vụ đào tạo',
    exam_venue: 'Địa điểm thi',
    certificate: 'Chứng chỉ',
  };
  const sections = Object.entries(labels).map(([key, title]) => ({
    title,
    items: (Array.isArray(rawSections[key]) ? rawSections[key] as unknown[] : []).map(mapCenterInfoItem),
  }));
  return {
    published: data.published === true,
    name: rawText(overview.name) || 'Trung tâm',
    logoUrl: overview.logoUrl ? resolveMobilePublicUrl(rawText(overview.logoUrl)) : '',
    bannerUrl: overview.bannerUrl ? resolveMobilePublicUrl(rawText(overview.bannerUrl)) : '',
    intro: rawText(overview.intro),
    mission: rawText(overview.mission),
    vision: rawText(overview.vision),
    coreValues: rawText(overview.coreValues),
    foundedYear: rawText(overview.foundedYear),
    headquartersAddress: rawText(overview.headquartersAddress),
    contactPhone: rawText(overview.contactPhone),
    contactEmail: rawText(overview.contactEmail),
    website: centerLink(overview.website),
    detailHtml: rawText(overview.detailHtml),
    galleryUrls: Array.isArray(overview.galleryUrls)
      ? overview.galleryUrls.map((url) => resolveMobilePublicUrl(rawText(url))).filter(Boolean)
      : [],
    introVideoUrl: centerLink(overview.introVideoUrl),
    sections,
  };
}

async function getRoleTrainingData(user?: DemoUser | null) {
  if (!user || !['student', 'teacher'].includes(user.role)) {
    throw new Error('Không thể tải tài nguyên: tài khoản mobile không hợp lệ.');
  }
  const endpoint = user.role === 'teacher' ? '/settings/training-data' : '/settings/student-training-data';
  const response = await mobileApiRequest<{ data?: Record<string, unknown> }>(endpoint);
  if (!response.data) throw new Error('Máy chủ không trả về danh sách tài nguyên.');
  return response.data;
}

function mapMaterial(value: unknown, index: number, fallbackType = ''): LearningMaterial {
  const raw = rawRecord(value);
  const title = rawText(raw.title || raw.name || raw.fileOriginalName || raw.fileName) || `Tài liệu ${index + 1}`;
  const url = centerLink(raw.url || raw.fileUrl || raw.link);
  const extension = (url || title).split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
  const sourceType = rawText(raw.type || raw.fileType || fallbackType).toLowerCase();
  const type: LearningMaterial['type'] = sourceType.includes('video') || ['mp4', 'mov', 'webm'].includes(extension)
    ? 'VIDEO'
    : sourceType.includes('pdf') || extension === 'pdf'
      ? 'PDF'
      : sourceType.includes('word') || sourceType.includes('doc') || ['doc', 'docx'].includes(extension)
        ? 'WORD'
        : sourceType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(extension)
          ? 'EXCEL'
          : url
            ? 'LINK'
          : 'LINK';
  const dateValue = raw.publishedAt || raw.createdAt || raw.updatedAt;
  const date = dateValue ? new Date(String(dateValue)) : null;
  const courseId = rawRecord(raw.courseId);
  const subjectIds = Array.isArray(raw.subjectIds) ? raw.subjectIds.map(String) : [];
  return {
    id: rawText(raw.id || raw._id) || `material-${fallbackType || 'file'}-${index + 1}`,
    title,
    subject: rawText(raw.courseName || raw.course || raw.subject || raw.category) || 'Tài nguyên khóa học',
    courseId: rawText(courseId._id || courseId.id || raw.courseId) || undefined,
    courseName: rawText(courseId.name || raw.courseName || raw.course) || undefined,
    subjectIds,
    type,
    date: date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : rawText(dateValue) || 'Chưa xác định',
    size: rawText(raw.sizeLabel || raw.size || raw.fileSize) || '—',
    url: url || undefined,
  };
}

function dateTimeHoursAgo(hours: number) {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const end = new Date(date.getTime() + 90 * 60 * 1000);
  const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  return { dateKey, time: `${time} – ${endTime}` };
}

export const authService = {
  async signIn(role: UserRole, phone: string, password: string): Promise<MobileStoredSession<DemoUser>> {
    if (!phone.trim() || !password.trim()) throw new Error('Vui lòng nhập số điện thoại và mật khẩu.');
    const platform = Platform.OS === 'web' ? 'web' : Platform.OS;
    if (!['android', 'ios', 'web'].includes(platform)) throw new Error('Nền tảng đăng nhập chưa được hỗ trợ.');
    const payload = await mobileApiRequest<{
      data?: {
        user?: Record<string, unknown>;
        accessToken?: string;
        refreshToken?: string;
        sessionId?: string;
      };
    }>('/auth/login/mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: phone.trim(),
        password,
        role,
        platform,
        deviceLabel: platform === 'web' ? 'Expo Web trên máy tính' : `${platform} app`,
      }),
    }, false);
    const data = payload.data;
    const rawUser = data?.user;
    if (
      !rawUser
      || typeof data?.accessToken !== 'string'
      || typeof data.refreshToken !== 'string'
      || typeof data.sessionId !== 'string'
    ) {
      throw new Error('Phản hồi đăng nhập từ máy chủ không hợp lệ.');
    }
    const returnedRole = rawUser.role === 'teacher' ? 'teacher' : rawUser.role === 'student' ? 'student' : null;
    const id = String(rawUser._id || rawUser.id || '').trim();
    const name = String(rawUser.name || '').trim();
    if (!returnedRole || returnedRole !== role || !id || !name) {
      throw new Error('Thông tin tài khoản trả về không hợp lệ.');
    }
    const user: DemoUser = {
      id,
      name,
      role: returnedRole,
      adminRole: typeof rawUser.adminRole === 'string' ? rawUser.adminRole : null,
      phone: String(rawUser.phone || phone).trim(),
      code: String(rawUser.code || rawUser.studentCode || rawUser.teacherCode || ''),
      course: String(rawUser.course || rawUser.specialty || ''),
      branch: String(rawUser.branchName || rawUser.branchCode || ''),
      avatarColor: returnedRole === 'teacher' ? '#E9E5FA' : '#DDF1EB',
      avatar: typeof rawUser.avatar === 'string' ? rawUser.avatar : undefined,
      completedSessions: typeof rawUser.completedSessions === 'number' ? rawUser.completedSessions : undefined,
      totalSessions: typeof rawUser.totalSessions === 'number' ? rawUser.totalSessions : undefined,
      avgGrade: typeof rawUser.avgGrade === 'number' ? rawUser.avgGrade : undefined,
      freePortal: rawUser.freePortal === true,
      freeUnlocked: rawUser.freeUnlocked === true,
      needsFreeSurvey: rawUser.needsFreeSurvey === true,
    };
    const session: MobileStoredSession<DemoUser> = {
      user,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        sessionId: data.sessionId,
      },
    };
    try {
      await saveMobileSession(session);
    } catch (error) {
      setMobileApiTokens(null);
      throw error;
    }
    return session;
  },
  async restore() {
    return loadMobileSession<DemoUser>();
  },
  async signOut() {
    try {
      const sessionTokens = (await loadMobileSession<DemoUser>())?.tokens;
      if (sessionTokens) {
        await mobileApiRequest('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: sessionTokens.refreshToken }),
        });
      }
    } finally {
      await clearMobileSession();
    }
  },
  async changePassword(oldPassword: string, newPassword: string) {
    if (__DEV__ && qaState) throw new Error('Không thể thay đổi mật khẩu thật trong chế độ UI QA.');
    await mobileApiRequest('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },
};

export const scheduleService = {
  async list(role: UserRole = 'student') {
    if (__DEV__ && qaState === 'web-preview') {
      return readMockList(role === 'teacher' ? mockTeacherSchedule : mockSchedule);
    }
    if (__DEV__ && qaState === 'error') throw new Error('Mock UI QA error state');
    if (__DEV__ && qaState === 'empty') return [];
    if (__DEV__ && qaState === 'loading') await delay();
    if (__DEV__ && qaState && ['attendance-overdue', 'attendance-pending'].includes(qaState)) {
      const timing = dateTimeHoursAgo(qaState === 'attendance-overdue' ? 3 : 2);
      const item = {
        ...mockTeacherSchedule[0],
        id: qaState === 'attendance-overdue' ? 'qa-attendance-overdue' : 'qa-attendance-pending',
        title: 'Word nâng cao · Buổi 8',
        subject: 'Word nâng cao',
        date: timing.dateKey,
        dateLabel: 'Hôm nay',
        time: timing.time,
        status: 'upcoming' as const,
        attendanceStatus: 'pending' as const,
        note: 'Buổi học demo cần xác nhận điểm danh.',
      };
      return readMockList([item]);
    }
    return readRealScheduleList(role);
  },
  async pendingAttendanceConfirm(user?: DemoUser | null) {
    if (!user || user.role !== 'student') {
      throw new Error('Chỉ học viên đã đăng nhập mới được tải xác nhận điểm danh.');
    }
    if (user.previewMode || (__DEV__ && qaState) || isFreePortalWithoutRealCourse(user)) return [];
    try {
      const response = await mobileApiRequest<{ data?: Record<string, any>[] }>('/schedules/pending-confirm');
      if (!Array.isArray(response.data)) {
        throw new Error('Phản hồi xác nhận điểm danh đang chờ không hợp lệ.');
      }
      return response.data.map((raw) => ({
        ...mapRealScheduleRow({
          ...raw,
          _id: raw.scheduleId,
          course: raw.course,
          status: 'scheduled',
        }, 'student'),
        teacherName: String(raw.teacherName || 'Giảng viên'),
        studentName: String(raw.studentName || user.name),
        attendanceSessionNumber: raw.sessionNumber ?? raw.sessionOrdinalPreview ?? raw.completedSessions ?? null,
        attendanceTotalSessions: raw.totalSessions ?? raw.sessionTotalPreview ?? null,
        weekday: String(raw.weekday || ''),
      }));
    } catch (err) {
      if ((err as { status?: number })?.status === 403) return [];
      throw err;
    }
  },
  async create(
    input: {
      teacherId: string;
      studentId: string;
      date: string;
      startTime: string;
      endTime: string;
      course: string;
      enrollmentId?: string;
    },
    user?: DemoUser | null,
  ) {
    if (!user || user.role !== 'teacher' || !user.id) {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được xếp lịch.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể xếp lịch thật trong chế độ xem trước.');
    }
    const response = await mobileApiRequest<{ success?: boolean; data?: Record<string, unknown> }>('/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, teacherId: user.id }),
    });
    if (response.success !== true || !response.data) {
      throw new Error('Máy chủ không xác nhận lịch học đã được tạo.');
    }
    return response.data;
  },
  async update(
    scheduleId: string,
    updates: { date: string; startTime: string; endTime: string },
    user?: DemoUser | null,
  ) {
    if (!scheduleId.trim()) throw new Error('Không thể đổi lịch: thiếu mã buổi học.');
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được đổi lịch.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể đổi lịch thật trong chế độ xem trước.');
    }
    const response = await mobileApiRequest<{ success?: boolean; data?: Record<string, unknown> }>(
      `/schedules/${encodeURIComponent(scheduleId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      },
    );
    if (response.success !== true || !response.data) {
      throw new Error('Máy chủ không xác nhận lịch học đã được cập nhật.');
    }
    return response.data;
  },
  async markAttendance(
    scheduleId: string,
    input: { note: string; grade: number },
    user?: DemoUser | null,
  ) {
    if (!scheduleId.trim()) throw new Error('Không thể điểm danh: thiếu mã buổi học.');
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được điểm danh.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể điểm danh thật trong chế độ xem trước.');
    }
    const response = await mobileApiRequest<{
      success?: boolean;
      data?: Record<string, unknown>;
    }>(`/schedules/${encodeURIComponent(scheduleId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        note: input.note,
        grade: input.grade,
      }),
    });
    if (response.success !== true || !response.data) {
      throw new Error('Máy chủ không xác nhận đã ghi nhận điểm danh.');
    }
    return response.data;
  },
  async cancel(scheduleId: string, reason: string, user?: DemoUser | null) {
    if (!scheduleId.trim()) throw new Error('Không thể hủy lịch: thiếu mã buổi học.');
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được hủy lịch.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể hủy lịch thật trong chế độ xem trước.');
    }
    const response = await mobileApiRequest<{ success?: boolean }>(
      `/schedules/${encodeURIComponent(scheduleId)}/cancel`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      },
    );
    if (response.success !== true) {
      throw new Error('Máy chủ không xác nhận lịch học đã được hủy.');
    }
  },
  async confirmAttendance(
    scheduleId: string,
    decision: 'accept' | 'dispute',
    user?: DemoUser | null,
  ) {
    if (!scheduleId.trim()) throw new Error('Không thể xác nhận điểm danh: thiếu mã buổi học.');
    if (!user || user.role !== 'student') {
      throw new Error('Chỉ học viên đã đăng nhập mới được xác nhận điểm danh.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      return { disputed: decision === 'dispute' };
    }
    const response = await mobileApiRequest<{
      data?: Record<string, unknown>;
      disputed?: boolean;
    }>(`/schedules/${encodeURIComponent(scheduleId)}/student-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!response.data) throw new Error('Máy chủ không xác nhận đã cập nhật điểm danh.');
    return { disputed: response.disputed === true };
  },
  async saveStudentNote(scheduleId: string, note: string, user?: DemoUser | null) {
    if (!scheduleId.trim()) throw new Error('Không thể gửi ghi chú: thiếu mã buổi học.');
    if (!user || user.role !== 'student') {
      throw new Error('Chỉ học viên đã đăng nhập mới được gửi ghi chú.');
    }
    if (user.previewMode || (__DEV__ && qaState)) return;
    await mobileApiRequest(`/schedules/${encodeURIComponent(scheduleId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentNote: note }),
    });
  },
};

export const assignmentService = {
  async list(role: UserRole = 'student', user?: DemoUser | null) {
    if (role === 'student' && qaState === 'assignment-submitted') {
      return readMockList(mockAssignments.map((item) => item.id === 'task-1' ? { ...item, status: 'Đã nộp' as const } : item));
    }
    if (role === 'student' && qaState === 'assignment-graded') {
      return readMockList(mockAssignments.map((item) => item.id === 'task-1' ? { ...item, status: 'Đã chấm' as const, grade: 8.5, teacherFeedback: 'Bài làm demo đã được nhận xét.' } : item));
    }
    if (role === 'student' && !qaState) {
      if (!user) throw new Error('Không thể tải bài tập: tài khoản học viên không hợp lệ.');
      if (isFreePortalWithoutRealCourse(user) && user.freeUnlocked !== true) return [];
      try {
        return await getStudentAssignments(user);
      } catch (err) {
        if ((err as { status?: number })?.status === 403) return [];
        throw err;
      }
    }
    if (role === 'teacher' && !qaState && !user?.previewMode) {
      if (!user) throw new Error('Không thể tải bài tập: tài khoản giảng viên không hợp lệ.');
      return getTeacherAssignments(user);
    }
    return readMockList(role === 'teacher' ? mockTeacherAssignments : mockAssignments);
  },
  async create(user: DemoUser, input: Parameters<typeof createTeacherAssignment>[1]) {
    if (__DEV__ && qaState) throw new Error('Không thể giao bài thật trong chế độ UI QA.');
    return createTeacherAssignment(user, input);
  },
  async update(assignmentId: string, input: Parameters<typeof updateTeacherAssignment>[1]) {
    if (__DEV__ && qaState) throw new Error('Không thể sửa bài thật trong chế độ UI QA.');
    return updateTeacherAssignment(assignmentId, input);
  },
  async remove(assignmentId: string) {
    if (__DEV__ && qaState) throw new Error('Không thể xóa bài thật trong chế độ UI QA.');
    return deleteTeacherAssignment(assignmentId);
  },
  async grade(submissionId: string, grade: number, feedback: string) {
    if (__DEV__ && qaState) throw new Error('Không thể chấm bài thật trong chế độ UI QA.');
    return gradeAssignmentSubmission(submissionId, grade, feedback);
  },
  async submit(assignmentId: string, studentId: string, submittedFileUrl: string) {
    if (__DEV__ && qaState) throw new Error('Không thể gửi bài thật trong chế độ UI QA.');
    return submitStudentAssignment(assignmentId, studentId, submittedFileUrl);
  },
};

export const materialService = {
  async list(user?: DemoUser | null): Promise<LearningMaterial[]> {
    if (__DEV__ && qaState) return readMockList(mockMaterials);
    if (user?.previewMode) return readMockList(mockMaterials);
    const data = await getRoleTrainingData(user);
    const rows = [
      ...(['files', 'guides', 'videos'] as const).flatMap((key) => {
        const values = data[key];
        if (values === undefined) return [];
        if (!Array.isArray(values)) throw new Error(`Danh sách ${key} từ máy chủ không hợp lệ.`);
        const type = key === 'videos' ? 'video' : key === 'guides' ? 'link' : '';
        return values.map((value, index) => mapMaterial(value, index, type));
      }),
    ];
    return rows;
  },
};

export const notificationService = {
  async list(_role: UserRole = 'student', page = 1, limit = 20): Promise<NotificationPage> {
    if (__DEV__ && qaState) {
      let source: AppNotification[];
      if (qaState === 'notification-25-items') {
        const fixtureSource = _role === 'teacher' ? mockTeacherNotifications : mockNotifications;
        source = Array.from({ length: 25 }, (_, index) => {
          const item = fixtureSource[index % fixtureSource.length];
          const id = `qa-notice-${index + 1}`;
          return {
            ...item,
            id,
            title: `${item.title} · ${index + 1}`,
            unread: !qaAllNotificationsRead && !qaReadNotificationIds.has(id) && index % 2 === 0,
          };
        });
      } else {
        const mockSource = _role === 'teacher' ? mockTeacherNotifications : mockNotifications;
        source = mockSource.map((item) => ({
          ...item,
          unread: !qaAllNotificationsRead && !qaReadNotificationIds.has(item.id) && item.unread,
        }));
      }
      const visibleItems = await readMockList(source.filter((item) => !qaDismissedNotificationIds.has(item.id)));
      const unread = visibleItems.filter((item) => item.unread).length;
      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
      const safePage = Math.max(1, Math.floor(page));
      return {
        items: visibleItems.slice((safePage - 1) * safeLimit, safePage * safeLimit),
        page: safePage,
        pages: Math.max(1, Math.ceil(visibleItems.length / safeLimit)),
        total: visibleItems.length,
        unread,
      };
    }
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const safePage = Math.max(1, Math.floor(page));
    const payload = await mobileApiRequest<{
      data?: Record<string, any>[];
      pagination?: { page?: number; pages?: number; total?: number };
      unread?: number;
    }>(`/notifications?page=${safePage}&limit=${safeLimit}`);
    const responsePage = payload.pagination?.page;
    const responsePages = payload.pagination?.pages;
    const responseTotal = payload.pagination?.total;
    const unread = payload.unread;
    if (!Array.isArray(payload.data)
      || typeof responsePage !== 'number'
      || !Number.isInteger(responsePage)
      || typeof responsePages !== 'number'
      || !Number.isInteger(responsePages)
      || typeof responseTotal !== 'number'
      || !Number.isInteger(responseTotal)
      || typeof unread !== 'number'
      || !Number.isInteger(unread)) {
      throw new Error('Phản hồi danh sách thông báo không hợp lệ.');
    }
    const uniqueItems = new Map<string, AppNotification>();
    for (const raw of payload.data) {
      const item = mapRealNotification(raw);
      if (!uniqueItems.has(item.id)) uniqueItems.set(item.id, item);
    }
    return {
      items: [...uniqueItems.values()],
      page: responsePage,
      pages: Math.max(1, responsePages),
      total: responseTotal,
      unread,
    };
  },
  async unreadCount(user?: DemoUser | null): Promise<number> {
    if (__DEV__ && qaState) {
      const result = await this.list(user?.role === 'teacher' ? 'teacher' : 'student', 1, 100);
      return result.unread;
    }
    if (!user || user.previewMode) return 0;
    const payload = await mobileApiRequest<{ count?: number }>('/notifications/count');
    if (typeof payload.count !== 'number' || !Number.isInteger(payload.count) || payload.count < 0) {
      throw new Error('Phản hồi số lượng thông báo chưa đọc không hợp lệ.');
    }
    return payload.count;
  },
  async markRead(notificationId?: string) {
    if (__DEV__ && qaState) {
      if (notificationId) qaReadNotificationIds.add(notificationId);
      else qaAllNotificationsRead = true;
      return;
    }
    await mobileApiRequest('/notifications/mark-read', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationId ? { notificationId } : { markAll: true }),
    });
  },
  async dismiss(notificationId: string) {
    if (__DEV__ && qaState) {
      qaDismissedNotificationIds.add(notificationId);
      return;
    }
    await mobileApiRequest(`/notifications/${encodeURIComponent(notificationId)}`, { method: 'DELETE' });
  },
};

export const messageService = {
  async conversations(_role: UserRole = 'student', user?: DemoUser | null) {
    if (!user) throw new Error('Không thể tải danh bạ khi chưa đăng nhập.');
    if (isFreePortalWithoutRealCourse(user) && user.freeUnlocked !== true) return [];
    return getMessageContacts(user);
  },
  async thread(conversationId = 'chat-1', role: UserRole = 'student', user?: DemoUser | null) {
    if (qaState === 'chat-empty') return readMockList([]);
    if (user && !user.previewMode) return getMessageThread(conversationId, user);
    return readMockList(role === 'teacher' ? mockTeacherThreads[conversationId] || [] : (mockStudentThreads[conversationId] || mockMessages));
  },
  async olderThread(conversationId: string, beforeId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) return { messages: [] as ChatMessage[], hasMore: false };
    return getOlderMessages(conversationId, user, beforeId);
  },
  async markRead(conversationId: string, user?: DemoUser | null) {
    if (user && !user.previewMode) {
      await markConversationRead(conversationId);
      emitMessageRead(conversationId);
    }
  },
  async send(conversation: Conversation, content: string, user?: DemoUser | null, attachment?: ChatAttachmentUpload, replyTo?: ChatMessage) {
    if (user && !user.previewMode) {
      const uploaded = attachment ? await uploadChatAttachment(attachment) : undefined;
      return sendChatMessage(conversation, user, content, uploaded, replyTo);
    }
    throw new Error('Gửi tin nhắn chỉ khả dụng với tài khoản đã đăng nhập.');
  },
  async search(conversationId: string, query: string, user?: DemoUser | null) {
    if (!user || user.previewMode) return [];
    return searchChatMessages(conversationId, user, query);
  },
  async react(messageId: string, emoji: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Thả cảm xúc chỉ khả dụng với tài khoản đã đăng nhập.');
    return reactToChatMessage(messageId, emoji, user);
  },
  async recall(messageId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Thu hồi tin nhắn chỉ khả dụng với tài khoản đã đăng nhập.');
    return recallChatMessage(messageId);
  },
  async deleteForMe(messageId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Xóa tin nhắn chỉ khả dụng với tài khoản đã đăng nhập.');
    return deleteChatMessageForMe(messageId);
  },
  async togglePin(conversationId: string, messageId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Ghim tin nhắn chỉ khả dụng với tài khoản đã đăng nhập.');
    return togglePinnedChatMessage(conversationId, messageId);
  },
  async setConversationPinned(conversationId: string, pinned: boolean, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Ghim cuộc trò chuyện chỉ khả dụng với tài khoản đã đăng nhập.');
    await setPinnedConversation(conversationId, pinned);
  },
  async createGroup(name: string, members: Conversation[], user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Tạo nhóm thật chỉ khả dụng với tài khoản đã đăng nhập.');
    const group = await createMessageGroup(name, members);
    joinChatGroup(group.participantId || '');
    return group;
  },
  async addGroupMembers(groupId: string, members: Conversation[], user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Quản lý nhóm chỉ khả dụng với tài khoản đã đăng nhập.');
    await addMessageGroupMembers(groupId, members);
  },
  async leaveGroup(groupId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Rời nhóm chỉ khả dụng với tài khoản đã đăng nhập.');
    await leaveMessageGroup(groupId);
    leaveSocketChatGroup(groupId);
  },
  async deleteGroup(groupId: string, user?: DemoUser | null) {
    if (!user || user.previewMode) throw new Error('Xóa nhóm chỉ khả dụng với tài khoản đã đăng nhập.');
    await deleteMessageGroup(groupId);
  },
};

export const studentService = {
  async assigned(user?: DemoUser | null) {
    if (__DEV__ && qaState) return readMockList(mockTeacherStudents);
    if (!user) throw new Error('Không thể tải danh sách học viên khi chưa đăng nhập.');
    if (user.previewMode) return readMockList(mockTeacherStudents);
    if (user.role !== 'teacher') return [];
    return getTeacherAssignedStudents(user);
  },
  async updateAssigned(
    user: DemoUser | null | undefined,
    studentId: string,
    courseName: string,
    updates: { notes?: string; linkHoc?: string; avgGrade?: number },
  ) {
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được cập nhật học viên.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể lưu thay đổi học viên trong chế độ xem trước.');
    }
    return updateTeacherAssignedStudent(user, studentId, courseName, updates);
  },
  async detail(user: DemoUser | null | undefined, studentId: string) {
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được xem hồ sơ chi tiết học viên.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      return { attendance: [], examResults: [] };
    }
    return getTeacherAssignedStudentDetail(user, studentId);
  },
  async failExam(user: DemoUser | null | undefined, studentId: string, reason: string) {
    if (!user || user.role !== 'teacher') {
      throw new Error('Chỉ giảng viên đã đăng nhập mới được đánh trượt học viên.');
    }
    if (user.previewMode || (__DEV__ && qaState)) {
      throw new Error('Không thể đánh trượt học viên trong chế độ xem trước.');
    }
    return failTeacherAssignedStudentExam(user, studentId, reason);
  },
};

export const learningService = {
  async courses() {
    if (qaState === 'grades-no-grade') {
      return readMockList(mockLearningCourses.map((course) => ({ ...course, progress: 0, units: course.units.map((unit) => ({ ...unit, sections: unit.sections.map((lesson) => ({ ...lesson, completed: false, progress: 0 })) })) })));
    }
    if (qaState === 'grades-completed') {
      return readMockList(mockLearningCourses.map((course) => ({ ...course, progress: 100, units: course.units.map((unit) => ({ ...unit, sections: unit.sections.map((lesson) => ({ ...lesson, completed: true, progress: 100, locked: false })) })) })));
    }
    return readMockList(mockLearningCourses);
  },
};

export const gradeService = {
  async list(user?: DemoUser | null) {
    if (qaState === 'grades-no-grade') return readMockList([]);
    if (qaState === 'grades-completed') {
      return readMockList(mockGradeQaFixtureRecords.map((record) => ({ ...record, status: 'Hoàn thành' as const, qaFixture: true })));
    }
    if (__DEV__ && qaState) return readMockList([]);
    if (user?.previewMode) return readMockList([]);
    if (!user || user.role !== 'student') throw new Error('Không thể tải điểm: tài khoản học viên không hợp lệ.');
    const [assignments, quizzes, examResults] = await Promise.all([
      getStudentAssignments(user),
      getStudentQuizzes(user),
      getStudentExamResults(user),
    ]);
    const assignmentRecords = assignments.flatMap((assignment) => assignment.grade == null ? [] : [{
      id: assignment.id,
      courseName: assignment.subject,
      assessment: assignment.title,
      score: `${assignment.grade}/10`,
      status: 'Hoàn thành' as const,
      date: assignment.submissions?.[0]?.submittedAt,
      feedback: assignment.teacherFeedback,
    }]);
    const quizRecords = quizzes.flatMap((quiz) => {
      const submission = quiz.mySubmission;
      if (!submission || submission.score == null) return [];
      const correctCount = submission.correctCount;
      const totalQuestions = submission.totalQuestions;
      return [{
        id: `quiz-${quiz.id}`,
        courseName: quiz.courseName || 'Trắc nghiệm',
        assessment: `Trắc nghiệm: ${quiz.title}`,
        score: `${submission.score}%`,
        status: submission.passed ? 'Đạt' as const : 'Chưa đạt' as const,
        date: submission.submittedAt,
        feedback: correctCount != null && totalQuestions != null
          ? `${correctCount}/${totalQuestions} câu đúng`
          : undefined,
      }];
    });
    return [...assignmentRecords, ...quizRecords, ...examResults];
  },
};

export const studentPaymentService = {
  async get(user: DemoUser | null | undefined): Promise<StudentPaymentStatus | null> {
    if (!user || user.role !== 'student') {
      throw new Error('Không thể tải trạng thái học phí: tài khoản học viên không hợp lệ.');
    }
    if (user.previewMode || (__DEV__ && qaState)) return null;
    return getStudentPaymentStatus(user);
  },
};

export const studentProfileService = {
  async get(user: DemoUser | null | undefined): Promise<{
    enrollments: NonNullable<DemoUser['enrollments']>;
    videoOrders: NonNullable<DemoUser['videoOrders']>;
    qaFixture: boolean;
    student: RawStudent | null;
  }> {
    if (!user) throw new Error('Không thể tải hồ sơ khi chưa đăng nhập.');
    if (__DEV__ && qaState === 'web-preview') {
      return {
        enrollments: mockStudentProfileQaEnrollments,
        videoOrders: mockStudentProfileQaVideoOrders,
        qaFixture: true,
        student: {
          ...mockStudent,
          _id: user.id,
          enrollments: mockStudentProfileQaEnrollments,
          email: 'minhanh@example.test',
          address: 'Địa chỉ mẫu — chỉ dùng xem giao diện',
          zalo: mockStudent.phone,
          branch: mockStudent.branch,
        } as RawStudent,
      };
    }
    if (__DEV__ && qaState === 'student-profile-populated') {
      return {
        enrollments: mockStudentProfileQaEnrollments,
        videoOrders: mockStudentProfileQaVideoOrders,
        qaFixture: true,
        student: null,
      };
    }
    if (__DEV__ && qaState === 'error') throw new Error('Mock UI QA error state');
    const account = await getStudentAccountData(user);
    return {
      enrollments: account.enrollments,
      videoOrders: account.videoOrders,
      qaFixture: false,
      student: account.student,
    };
  },
};

export const teacherProfileService = {
  async get(user: DemoUser | null | undefined): Promise<TeacherProfile> {
    if (!user) throw new Error('Không thể tải hồ sơ khi chưa đăng nhập.');
    if (__DEV__ && qaState === 'web-preview') {
      return {
        _id: user.id,
        ...mockTeacher,
        email: 'giangvien@example.test',
        zalo: mockTeacher.phone,
        age: 30,
        address: 'Địa chỉ mẫu — chỉ dùng xem giao diện',
        bio: 'Thông tin giới thiệu mẫu để xem trước màn hình.',
        voiceRegion: 'nam',
        status: 'active',
        testScore: 90,
        baseSalaryPerSession: 250000,
        startDate: new Date().toISOString(),
        bankAccount: {
          bankName: 'Ngân hàng mẫu',
          accountNumber: '0000000000',
          accountHolder: mockTeacher.name,
          bankBranch: 'Chi nhánh mẫu',
        },
      };
    }
    if (__DEV__ && qaState) {
      if (qaState === 'error') throw new Error('Mock UI QA error state');
      return {
        _id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        zalo: user.zalo,
        address: user.address,
        specialty: user.course,
      };
    }
    return getTeacherProfile(user);
  },
  async update(user: DemoUser | null | undefined, updates: TeacherProfileUpdate) {
    if (__DEV__ && qaState) throw new Error('Không thể cập nhật hồ sơ thật trong chế độ UI QA.');
    if (!user) throw new Error('Không thể cập nhật hồ sơ khi chưa đăng nhập.');
    return updateTeacherProfile(user, updates);
  },
};

export const evaluationService = {
  async activity(user?: DemoUser | null) {
    if (!user || user.role !== 'student') throw new Error('Không thể tải nhật ký: tài khoản học viên không hợp lệ.');
    if (qaState || user.previewMode || isFreePortalWithoutRealCourse(user)) {
      return readMockList([] as Awaited<ReturnType<typeof getStudentEvaluationActivity>>);
    }
    try {
      return await getStudentEvaluationActivity(user);
    } catch (err) {
      if ((err as { status?: number })?.status === 403) return [];
      throw err;
    }
  },
  async list(user?: DemoUser | null) {
    if (qaState === 'evaluation-not-eligible') {
      return readMockList(mockEvaluations.map((item) => item.public ? { ...item, completedSessions: 4, totalSessions: 12 } : item));
    }
    if (qaState === 'evaluation-eligible') {
      return readMockList(mockEvaluations.map((item) => item.public ? { ...item, completedSessions: 8, totalSessions: 12 } : item));
    }
    if (qaState === 'evaluation-existing') {
      return readMockList(mockEvaluations.map((item) => item.public ? {
        ...item,
        completed: true,
        existingRating: {
          stars: 4.5,
          comment: 'Đánh giá demo đã gửi trước đó.',
          criteria: { teaching: 'effective', voice: 'good', guidance: 'ok', support: 'enthusiastic' },
        },
      } : item));
    }
    if (qaState === 'evaluation-course-ended') {
      return readMockList(mockEvaluations.map((item) => item.public ? {
        ...item,
        completed: true,
        locked: true,
        completedSessions: item.totalSessions,
      } : item));
    }
    if (__DEV__ && qaState) return readMockList(mockEvaluations);
    if (user?.previewMode) return readMockList(mockEvaluations);
    if (!user) throw new Error('Không thể tải đánh giá khi chưa đăng nhập.');
    return getStudentEvaluations(user);
  },
  async submitPrivate(user: DemoUser, evaluation: Parameters<typeof submitPrivateEvaluation>[1], criteria: Record<string, string>, comment: string) {
    if (__DEV__ && qaState) throw new Error('Không thể gửi đánh giá thật trong chế độ UI QA.');
    return submitPrivateEvaluation(user, evaluation, criteria, comment);
  },
  async submitTeacher(user: DemoUser, evaluation: Parameters<typeof submitTeacherRating>[1], criteria: Record<string, string>, stars: number, comment: string) {
    if (__DEV__ && qaState) throw new Error('Không thể gửi đánh giá thật trong chế độ UI QA.');
    return submitTeacherRating(user, evaluation, criteria, stars, comment);
  },
};

export const feedService = {
  async posts() {
    if (qaState === 'feed-empty') return readMockList([]);
    if (qaState === 'feed-multiple') {
      return readMockList(Array.from({ length: 5 }, (_, index) => ({
        ...mockFeedPosts[0],
        id: `qa-feed-${index + 1}`,
        author: index === 0 ? 'Nguyễn Hoàng Nam' : mockFeedPosts[0].author,
        role: index === 0 ? 'Giảng viên' : mockFeedPosts[0].role,
        mediaType: index === 1 ? 'image' as const : undefined,
        comments: index === 2 ? [
          { id: 'qa-comment-1', author: 'Minh Anh', text: 'Bình luận demo.' },
          { id: 'qa-reply-1', author: 'Nguyễn Hoàng Nam', text: 'Phản hồi demo.' },
        ] : mockFeedPosts[0].comments,
      })));
    }
    return readMockList(mockFeedPosts);
  },
  async news(filters: {
    query?: string;
    topicId?: string;
    sort?: 'newest' | 'oldest' | 'views';
    period?: 'today' | 'this_month' | 'last_month' | 'oldest_month';
  } = {}): Promise<DemoNewsItem[]> {
    let rows: DemoNewsItem[] | null = null;
    if (qaState === 'news-empty') return readMockList([]);
    if (qaState === 'news-multiple') {
      rows = Array.from({ length: 12 }, (_, index) => ({
        ...mockNews[0],
        id: `qa-news-${index + 1}`,
        slug: `qa-news-${index + 1}`,
        title: `Tin tức demo ${index + 1}`,
        views: 24 + index,
        author: index % 2 ? 'Giảng viên demo' : 'Trung tâm Thắng Tin Học',
        excerpt: `Tóm tắt nội dung bản tin demo ${index + 1}.`,
        attachments: index === 1
          ? [{ id: 'qa-image', name: 'Anh-minh-hoa.jpg', type: 'image' as const }]
          : index === 2
            ? [{ id: 'qa-video', name: 'Video-gioi-thieu.mp4', type: 'video' as const }]
            : index === 3
              ? [{ id: 'qa-file', name: 'Tai-lieu.pdf', type: 'file' as const }]
              : [],
      }));
    }
    if (!rows && __DEV__ && qaState) rows = mockNews;
    if (!rows) {
      const params = new URLSearchParams({ page: '1', limit: '40' });
      if (filters.query?.trim()) params.set('q', filters.query.trim());
      if (filters.topicId && filters.topicId !== 'all') params.set('topic', filters.topicId);
      if (filters.sort) params.set('sort', filters.sort);
      if (filters.period) params.set('period', filters.period);
      const response = await mobileApiRequest<{ data?: Record<string, unknown>[] }>(`/blog/posts?${params.toString()}`);
      if (!Array.isArray(response.data)) throw new Error('Phản hồi danh sách tin tức không hợp lệ.');
      return response.data.map(mapRealNews);
    }

    const query = filters.query?.trim().toLocaleLowerCase('vi-VN') || '';
    const filtered = rows.filter((item) => (
      (!query || `${item.title} ${item.topic} ${item.excerpt}`.toLocaleLowerCase('vi-VN').includes(query))
      && (!filters.topicId || filters.topicId === 'all' || item.topicId === filters.topicId || item.topic === filters.topicId)
    ));
    if (filters.sort === 'views') filtered.sort((a, b) => b.views - a.views);
    else if (filters.sort === 'oldest') filtered.reverse();
    return readMockList(filtered);
  },
  async newsTopics(): Promise<Array<{ id: string; name: string }>> {
    if (__DEV__ && qaState) {
      return readMockList([...new Map(mockNews.map((item) => [item.topic, { id: item.topicId || item.topic, name: item.topic }])).values()]);
    }
    const response = await mobileApiRequest<{ data?: Array<{ id?: string; name?: string }> }>('/blog/topics');
    if (!Array.isArray(response.data)) throw new Error('Phản hồi danh mục tin tức không hợp lệ.');
    return response.data
      .filter((topic) => typeof topic.id === 'string' && typeof topic.name === 'string')
      .map((topic) => ({ id: topic.id!, name: topic.name! }));
  },
  async newsDetail(newsId: string): Promise<DemoNewsItem> {
    if (!newsId.trim()) throw new Error('Không thể tải tin tức: thiếu mã bài viết.');
    if (__DEV__ && qaState) {
      const fixture = mockNews.find((item) => item.id === newsId || item.slug === newsId);
      if (!fixture) throw new Error('Không tìm thấy tin tức trong dữ liệu xem trước.');
      return fixture;
    }
    const response = await mobileApiRequest<{ data?: Record<string, unknown> }>(
      `/blog/posts/${encodeURIComponent(newsId)}`,
    );
    if (!response.data) throw new Error('Máy chủ không trả về chi tiết tin tức.');
    return mapRealNews(response.data);
  },
  async centerInfo() {
    if (__DEV__ && qaState) {
      await delay();
      if (qaState === 'error') throw new Error('Mock UI QA error state');
      return {
        published: true,
        name: 'Trung tâm Thắng Tin Học',
        logoUrl: '',
        bannerUrl: '',
        intro: '',
        mission: '',
        vision: '',
        coreValues: '',
        foundedYear: '',
        headquartersAddress: '',
        contactPhone: '',
        contactEmail: '',
        website: '',
        detailHtml: '',
        galleryUrls: [],
        introVideoUrl: '',
        sections: [
          { title: 'Nhân sự', items: [] },
          { title: 'Chi nhánh', items: [] },
          { title: 'Mạng xã hội', items: [] },
          { title: 'Dịch vụ đào tạo', items: [] },
          { title: 'Địa điểm thi', items: [] },
          { title: 'Chứng chỉ', items: [] },
        ],
      };
    }
    const response = await mobileApiRequest<Record<string, unknown>>('/center-info');
    return mapCenterInfo(response);
  },
};

export const softwareService = {
  async list(user?: DemoUser | null): Promise<DemoSoftwareLink[]> {
    if (__DEV__ && qaState) return readMockList(mockSoftwareLinks);
    if (user?.previewMode) return readMockList(mockSoftwareLinks);
    const data = await getRoleTrainingData(user);
    if (!Array.isArray(data.softwareLinks)) {
      throw new Error('Phản hồi danh sách phần mềm không hợp lệ.');
    }
    return data.softwareLinks.map((value, index) => {
      const raw = rawRecord(value);
      return {
        id: rawText(raw.id || raw._id) || `software-${index + 1}`,
        name: rawText(raw.name || raw.title) || `Phần mềm ${index + 1}`,
        description: rawText(raw.description || raw.desc),
        category: rawText(raw.category || raw.type) || 'Phần mềm khóa học',
        url: centerLink(raw.url || raw.link),
      };
    });
  },
};

export const quizService = {
  async list(user?: DemoUser | null) {
    if (qaState === 'quiz-empty') return readMockList([]);
    if (qaState === 'quiz-draft') return readMockList([{ ...mockQuizzes[0], id: 'qa-quiz-draft', title: 'Bản nháp trắc nghiệm', submissions: [] }]);
    if (qaState === 'quiz-results') return readMockList(mockQuizzes.map((quiz) => ({ ...quiz, submissions: [...quiz.submissions, { studentName: 'Học viên demo 3', score: 90, status: 'passed' as const }] })));
    if (__DEV__ && qaState) return readMockList(mockQuizzes);
    if (!user || user.role !== 'teacher') {
      throw new Error('Không thể tải bài trắc nghiệm: tài khoản giảng viên không hợp lệ.');
    }
    if (user.previewMode) return readMockList(mockQuizzes);
    return getTeacherQuizzes(user);
  },
  async create(user: DemoUser, input: Parameters<typeof createTeacherQuiz>[1]) {
    if (__DEV__ && qaState) throw new Error('Không thể tạo bài trắc nghiệm thật trong chế độ UI QA.');
    return createTeacherQuiz(user, input);
  },
  async remove(user: DemoUser, quizId: string) {
    if (__DEV__ && qaState) throw new Error('Không thể xóa bài trắc nghiệm thật trong chế độ UI QA.');
    return deleteTeacherQuiz(user, quizId);
  },
  async generateAI(user: DemoUser, input: Parameters<typeof generateTeacherQuizQuestions>[1]) {
    if (__DEV__ && qaState) throw new Error('Không thể gọi AI thật trong chế độ UI QA.');
    return generateTeacherQuizQuestions(user, input);
  },
  async studentList(user?: DemoUser | null) {
    if (!user || user.role !== 'student') throw new Error('Không thể tải bài trắc nghiệm: tài khoản học viên không hợp lệ.');
    if (qaState === 'quiz-empty') return readMockList([]);
    if (qaState || user.previewMode) {
      return readMockList(mockStudentQuizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        courseName: quiz.courseName,
        teacherName: 'Giảng viên',
        timeLimitMinutes: quiz.timeLimitMinutes,
        startTime: quiz.startTime || '',
        deadline: quiz.deadline,
        questionsCount: quiz.questions,
        targetStudentIds: [],
        mySubmission: null,
      })));
    }
    try {
      return await getStudentQuizzes(user);
    } catch (err) {
      if ((err as { status?: number })?.status === 403) return [];
      throw err;
    }
  },
};

export const trainingService = {
  async overview(user?: DemoUser | null): Promise<DemoTeacherTrainingOverview> {
    if (__DEV__ && qaState) {
      const [courses, softwareLinks] = await Promise.all([
        readMockList(mockTrainingCourses),
        readMockList(mockSoftwareLinks),
      ]);
      return { courses, guides: [], files: [], softwareLinks };
    }
    if (!user || user.role !== 'teacher') {
      throw new Error('Không thể tải đào tạo: tài khoản giảng viên không hợp lệ.');
    }
    return getTeacherTrainingOverview(user);
  },
  async list(user?: DemoUser | null): Promise<DemoTrainingCourse[]> {
    if (__DEV__ && qaState) return readMockList(mockTrainingCourses);
    if (!user) throw new Error('Không thể tải đào tạo: tài khoản giảng viên không hợp lệ.');
    return getTeacherTrainingCourses(user);
  },
};

export const financeService = {
  async list() {
    if (qaState === 'finance-empty') return readMockList([]);
    if (qaState === 'finance-populated') {
      return readMockList(Array.from({ length: 8 }, (_, index) => ({
        ...mockFinanceTransactions[index % mockFinanceTransactions.length],
        id: `qa-finance-${index + 1}`,
        amount: 1250000 + index * 175000,
        sessions: 5 + index,
        status: index % 2 ? 'Đã nhận' as const : 'Chưa nhận' as const,
      })));
    }
    return readMockList(mockFinanceTransactions);
  },
};

export const teacherFinanceService = {
  async overview(user: DemoUser | null | undefined): Promise<TeacherFinanceOverview> {
    if (!user) throw new Error('Không thể tải tài chính: tài khoản giảng viên không hợp lệ.');
    if (user.previewMode || (__DEV__ && qaState)) {
      const transactions = await financeService.list();
      const salaryTransaction = transactions.find((transaction) => transaction.sessions > 0);
      const mappedTransactions = transactions.map((transaction) => {
        const [day, month, year] = transaction.date.split('/').map(Number);
        const date = day && month && year
          ? new Date(year, month - 1, day).toISOString()
          : '';
        return {
          id: transaction.id,
          description: transaction.note,
          month: transaction.month,
          amount: transaction.amount,
          status: transaction.status === 'Đã nhận' ? 'confirmed' as const : 'pending' as const,
          createdAt: date,
          confirmedBy: 'Admin',
          note: transaction.note,
          sessions: transaction.sessions,
          starBonusAmount: 0,
          paymentSessionDetails: transaction.studentName
            ? [{
              sessionId: `${transaction.id}-session`,
              studentId: transaction.studentName,
              studentName: transaction.studentName,
              date,
              courseName: '',
              allocatedAmount: transaction.studentAmount ?? transaction.amount,
            }]
            : [],
        };
      });
      return {
        totalSessions: mappedTransactions.reduce((sum, transaction) => sum + transaction.sessions, 0),
        paidAmount: transactions.filter((transaction) => transaction.status === 'Đã nhận').reduce((sum, transaction) => sum + transaction.amount, 0),
        unpaidAmount: transactions.filter((transaction) => transaction.status === 'Chưa nhận').reduce((sum, transaction) => sum + transaction.amount, 0),
        salaryPerSession: salaryTransaction?.amount
          ? Math.round(salaryTransaction.amount / salaryTransaction.sessions)
          : 0,
        pendingSessionsCount: transactions
          .filter((transaction) => transaction.status === 'Chưa nhận')
          .reduce((sum, transaction) => sum + transaction.sessions, 0),
        transactions: mappedTransactions,
        pendingSessions: [],
      };
    }
    return getTeacherFinanceOverview(user);
  },
};
