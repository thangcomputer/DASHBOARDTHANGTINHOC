import type { UserRole } from '../types';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type AppStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Assignments: { assignmentId?: string } | undefined;
  Materials: undefined;
  Students: undefined;
  Attendance: { scheduleId?: string } | undefined;
  Grades: undefined;
  NotificationCenter: undefined;
  Conversation: {
    conversationId: string;
    conversationName?: string;
    participantId?: string;
    participantRole?: string;
    participantAdminRole?: string | null;
    participantOnline?: boolean;
    participantAvatarUri?: string;
    supportStatus?: string;
  };
  CallHistory: undefined;
  Call: {
    callId: string;
    conversationId: string;
    conversationName: string;
    participantId: string;
    participantRole: string;
    participantName: string;
    direction: 'incoming' | 'outgoing';
  };
  MobileMenu: undefined;
  StudentLearning: undefined;
  StudentExam: { quizId?: string } | undefined;
  LearningLesson: { courseId: string; unitId: string; lessonId: string };
  Evaluations: undefined;
  Feed: { postId?: string; commentId?: string; parentCommentId?: string } | undefined;
  News: undefined;
  NewsDetail: { newsId: string };
  CenterInfo: undefined;
  SoftwareLinks: undefined;
  TeacherQuizzes: undefined;
  TeacherTraining: undefined;
  TeacherFinance: undefined;
  Tuition: undefined;
  CertPrepCatalog: undefined;
  CertPrepLevel: { levelId: string; courseName: string };
  CertPrepPlayer: { sessionId: string; testTitle: string };
  CertPrepResult: { sessionId: string; testTitle: string };
  DailyPractice: { topicId?: string; watch?: 'stage'; practice?: 'stage' } | undefined;
};

export type MainTabsParamList = {
  Home: undefined;
  Schedule: { focusScheduleId?: string } | undefined;
  Messages: undefined;
  CourseVideos: {
    resumeKey?: number;
    resumeSubjectId?: string;
    resumeCourseId?: string;
    resumeUnitId?: string;
    resumeSectionId?: string;
  } | undefined;
  Feed: { postId?: string; commentId?: string; parentCommentId?: string } | undefined;
  Support: undefined;
  Notifications: undefined;
  Profile: undefined;
  Students: undefined;
  Finance: undefined;
};

export function getTabItems(role: UserRole) {
  return role === 'student'
    ? ['Schedule', 'Messages', 'Feed', 'Home', 'CourseVideos', 'Support', 'Profile'] as const
    : ['Schedule', 'Messages', 'Feed', 'Home', 'Finance', 'Support', 'Profile'] as const;
}
