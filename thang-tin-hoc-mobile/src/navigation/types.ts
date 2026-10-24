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
  Conversation: { conversationId: string; conversationName?: string };
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
};

export type MainTabsParamList = {
  Home: undefined;
  Schedule: undefined;
  Messages: undefined;
  Notifications: undefined;
  Profile: undefined;
  Students: undefined;
};

export function getTabItems(role: UserRole) {
  return role === 'student'
    ? ['Home', 'Schedule', 'Messages', 'Notifications', 'Profile'] as const
    : ['Home', 'Schedule', 'Students', 'Messages', 'Profile'] as const;
}
