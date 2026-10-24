import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Bell, BookOpen, CalendarDays, FileText, GraduationCap, House, MessageCircle,
  UserRound, Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../app/AuthContext';
import { colors, spacing, typography } from '../theme/tokens';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import {
  AssignmentsScreen, AttendanceScreen, GradesScreen, MaterialsScreen,
  NotificationsScreen, ProfileScreen, ScheduleScreen, StudentsScreen,
} from '../screens/FeatureScreens';
import { ConversationScreen, MessagesScreen } from '../screens/MessageScreens';
import {
  CenterInfoScreen, EvaluationsScreen, FeedScreen, LearningLessonScreen, MobileMenuScreen,
  NewsDetailScreen, NewsScreen, SoftwareLinksScreen, StudentExamScreen, StudentLearningScreen, TeacherFinanceScreen,
  TeacherQuizzesScreen, TeacherTrainingScreen, TuitionScreen,
} from '../screens/ParityScreens';
import type { AppStackParamList, MainTabsParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

export function RootNavigator() {
  const { user } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Assignments" component={AssignmentsScreen} />
          <Stack.Screen name="NotificationCenter" component={NotificationsScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="MobileMenu" component={MobileMenuScreen} />
          <Stack.Screen name="Feed" component={FeedScreen} />
          <Stack.Screen name="News" component={NewsScreen} />
          <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
          <Stack.Screen name="CenterInfo" component={CenterInfoScreen} />
          <Stack.Screen name="SoftwareLinks" component={SoftwareLinksScreen} />
          {user?.role === 'student' ? (
            <>
              <Stack.Screen name="Materials" component={MaterialsScreen} />
              <Stack.Screen name="Grades" component={GradesScreen} />
              <Stack.Screen name="StudentLearning" component={StudentLearningScreen} />
              <Stack.Screen name="StudentExam" component={StudentExamScreen} />
              <Stack.Screen name="LearningLesson" component={LearningLessonScreen} />
              <Stack.Screen name="Evaluations" component={EvaluationsScreen} />
              <Stack.Screen name="Tuition" component={TuitionScreen} />
            </>
          ) : null}
          {user?.role === 'teacher' ? (
            <>
              <Stack.Screen name="Students" component={StudentsScreen} />
              <Stack.Screen name="Attendance" component={AttendanceScreen} />
              <Stack.Screen name="TeacherQuizzes" component={TeacherQuizzesScreen} />
              <Stack.Screen name="TeacherTraining" component={TeacherTrainingScreen} />
              <Stack.Screen name="TeacherFinance" component={TeacherFinanceScreen} />
            </>
          ) : null}
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
      )}
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isTeacher = user?.role === 'teacher';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 3 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 56 + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          elevation: 8,
        },
        tabBarIcon: ({ color, size }) => {
          const common = { size: size - 2, color, strokeWidth: 2.2 };
          switch (route.name) {
            case 'Home': return <House {...common} />;
            case 'Schedule': return <CalendarDays {...common} />;
            case 'Messages': return <MessageCircle {...common} />;
            case 'Notifications': return <Bell {...common} />;
            case 'Profile': return <UserRound {...common} />;
            case 'Students': return <Users {...common} />;
            default: return <GraduationCap {...common} />;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: isTeacher ? 'Tổng quan' : 'Học tập' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: isTeacher ? 'Lịch dạy' : 'Lịch học' }} />
      {isTeacher
        ? <Tab.Screen name="Students" component={StudentsScreen} options={{ title: 'Học viên' }} />
        : <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Tin nhắn' }} />}
      {isTeacher
        ? <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Hộp thư' }} />
        : <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Thông báo' }} />}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: isTeacher ? 'Hồ sơ' : 'Cá nhân' }} />
      {isTeacher ? (
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: 'Thông báo', tabBarButton: () => null }}
        />
      ) : null}
    </Tab.Navigator>
  );
}
