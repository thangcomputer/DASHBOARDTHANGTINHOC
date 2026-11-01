import type { UserRole } from '../types';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type AppStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Assignments: undefined;
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
    participantOnline?: boolean;
    participantAvatarUri?: string;
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
  StudentExam: undefined;
  LearningLesson: { courseId: string; unitId: string; lessonId: string };
  Evaluations: undefined;
  Feed: undefined;
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
  LessonPracticeCatalog: undefined;
  LessonPracticeUnits: { subjectId: string; subjectName: string; courseName?: string };
  LessonPracticePlayer: { unitId: string; unitTitle: string; subjectName?: string; courseName?: string };
};

export type MainTabsParamList = {
  Home: undefined;
  Schedule: undefined;
  Messages: undefined;
  CourseVideos: undefined;
  Feed: undefined;
  Notifications: undefined;
  Profile: undefined;
  Students: undefined;
};

export function getTabItems(role: UserRole) {
  return role === 'student'
    ? ['Schedule', 'Messages', 'CourseVideos', 'Home', 'Feed', 'Profile'] as const
    : ['Home', 'Schedule', 'Students', 'Messages', 'Profile'] as const;
}
