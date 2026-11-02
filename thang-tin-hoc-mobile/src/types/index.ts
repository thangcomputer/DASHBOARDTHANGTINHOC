export type UserRole = 'student' | 'teacher';

export type DemoUser = {
  id: string;
  previewMode?: boolean;
  name: string;
  role: UserRole;
  phone: string;
  adminRole?: string | null;
  code: string;
  course: string;
  branch: string;
  avatarColor: string;
  avatar?: string;
  teacherName?: string;
  teacherRating?: number;
  completedSessions?: number;
  totalSessions?: number;
  avgGrade?: number;
  email?: string;
  address?: string;
  zalo?: string;
  enrollmentStatus?: 'active' | 'completed' | 'cancelled';
  paid?: boolean;
  enrollments?: DemoEnrollment[];
  videoOrders?: DemoVideoOrder[];
};

export type DemoEnrollment = {
  id: string;
  courseId?: string;
  courseName: string;
  subjectIds?: string[];
  teacherName?: string;
  registeredAt?: string;
  progress?: number;
  completedSessions?: number;
  totalSessions?: number;
  avgGrade?: number;
  status: 'Đang học' | 'Hoàn thành' | 'Thôi học';
  notes?: string;
  tuitionAmount?: number;
  paidAmount?: number;
};

export type DemoVideoOrder = {
  id: string;
  courseName: string;
  amount: number;
  status: 'Đã thanh toán' | 'Chờ thanh toán';
  date: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  subject: string;
  person: string;
  dateLabel: string;
  time: string;
  location: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  date?: string;
  courseName?: string;
  teacherId?: string;
  teacherName?: string;
  studentName?: string;
  studentId?: string;
  enrollmentId?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
  studentNote?: string;
  attendanceStatus?: 'pending' | 'present' | 'absent' | 'late' | 'excused';
  learningMode?: 'Trực tiếp' | 'Trực tuyến';
  meetingUrl?: string;
  confirmedByStudent?: boolean;
  attendanceConfirmPending?: boolean;
  attendanceConfirmStatus?: string;
  attendanceDisputed?: boolean;
  attendanceRejected?: boolean;
  confirmedByTeacher?: boolean;
  grade?: number | null;
  attendanceSessionNumber?: number | string | null;
  attendanceTotalSessions?: number | string | null;
  weekday?: string;
  color: string;
};

export type Assignment = {
  id: string;
  title: string;
  subject: string;
  courseName?: string;
  teacher: string;
  deadline: string;
  status: 'Chưa làm' | 'Đã nộp' | 'Quá hạn' | 'Cần chấm' | 'Đã chấm';
  description?: string;
  attachedFileUrl?: string;
  attachedFileName?: string;
  assignedStudentNames?: string[];
  submissions?: AssignmentSubmission[];
  mySubmission?: {
    submittedAt: string;
    status: 'submitted' | 'graded';
    grade?: number;
    forfeit?: boolean;
    gradeHistory: Array<{
      at: string;
      oldGrade?: number;
      newGrade?: number;
      note?: string;
    }>;
  };
  grade?: number;
  teacherFeedback?: string;
};

export type AssignmentSubmission = {
  id: string;
  studentName: string;
  submittedAt: string;
  status: 'submitted' | 'graded';
  submittedFileUrl: string;
  grade?: number;
  teacherFeedback?: string;
};

export type LearningMaterial = {
  id: string;
  title: string;
  subject: string;
  courseId?: string;
  courseName?: string;
  subjectIds?: string[];
  type: 'PDF' | 'WORD' | 'EXCEL' | 'VIDEO' | 'LINK';
  date: string;
  size: string;
  url?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  category: string;
  type?: string;
  targetPath?: string;
  payload?: Record<string, string | number | boolean | undefined>;
  unread: boolean;
};

export type Conversation = {
  id: string;
  name: string;
  role: string;
  participantId?: string;
  participantRole?: string;
  avatar?: string;
  avatarUri?: string;
  phone?: string;
  zalo?: string;
  lastActivityAt?: number;
  category?: 'student' | 'teacher' | 'recruitment' | 'admin' | 'support' | 'group';
  adminRole?: string | null;
  roleBadge?: string;
  online?: boolean;
  lastMessage: string;
  time: string;
  unread: number;
  color: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  time: string;
  mine: boolean;
  messageType?: string;
  timestampMs?: number;
  callEvent?: {
    direction: 'incoming' | 'outgoing';
    status: 'ringing' | 'active' | 'missed' | 'rejected' | 'completed' | 'busy' | 'cancelled' | 'failed';
    durationSeconds: number;
    participantName: string;
  };
  senderName?: string;
  state?: 'sent' | 'delivered' | 'read';
  sticker?: string;
  stickerId?: string;
  reaction?: string;
  reactions?: Array<{ type: string; userId: string; userName?: string }>;
  recalled?: boolean;
  recipientRejected?: boolean;
  pinned?: boolean;
  attachmentName?: string;
  attachmentType?: 'image' | 'file' | 'gif';
  attachmentUrl?: string;
  gifLabel?: string;
  replyToText?: string;
  replyTo?: { id: string; content: string; messageType?: string };
};

export type DemoStudent = {
  id: string;
  name: string;
  course: string;
  courses?: string[];
  progress: number;
  lastClass: string;
  status: 'Đang học' | 'Cần hỗ trợ' | 'Hoàn thành' | 'Thôi học';
  color: string;
  avatar?: string;
  phone?: string;
  zalo?: string;
  lastSeenAt?: string;
  enrollments?: DemoEnrollment[];
  enrollmentStatus?: 'active' | 'completed' | 'cancelled';
  notes?: string;
  linkHoc?: string;
  avgGrade?: number;
  studentExamUnlocked?: boolean;
  totalSessions?: number;
  completedSessions?: number;
  remainingSessions?: number;
  attendance?: Array<{ date: string; course: string; status: string }>;
  assignments?: Assignment[];
};

export type LearningCourse = {
  _id: string;
  title: string;
  subject: string;
  description: string;
  software: string;
  progress: number;
  units: LearningUnit[];
  enrolled?: boolean;
  deliveryMode?: 'instructor' | 'video';
  totalSessions?: number;
  price?: number;
};

export type LearningUnit = {
  _id: string;
  title: string;
  sections: LearningLesson[];
};

export type LearningLesson = {
  _id: string;
  title: string;
  duration: string;
  progress: number;
  completed: boolean;
  locked: boolean;
};

export type DemoEvaluation = {
  id: string;
  courseName: string;
  teacherName: string;
  milestone: 'manual_feedback' | 'course_end_teacher' | 'course_end_admin' | 'teacher_rating';
  completed: boolean;
  public: boolean;
  criteria: string[];
  teacherId?: string;
  courseId?: string;
  comment?: string;
  completedSessions: number;
  totalSessions: number;
  existingRating?: {
    stars: number;
    comment?: string;
    criteria?: Record<string, string>;
  };
  locked?: boolean;
};

export type DemoFeedPost = {
  id: string;
  author: string;
  role: string;
  time: string;
  content: string;
  mediaType?: 'image' | 'video';
  images?: string[];
  audience: string;
  comments: Array<{
    id: string;
    author: string;
    text: string;
    authorId?: string;
    authorAdminRole?: string | null;
    avatar?: string;
    role?: string;
    time?: string;
  }>;
  commentsCount?: number;
  reactionCount: number;
  reactions?: Record<'heart' | 'like' | 'haha' | 'wow' | 'sad', number>;
  myReaction?: 'heart' | 'like' | 'haha' | 'wow' | 'sad' | null;
  authorId?: string;
  authorAdminRole?: string | null;
  authorAvatar?: string;
  replies?: Array<{
    id: string;
    parentId: string;
    author: string;
    text: string;
    authorId?: string;
    avatar?: string;
    role?: string;
    time?: string;
  }>;
};

export type DemoNewsAttachment = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'file' | 'link';
  url?: string;
};

export type DemoNewsItem = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  publishedAt: string;
  excerpt: string;
  content: string;
  views: number;
  attachments: DemoNewsAttachment[];
  author?: string;
  thumbnailUrl?: string;
  contentHtml?: string;
  topicId?: string;
  targetAudience?: 'all' | 'teacher' | 'student';
  isNew?: boolean;
};

export type DemoGradeRecord = {
  id: string;
  courseName: string;
  assessment: string;
  score: string;
  status: 'Đạt' | 'Chưa đạt' | 'Hoàn thành' | 'Đang học';
  date?: string;
  feedback?: string;
  qaFixture?: boolean;
};

export type DemoSoftwareLink = {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
};

export type DemoQuiz = {
  id: string;
  title: string;
  courseName: string;
  timeLimitMinutes: number;
  startTime?: string;
  deadline: string;
  questions: number;
  studentCount?: number;
  targetStudentIds?: string[];
  assignedStudentNames?: string[];
  sampleQuestions?: Array<{ text: string; options: string[]; correctOption: number }>;
  submissions: Array<{
    studentName: string;
    studentPhone?: string;
    submittedAt?: string;
    score: number;
    correctCount?: number;
    totalQuestions?: number;
    status: 'passed' | 'failed' | 'submitted';
    forfeit?: boolean;
    exitReason?: string;
  }>;
};

export type DemoTrainingCourse = {
  id: string;
  title: string;
  progress: number;
  lessons: Array<{ id: string; title: string; duration: string; completed: boolean; url?: string; watchedSeconds?: number; antiSeek?: boolean }>;
  files: string[];
  fileLinks?: Array<{ title: string; url: string; type: string; size: string }>;
  notices: string[];
};

export type DemoFinanceTransaction = {
  id: string;
  month: string;
  date: string;
  amount: number;
  sessions: number;
  status: 'Đã nhận' | 'Chưa nhận';
  note: string;
  studentName?: string;
  studentAmount?: number;
};
