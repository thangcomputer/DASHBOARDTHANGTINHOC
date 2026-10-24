export type UserRole = 'student' | 'teacher';

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  code: string;
  course: string;
  branch: string;
  avatarColor: string;
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
  teacherName?: string;
  studentName?: string;
  studentId?: string;
  note?: string;
  attendanceStatus?: 'pending' | 'present' | 'absent' | 'late' | 'excused';
  learningMode?: 'Trực tiếp' | 'Trực tuyến';
  meetingUrl?: string;
  confirmedByStudent?: boolean;
  confirmedByTeacher?: boolean;
  grade?: number | null;
  color: string;
};

export type Assignment = {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  deadline: string;
  status: 'Chưa làm' | 'Đã nộp' | 'Quá hạn' | 'Cần chấm' | 'Đã chấm';
  description?: string;
  attachedFileUrl?: string;
  assignedStudentNames?: string[];
  submissions?: AssignmentSubmission[];
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
  type: 'PDF' | 'WORD' | 'EXCEL' | 'VIDEO' | 'LINK';
  date: string;
  size: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'Lịch học' | 'Bài tập' | 'Trung tâm' | 'Tin nhắn' | 'Học phí';
  unread: boolean;
};

export type Conversation = {
  id: string;
  name: string;
  role: string;
  category?: 'student' | 'teacher' | 'recruitment' | 'admin' | 'support' | 'group';
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
  senderName?: string;
  state?: 'sent' | 'delivered' | 'read';
  sticker?: string;
  reaction?: string;
  recalled?: boolean;
  attachmentName?: string;
  replyToText?: string;
};

export type DemoStudent = {
  id: string;
  name: string;
  course: string;
  progress: number;
  lastClass: string;
  status: 'Đang học' | 'Cần hỗ trợ' | 'Hoàn thành' | 'Thôi học';
  color: string;
  phone?: string;
  enrollmentStatus?: 'active' | 'completed' | 'cancelled';
  notes?: string;
  avgGrade?: number;
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
  milestone: 'manual_feedback' | 'course_end_teacher' | 'course_end_admin';
  completed: boolean;
  public: boolean;
  criteria: string[];
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
  audience: string;
  comments: Array<{ id: string; author: string; text: string }>;
  reactionCount: number;
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
  attachments: string[];
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
  assignedStudentNames?: string[];
  sampleQuestions?: Array<{ text: string; options: string[]; correctOption: number }>;
  submissions: Array<{ studentName: string; score: number; status: 'passed' | 'submitted' }>;
};

export type DemoTrainingCourse = {
  id: string;
  title: string;
  progress: number;
  lessons: Array<{ id: string; title: string; duration: string; completed: boolean }>;
  files: string[];
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
