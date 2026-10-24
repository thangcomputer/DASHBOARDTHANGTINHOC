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
  mockConversations,
  mockMessages,
  mockMaterials,
  mockNotifications,
  mockSchedule,
  mockTeacherSchedule,
  mockStudent,
  mockStudentProfileQaEnrollments,
  mockStudentProfileQaVideoOrders,
  mockTeacher,
  mockTeacherAssignments,
  mockTeacherConversations,
  mockTeacherNotifications,
  mockTeacherStudents,
  mockTeacherThreads,
} from '../mocks/data';
import type { DemoUser, ScheduleItem, UserRole } from '../types';

const qaState = __DEV__ ? process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE : undefined;
const mobileScheduleApiEnabled = String(process.env.EXPO_PUBLIC_MOBILE_SCHEDULE_API || '').toLowerCase() === 'true';
const mobileNotificationsApiEnabled = String(process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API || '').toLowerCase() === 'true';
const delay = (duration = qaState === 'loading' ? 3000 : 280) => new Promise((resolve) => setTimeout(resolve, duration));

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

function mapRealScheduleRow(raw: Record<string, any>, role: UserRole): ScheduleItem {
  const id = String(raw?._id || raw?.id || `${raw?.date || Date.now()}-${raw?.course || raw?.teacherName || role}`);
  const course = String(raw?.course || raw?.subject || raw?.title || 'Buổi học').trim() || 'Buổi học';
  const dateValue = raw?.date ? new Date(raw.date) : null;
  const dateKey = dateValue && !Number.isNaN(dateValue.getTime())
    ? `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`
    : raw?.date || undefined;
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
    teacherName,
    studentName,
    studentId: raw?.studentId && typeof raw.studentId === 'object' ? String(raw.studentId._id || raw.studentId.id || '') : String(raw?.studentId || ''),
    note: String(raw?.note || raw?.studentNote || '').trim(),
    attendanceStatus,
    learningMode: raw?.linkHoc ? 'Trực tuyến' : 'Trực tiếp',
    meetingUrl: String(raw?.linkHoc || raw?.meetingUrl || '').trim(),
    confirmedByStudent: ['accepted', 'pending', 'admin_approved'].includes(String(raw?.studentConfirmStatus || '')),
    confirmedByTeacher: String(raw?.status || '') === 'completed' || String(raw?.studentConfirmStatus || '') === 'admin_approved',
    grade: raw?.attendancePendingGrade ?? null,
    color: '#3B82F6',
  };
}

async function readRealScheduleList(role: UserRole): Promise<ScheduleItem[]> {
  const baseUrl = String(process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
  const envStudentId = String(process.env.EXPO_PUBLIC_MOBILE_STUDENT_ID || '').trim();
  const envTeacherId = String(process.env.EXPO_PUBLIC_MOBILE_TEACHER_ID || '').trim();
  const userId = role === 'teacher' ? envTeacherId : envStudentId;

  if (!userId) {
    return [];
  }

  const query = new URLSearchParams({
    ...(role === 'teacher' ? { teacherId: userId } : { studentId: userId }),
  });

  const response = await fetch(`${baseUrl}/api/schedules?${query.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
            Authorization: 'Bearer ' + String(process.env.EXPO_PUBLIC_MOBILE_API_TOKEN || '').trim(),
    },
  });

  if (!response.ok) {
    throw new Error(`Schedule API error (${response.status})`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return rows.map((row: Record<string, any>) => mapRealScheduleRow(row, role));
}

async function readMockList<T>(items: T[]): Promise<T[]> {
  await delay();
  if (qaState === 'error') throw new Error('Mock UI QA error state');
  return qaState === 'empty' ? [] : items;
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
  async signIn(role: UserRole, phone: string, password: string) {
    await delay(280);
    if (!phone.trim() || !password.trim()) throw new Error('Vui lòng nhập số điện thoại và mật khẩu.');
    return role === 'student' ? mockStudent : mockTeacher;
  },
};

export const scheduleService = {
  async list(role: UserRole = 'student') {
    if (mobileScheduleApiEnabled) {
      try {
        const realItems = await readRealScheduleList(role);
        if (realItems.length) return realItems;
      } catch (error) {
        console.warn('[mobile:schedule] backend fallback to mock:', error);
      }
    }

    if (role === 'teacher' && ['attendance-overdue', 'attendance-pending'].includes(qaState || '')) {
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
    return readMockList(role === 'teacher' ? mockTeacherSchedule : mockSchedule);
  },
};

export const assignmentService = {
  async list(role: UserRole = 'student') {
    if (role === 'student' && qaState === 'assignment-submitted') {
      return readMockList(mockAssignments.map((item) => item.id === 'task-1' ? { ...item, status: 'Đã nộp' as const } : item));
    }
    if (role === 'student' && qaState === 'assignment-graded') {
      return readMockList(mockAssignments.map((item) => item.id === 'task-1' ? { ...item, status: 'Đã chấm' as const, grade: 8.5, teacherFeedback: 'Bài làm demo đã được nhận xét.' } : item));
    }
    return readMockList(role === 'teacher' ? mockTeacherAssignments : mockAssignments);
  },
};

export const materialService = {
  async list() { return readMockList(mockMaterials); },
};

export const notificationService = {
  async list(role: UserRole = 'student') {
    if (mobileNotificationsApiEnabled) {
      throw new Error('Notifications REST is disabled until the authenticated mobile API client is available.');
    }

    if (qaState === 'notification-25-items') {
      const source = role === 'teacher' ? mockTeacherNotifications : mockNotifications;
      const fixture = Array.from({ length: 25 }, (_, index) => {
        const item = source[index % source.length];
        return { ...item, id: `qa-notice-${index + 1}`, title: `${item.title} · ${index + 1}`, unread: index % 2 === 0 };
      });
      return readMockList(fixture);
    }
    return readMockList(role === 'teacher' ? mockTeacherNotifications : mockNotifications);
  },
};

export const messageService = {
  async conversations(role: UserRole = 'student') {
    if (qaState === 'chat-empty') return readMockList([]);
    if (role === 'teacher' && qaState === 'chat-group') return readMockList(mockTeacherConversations.filter((item) => item.category === 'group'));
    if (role === 'teacher' && qaState === 'chat-unread') return readMockList(mockTeacherConversations.filter((item) => item.unread > 0));
    return readMockList(role === 'teacher' ? mockTeacherConversations : mockConversations);
  },
  async thread(conversationId = 'chat-1', role: UserRole = 'student') {
    if (qaState === 'chat-empty') return readMockList([]);
    return readMockList(role === 'teacher' ? mockTeacherThreads[conversationId] || [] : mockMessages);
  },
};

export const studentService = {
  async assigned() { return readMockList(mockTeacherStudents); },
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
  async list() {
    if (qaState === 'grades-no-grade') return readMockList([]);
    if (qaState === 'grades-completed') {
      return readMockList(mockGradeQaFixtureRecords.map((record) => ({ ...record, status: 'Hoàn thành' as const, qaFixture: true })));
    }
    return readMockList([]);
  },
};

export const studentProfileService = {
  async get(user: DemoUser | null | undefined) {
    await delay();
    if (qaState === 'error') throw new Error('Mock UI QA error state');
    const qaFixture = qaState === 'student-profile-populated';
    return {
      enrollments: qaFixture ? mockStudentProfileQaEnrollments : user?.enrollments || [],
      videoOrders: qaFixture ? mockStudentProfileQaVideoOrders : user?.videoOrders || [],
      qaFixture,
    };
  },
};

export const evaluationService = {
  async list() {
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
    return readMockList(mockEvaluations);
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
  async news() {
    if (qaState === 'news-empty') return readMockList([]);
    if (qaState === 'news-multiple') {
      return readMockList(Array.from({ length: 12 }, (_, index) => ({
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
      })));
    }
    return readMockList(mockNews);
  },
  async centerInfo() {
    await delay();
    if (qaState === 'error') throw new Error('Mock UI QA error state');
    return {
      name: 'Trung tâm Thắng Tin Học',
      intro: '',
      mission: '',
      vision: '',
      coreValues: '',
      headquartersAddress: '',
      contactPhone: '',
      contactEmail: '',
      website: '',
      sections: [
        { title: 'Tổng quan' },
        { title: 'Nhân sự' },
        { title: 'Chi nhánh' },
        { title: 'Mạng xã hội' },
        { title: 'Dịch vụ đào tạo' },
        { title: 'Địa điểm thi' },
        { title: 'Chứng chỉ' },
      ],
    };
  },
};

export const softwareService = {
  async list() { return readMockList(mockSoftwareLinks); },
};

export const quizService = {
  async list() {
    if (qaState === 'quiz-empty') return readMockList([]);
    if (qaState === 'quiz-draft') return readMockList([{ ...mockQuizzes[0], id: 'qa-quiz-draft', title: 'Bản nháp trắc nghiệm', submissions: [] }]);
    if (qaState === 'quiz-results') return readMockList(mockQuizzes.map((quiz) => ({ ...quiz, submissions: [...quiz.submissions, { studentName: 'Học viên demo 3', score: 90, status: 'passed' as const }] })));
    return readMockList(mockQuizzes);
  },
  async studentList() { return readMockList(mockStudentQuizzes); },
};

export const trainingService = {
  async list() { return readMockList(mockTrainingCourses); },
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
