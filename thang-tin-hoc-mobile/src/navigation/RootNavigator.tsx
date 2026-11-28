import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, DeviceEventEmitter, Image, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { PlatformPressable } from '@react-navigation/elements';
import { BlurView } from 'expo-blur';
import {
  addMobileNotificationReceivedListener,
  addMobileNotificationResponseReceivedListener,
  cancelScheduledRemindersForSchedule,
  clearMobileLastNotificationResponseAsync,
  getMobileLastNotificationResponseAsync,
  MOBILE_NOTIFICATION_ACTIONS,
  setMobileBadgeCount,
  type MobileNotificationResponse,
} from '../services/mobilePushNotifications';
import { openDeepLinkInApp } from './linking';
import {
  BookOpen, Building2, CalendarDays, CheckSquare, FileBox, FileText, Gamepad2, GraduationCap,
  DollarSign, Headphones, House, Layers, LayoutDashboard, Lock, LogOut, Menu, MessageCircle, Minimize2, Newspaper, Phone, PhoneOff, Radio, Sparkles, Star, Target, UserRound, Users, Volume2, VolumeX, WalletCards, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../app/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { translateText } from '../../../shared/i18n/translate.mjs';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { QuickAiPopupModal } from '../components/QuickAiPopupModal';
import { emit, SOCKET_EVENTS } from '../services/socketService';
import { colors, droplet, radius, spacing, typography } from '../theme/tokens';
import { getMobileSoundEnabled, setMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { useMobileFocusMode, setMobileFocusMode } from '../utils/focusMode';
import { useMobilePracticeSessionActive, setMobilePracticeSessionActive } from '../utils/practiceSessionMode';
import { triggerMobileHaptic } from '../components/dailyPractice/useGameSounds';
import { getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { messageService, notificationService, scheduleService, teacherFinanceService } from '../services/mockService';
import { LoginScreen } from '../screens/LoginScreen';
import { EditableMobileAvatar } from '../components/EditableMobileAvatar';
import { SubscriptionExpiredScreen, SubscriptionStatusCard } from '../components/subscription/SubscriptionRenew';
import { hasFeedPostAccess, hasMeetAccessClient } from '../services/subscriptionApi';
import { HomeScreen } from '../screens/HomeScreen';
import { CallScreen } from '../screens/CallScreen';
import { CallHistoryScreen } from '../screens/CallHistoryScreen';
import {
  AssignmentsScreen, AttendanceScreen, GradesScreen, MaterialsScreen, StudentResourcesScreen,
  NotificationsScreen, ProfileScreen, ScheduleScreen, StudentsScreen,
} from '../screens/FeatureScreens';
import { ConversationScreen, MessagesScreen } from '../screens/MessageScreens';
import {
  CenterInfoScreen, EvaluationsScreen, FeedScreen, LearningLessonScreen, MobileMenuScreen,
  NewsDetailScreen, NewsScreen, SoftwareLinksScreen, StudentExamScreen, StudentLearningScreen,
  TeacherQuizzesScreen, TeacherTrainingScreen, TuitionScreen,
} from '../screens/ParityScreens';
import { TeacherFinanceScreen } from '../screens/TeacherFinanceScreen';
import { SupportEntryScreen } from '../screens/SupportEntryScreen';
import { LegalDocumentScreen } from '../screens/LegalDocumentScreen';
import {
  CertPrepCatalogScreen, CertPrepLevelScreen, CertPrepPlayerScreen, CertPrepResultScreen,
} from '../screens/CertPrepScreens';
import { DailyPracticeScreen } from '../screens/DailyPracticeScreen';
import { StudentCoursesScreen } from '../screens/StudentCoursesScreen';
import { OfflineBanner } from '../components/OfflineBanner';
import { ForcePasswordResetModal } from '../components/ForcePasswordResetModal';
import { MobileSoundEffects } from '../components/MobileSoundEffects';
import { MeetStartAlert } from '../components/MeetStartAlert';
import { PinLockGate } from '../components/pinLock/PinLockGate';
import { TeacherPaymentNoticeModal } from '../components/TeacherPaymentNoticeModal';
import { LearningGoalHost } from '../components/LearningGoalModal';
import { FreeFeatureLockModal, FreeSurveyModal, isFreePortalLocked, isFreePortalMenu } from '../components/FreePortalModals';
import { KineticDotsLoader } from '../components/KineticDotsLoader';
import { MobilePopupBanner } from '../components/MobilePopupBanner';
import { StreakHonorPopup } from '../components/StreakHonorPopup';
import { noteStudyActivity } from '../services/studyActivity';
import { notePinActivity, pinUserKey } from '../services/pinLock';
import { MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, MOBILE_OPEN_MENU_EVENT, animateChrome } from '../components/ui';
import type { AppStackParamList, MainTabsParamList } from './types';
import { navigationRef } from './navigationRef';
import { BackHandler, Easing } from 'react-native';
import type { DemoUser } from '../types';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();
const MOBILE_OPEN_FREE_LOCK_MODAL_EVENT = 'mobile:open-free-lock-modal';
const FREE_LOCKED_DESTINATIONS = new Set<string>(['Messages', 'Feed', 'Assignments', 'Materials', 'StudentExam', 'Support']);

function noteUserActivity() {
  notePinActivity();
  noteStudyActivity();
}

const TAB_ICON_TONES: Record<string, string> = {
  Schedule: '#2563EB',
  Messages: '#7C3AED',
  Feed: '#D97706',
  Home: '#059669',
  Finance: '#059669',
  CourseVideos: '#0891B2',
  DailyPractice: '#059669',
  Support: '#0891B2',
  Profile: '#4F46E5',
};

const TAB_ICONS: Record<string, LucideIcon> = {
  Home: House,
  Schedule: CalendarDays,
  Messages: MessageCircle,
  Feed: Newspaper,
  DailyPractice: Gamepad2,
  Support: Headphones,
  CourseVideos: BookOpen,
  Finance: DollarSign,
  Profile: UserRound,
  Students: Users,
};

/** Nhãn thanh dưới, khớp mobileLabel || label trong client/src/components/AppSidebar.jsx. */
const NAV_TAB_LABELS: Record<'student' | 'teacher', Record<string, string>> = {
  student: {
    Schedule: 'Lịch học',
    Messages: 'Hộp thư',
    Feed: 'Bảng tin',
    Home: 'Tổng quan',
    DailyPractice: 'Luyện tập',
    Support: 'Hỗ trợ',
    CourseVideos: 'Luyện tập tự do',
    Profile: 'Hồ sơ',
  },
  teacher: {
    Schedule: 'Lịch',
    Messages: 'Tin nhắn',
    Feed: 'Bảng tin',
    Home: 'Tổng quan',
    Finance: 'Tài chính',
    DailyPractice: 'Luyện tập',
    Support: 'Hỗ trợ',
    Profile: 'Hồ sơ',
  },
};

function navTabLabel(name: string, isTeacher: boolean, lang: 'vi' | 'en' = 'vi') {
  const raw = NAV_TAB_LABELS[isTeacher ? 'teacher' : 'student'][name] || name;
  return translateText(raw, lang);
}

type IncomingCallPrompt = {
  callId: string;
  conversationId: string;
  callerId: string;
  callerRole: string;
  callerName: string;
};

const FreeLockOverlayHost = React.memo(function FreeLockOverlayHost({
  freeLocked,
  onUnlocked,
}: {
  freeLocked: boolean;
  onUnlocked: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!freeLocked) setVisible(false);
  }, [freeLocked]);

  useEffect(() => {
    const lockSub = DeviceEventEmitter.addListener(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT, () => setVisible(true));
    return () => lockSub.remove();
  }, []);

  if (!visible) return null;
  return (
    <FreeFeatureLockModal
      visible
      onClose={() => setVisible(false)}
      onUnlocked={onUnlocked}
    />
  );
});

const NotificationOverlayHost = React.memo(function NotificationOverlayHost() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:open-notifications', () => setVisible(true));
    return () => subscription.remove();
  }, []);

  if (!visible) return null;
  return (
    <NotificationsScreen
      overlay
      onClose={() => setVisible(false)}
    />
  );
});

const QuickAiOverlayHost = React.memo(function QuickAiOverlayHost({
  user,
}: {
  user: DemoUser;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:open-search', () => setVisible(true));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!visible) return null;
    return (
    <QuickAiPopupModal
      role={user.role}
      freeMenu={isFreePortalMenu(user)}
      onClose={() => setVisible(false)}
    />
  );
});

const MainStackScreens = React.memo(function MainStackScreens({ isStudent }: { isStudent: boolean }) {
  return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Assignments" component={isStudent ? StudentResourcesScreen : AssignmentsScreen} />
          <Stack.Screen name="NotificationCenter" component={NotificationsScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
        <Stack.Screen name="Call" component={CallScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="MobileMenu" component={MobileMenuScreen} />
          <Stack.Screen name="Feed" component={FeedScreen} />
          <Stack.Screen name="News" component={NewsScreen} />
          <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
          <Stack.Screen name="CenterInfo" component={CenterInfoScreen} />
          <Stack.Screen name="SoftwareLinks" component={SoftwareLinksScreen} />
          <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
        {isStudent ? (
            <>
            <Stack.Screen name="CourseVideos" component={DailyPracticeScreen} />
              <Stack.Screen name="Materials" component={MaterialsScreen} />
              <Stack.Screen name="Grades" component={GradesScreen} />
              <Stack.Screen name="StudentLearning" component={StudentLearningScreen} />
              <Stack.Screen name="StudentExam" component={StudentExamScreen} />
              <Stack.Screen name="LearningLesson" component={LearningLessonScreen} />
              <Stack.Screen name="Evaluations" component={EvaluationsScreen} />
              <Stack.Screen name="Tuition" component={TuitionScreen} />
            <Stack.Screen name="CertPrepCatalog" component={CertPrepCatalogScreen} />
            <Stack.Screen name="StudentCourses" component={StudentCoursesScreen} />
            <Stack.Screen name="CertPrepLevel" component={CertPrepLevelScreen} />
            <Stack.Screen name="CertPrepPlayer" component={CertPrepPlayerScreen} />
            <Stack.Screen name="CertPrepResult" component={CertPrepResultScreen} />
            <Stack.Screen name="DailyPractice" component={DailyPracticeScreen} />
            <Stack.Screen name="Support" component={SupportEntryScreen} />
            </>
          ) : null}
        {!isStudent ? (
            <>
              <Stack.Screen name="Students" component={StudentsScreen} />
              <Stack.Screen name="Attendance" component={AttendanceScreen} />
              <Stack.Screen name="TeacherQuizzes" component={TeacherQuizzesScreen} />
              <Stack.Screen name="TeacherTraining" component={TeacherTrainingScreen} />
              <Stack.Screen name="TeacherFinance" component={TeacherFinanceScreen} />
            </>
          ) : null}
        </>
      </Stack.Navigator>
  );
});

export function RootNavigator() {
  const { user, isRestoringSession, signOut, subscription, refreshUser, refreshSubscription, markPasswordChanged } = useAuth();
  const insets = useSafeAreaInsets();
  const { focusMode } = useMobileFocusMode();
  const practiceSessionActive = useMobilePracticeSessionActive();
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const unreadNotificationCountRef = useRef(0);
  const unreadConversationCountRef = useRef(0);
  const handledReadNotificationIds = useRef(new Set<string>());
  const [incomingCall, setIncomingCall] = useState<IncomingCallPrompt | null>(null);
  const [pendingPushResponse, setPendingPushResponse] = useState<MobileNotificationResponse | null>(null);
  const handledPushResponses = useRef(new Set<string>());
  const [examRoomActive, setExamRoomActive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [todayScheduleCount, setTodayScheduleCount] = useState(0);
  const [stackRouteName, setStackRouteName] = useState<string | undefined>(() => {
    if (!navigationRef.isReady()) return undefined;
    const state = navigationRef.getRootState();
    return state?.routes[state.index ?? 0]?.name;
  });
  const syncMobileAppBadge = useCallback(() => {
    const total = Math.max(0, unreadNotificationCountRef.current)
      + Math.max(0, unreadConversationCountRef.current);
    void setMobileBadgeCount(total);
  }, []);
  useEffect(() => {
    unreadConversationCountRef.current = unreadConversationCount;
    syncMobileAppBadge();
  }, [unreadConversationCount, syncMobileAppBadge]);
  useEffect(() => {
    if (!user) {
      unreadNotificationCountRef.current = 0;
      unreadConversationCountRef.current = 0;
      void setMobileBadgeCount(0);
    }
  }, [user]);
  useEffect(() => {
    const isStudyDestination = Boolean(
      (stackRouteName && ['DailyPractice', 'CourseVideos', 'StudentLearning', 'LearningLesson', 'CertPrepPlayer'].includes(stackRouteName))
      || ((!stackRouteName || stackRouteName === 'MainTabs') && ['DailyPractice', 'CourseVideos'].includes(activeTab)),
    );
    if (!isStudyDestination) {
      setMobileFocusMode(false);
      setMobilePracticeSessionActive(false);
    }
  }, [stackRouteName, activeTab]);
  useEffect(() => {
    const revokedSub = DeviceEventEmitter.addListener(
      SOCKET_EVENTS.SCHEDULE_REMINDER_REVOKED,
      (payload: { scheduleId?: string } | undefined) => {
        if (payload?.scheduleId) {
          void cancelScheduledRemindersForSchedule(String(payload.scheduleId));
        }
      },
    );
    const readSyncSub = DeviceEventEmitter.addListener(
      SOCKET_EVENTS.NOTIFICATION_READ_SYNC,
      (payload: { unread?: number } | undefined) => {
        if (typeof payload?.unread === 'number') {
          unreadNotificationCountRef.current = payload.unread;
          syncMobileAppBadge();
        }
      },
    );
    return () => {
      revokedSub.remove();
      readSyncSub.remove();
    };
  }, [syncMobileAppBadge]);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let active = true;
    const handleResponse = (response: MobileNotificationResponse | null) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handledPushResponses.current.has(identifier)) return;
      handledPushResponses.current.add(identifier);
      setPendingPushResponse(response);
    };
    const subscription = addMobileNotificationResponseReceivedListener(handleResponse);
    getMobileLastNotificationResponseAsync()
      .then((response) => {
        if (active) handleResponse(response);
      })
      .catch((error: unknown) => {
        console.error('Không thể đọc thao tác mở thông báo đẩy.', error);
      });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  useEffect(() => {
    if (!pendingPushResponse || !user || isRestoringSession || !navigationRef.isReady()) return;
    const actionId = pendingPushResponse.actionIdentifier;
    const data = pendingPushResponse.notification.request.content.data as Record<string, unknown> | undefined;
    const routeByNotification = async () => {
      if (!data) {
        navigationRef.navigate('NotificationCenter');
        return;
      }
      if (data.event === 'call:incoming') {
        const caller = data.caller as { id?: unknown; role?: unknown; name?: unknown } | undefined;
        const callId = typeof data.callId === 'string' ? data.callId : '';
        const conversationId = typeof data.conversationId === 'string' ? data.conversationId : '';
        const callerId = typeof caller?.id === 'string' ? caller.id : '';
        const callerRole = typeof caller?.role === 'string' ? caller.role : '';
        const rolesMatch = (user.role === 'student' && callerRole === 'teacher')
          || (user.role === 'teacher' && callerRole === 'student');
        if (callId && conversationId && callerId && rolesMatch) {
          setIncomingCall({
            callId,
            conversationId,
            callerId,
            callerRole,
            callerName: typeof caller?.name === 'string' ? caller.name : 'Người gọi',
          });
          return;
        }
      }

      const category = typeof data.category === 'string' ? data.category : '';
      const deepLinkUrl = typeof data.deepLink === 'string'
        ? data.deepLink
        : typeof data.url === 'string'
          ? data.url
          : '';
      const meetUrl = typeof data.meetUrl === 'string' ? data.meetUrl : '';

      if (actionId === MOBILE_NOTIFICATION_ACTIONS.JOIN_MEET && meetUrl) {
        await Linking.openURL(meetUrl).catch(() => undefined);
        return;
      }
      if (actionId === MOBILE_NOTIFICATION_ACTIONS.OPEN_SCHEDULE || category === 'schedule') {
        navigationRef.navigate('MainTabs', {
          screen: 'Schedule',
          params: typeof data.scheduleId === 'string' ? { focusScheduleId: data.scheduleId } : undefined,
        });
        return;
      }
      if (actionId === MOBILE_NOTIFICATION_ACTIONS.OPEN_MESSAGE || category === 'message') {
        if (typeof data.conversationId === 'string' && data.conversationId) {
          navigationRef.navigate('Conversation', { conversationId: data.conversationId });
        } else {
          navigationRef.navigate('MainTabs', { screen: 'Messages' });
        }
        return;
      }
      if (actionId === MOBILE_NOTIFICATION_ACTIONS.OPEN_PROMO || category === 'promo') {
        const promoUrl = typeof data.promoUrl === 'string' ? data.promoUrl : '';
        if (promoUrl && promoUrl.startsWith('http')) {
          await Linking.openURL(promoUrl).catch(() => undefined);
          return;
        }
        navigationRef.navigate('Tuition');
        return;
      }
      if (deepLinkUrl) {
        const handled = await openDeepLinkInApp(deepLinkUrl);
        if (handled) return;
      }
      if (typeof data.courseId === 'string' && typeof data.unitId === 'string' && typeof data.lessonId === 'string') {
        navigationRef.navigate('LearningLesson', {
          courseId: data.courseId,
          unitId: data.unitId,
          lessonId: data.lessonId,
        });
        return;
      }
      if (typeof data.topicId === 'string') {
        navigationRef.navigate('MainTabs', {
          screen: 'DailyPractice',
          params: { topicId: data.topicId, practice: 'stage' },
        });
        return;
      }
      if (typeof data.conversationId === 'string' && data.conversationId) {
        navigationRef.navigate('Conversation', { conversationId: data.conversationId });
        return;
      }
      navigationRef.navigate('NotificationCenter');
    };

    void routeByNotification().finally(() => {
      setPendingPushResponse(null);
      void clearMobileLastNotificationResponseAsync().catch((error: unknown) => {
        console.warn('Không thể xóa trạng thái mở thông báo đẩy.', error);
      });
    });
  }, [isRestoringSession, pendingPushResponse, user]);
  useEffect(() => {
    if (isRestoringSession) return undefined;
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshInFlight = false;
    let refreshQueued = false;
    handledReadNotificationIds.current.clear();
    const publishCount = (count: number) => {
      unreadNotificationCountRef.current = count;
      DeviceEventEmitter.emit('mobile:notification-count-changed', count);
      syncMobileAppBadge();
    };
    const refreshCount = async () => {
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }
      refreshInFlight = true;
      try {
        const count = await notificationService.unreadCount(user);
        if (active) publishCount(count);
      } catch (error) {
        if (active) console.error('Không thể cập nhật số thông báo chưa đọc.', error);
      } finally {
        refreshInFlight = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          scheduleRefresh();
        }
      }
    };
    let lastNotificationFetchAt = 0;
    const scheduleRefresh = (force = false) => {
      if (!force && Date.now() - lastNotificationFetchAt < 8000) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastNotificationFetchAt = Date.now();
        void refreshCount();
      }, 120);
    };
    const decrementForNotification = (event: { id?: string }) => {
      if (!event?.id || handledReadNotificationIds.current.has(event.id)) return;
      handledReadNotificationIds.current.add(event.id);
      unreadNotificationCountRef.current = Math.max(0, unreadNotificationCountRef.current - 1);
      DeviceEventEmitter.emit('mobile:notification-count-changed', unreadNotificationCountRef.current);
      syncMobileAppBadge();
      scheduleRefresh(true);
    };
    const clearUnreadCount = () => {
      unreadNotificationCountRef.current = 0;
      DeviceEventEmitter.emit('mobile:notification-count-changed', 0);
      syncMobileAppBadge();
      scheduleRefresh(true);
    };
    const subscriptions = [
      DeviceEventEmitter.addListener('mobile:notification-count-refresh', () => scheduleRefresh(false)),
      DeviceEventEmitter.addListener('mobile:notification-read', decrementForNotification),
      DeviceEventEmitter.addListener('mobile:notifications-mark-all-read', clearUnreadCount),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, () => scheduleRefresh(true)),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CONNECTED, () => scheduleRefresh(true)),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') scheduleRefresh(false);
      }),
    ];
    publishCount(0);
    scheduleRefresh(true);
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [isRestoringSession, syncMobileAppBadge, user?.id, user?.role, user?.previewMode]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:exam-room-active', setExamRoomActive);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!user || !['student', 'teacher'].includes(user.role)) return undefined;
    const handleIncomingCall = (event: {
      callId?: string;
      conversationId?: string;
      callType?: string;
      caller?: { id?: string; role?: string; name?: string };
    }) => {
      const { callId, conversationId, caller } = event || {};
      if (!callId || !conversationId || !caller?.id || !caller.role) return;
      const participantId = String(caller.id);
      const participantRole = String(caller.role);
      const rolesMatch = (user.role === 'student' && caller.role === 'teacher')
        || (user.role === 'teacher' && caller.role === 'student');
      if (!rolesMatch) {
        emit('call:reject', { callId, conversationId });
        return;
      }
      if (navigationRef.getCurrentRoute()?.name === 'Call') {
        emit('call:reject', { callId, conversationId });
        return;
      }
      setIncomingCall({
        callId,
        conversationId,
        callerId: participantId,
        callerRole: participantRole,
        callerName: caller.name || 'Người gọi',
      });
    };
    const socketSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_INCOMING, handleIncomingCall);
    const pushSubscription = addMobileNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (!data || data.event !== 'call:incoming') return;
      const rawCaller = data.caller;
      const caller = rawCaller && typeof rawCaller === 'object' && !Array.isArray(rawCaller)
        ? rawCaller as Record<string, unknown>
        : undefined;
      handleIncomingCall({
        callId: typeof data.callId === 'string' ? data.callId : undefined,
        conversationId: typeof data.conversationId === 'string' ? data.conversationId : undefined,
        caller: caller
          ? {
            id: typeof caller.id === 'string' ? caller.id : undefined,
            role: typeof caller.role === 'string' ? caller.role : undefined,
            name: typeof caller.name === 'string' ? caller.name : undefined,
          }
          : undefined,
      });
    });
    return () => {
      socketSubscription.remove();
      pushSubscription?.remove();
    };
  }, [user]);
  useEffect(() => {
    if (!incomingCall) return undefined;
    const dismissIfFinished = (event: { callId?: string; conversationId?: string }) => {
      if (event?.callId === incomingCall.callId && event.conversationId === incomingCall.conversationId) {
        setIncomingCall(null);
      }
    };
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_ENDED, dismissIfFinished),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_TIMEOUT, dismissIfFinished),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_REJECTED, dismissIfFinished),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [incomingCall]);
  const dismissIncomingCall = (accept: boolean) => {
    const call = incomingCall;
    setIncomingCall(null);
    if (!call) return;
    if (accept) {
      navigationRef.navigate('Call', {
        callId: call.callId,
        conversationId: call.conversationId,
        conversationName: call.callerName,
        participantId: call.callerId,
        participantRole: call.callerRole,
        participantName: call.callerName,
        direction: 'incoming',
      });
    } else {
      emit('call:reject', { callId: call.callId, conversationId: call.conversationId });
    }
  };
  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => {
      if (!navigationRef.isReady()) return;
      const state = navigationRef.getRootState();
      const currentRouteName = state?.routes[state.index ?? 0]?.name;
      setStackRouteName(currentRouteName);
      if (currentRouteName === 'Students') {
        setActiveTab('Students');
        return;
      }
      if (currentRouteName !== 'MainTabs') {
        const stackRouteTabs: Record<string, string> = {
          Attendance: 'Schedule',
          CallHistory: 'Messages',
          Conversation: 'Messages',
          Feed: 'Feed',
          TeacherFinance: 'Finance',
          StudentLearning: 'DailyPractice',
        };
        setActiveTab(stackRouteTabs[currentRouteName ?? ''] ?? '');
        return;
      }
      const mainTabsRoute = state?.routes.find((route) => route.name === 'MainTabs');
      const tabState = mainTabsRoute?.state;
      if (tabState) {
        setActiveTab(tabState.routes[tabState.index ?? 0]?.name ?? 'Home');
      }
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener('mobile:tab-badge-messages', (count: number) => {
        setUnreadConversationCount(Number.isInteger(count) ? Math.max(0, count) : 0);
      }),
      DeviceEventEmitter.addListener('mobile:tab-badge-schedule', (count: number) => {
        setTodayScheduleCount(Number.isInteger(count) ? Math.max(0, count) : 0);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  const handleSignOut = useCallback(() => {
          void signOut().catch((error: unknown) => {
            Alert.alert('Đăng xuất thất bại', error instanceof Error ? error.message : 'Không thể đăng xuất.');
          });
  }, [signOut]);
  const handleUnlocked = useCallback(() => {
    void refreshUser();
    void refreshSubscription();
  }, [refreshSubscription, refreshUser]);
  if (isRestoringSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <KineticDotsLoader message="Đang nạp dữ liệu…" />
      </View>
    );
  }
  if (user?.role === 'student' && subscription?.subscription.state === 'expired') {
    return <SubscriptionExpiredScreen />;
  }
  return user ? (
    <View style={styles.root} onTouchStart={noteUserActivity}>
      <OfflineBanner />
      <MobileSoundEffects incomingCall={Boolean(incomingCall)} />
      {(user.role === 'student' || user.role === 'teacher') ? <MeetStartAlert user={user} /> : null}
      <ForcePasswordResetModal
        visible={Boolean(user.mustChangePassword)}
        userName={user.name}
        onCompleted={markPasswordChanged}
        onSignOut={handleSignOut}
      />
      {!user.mustChangePassword ? (
        <>
          <PinLockGate
            userKey={pinUserKey(user)}
            userName={user.name}
            onSignOut={handleSignOut}
          />
          <TeacherPaymentNoticeModal
            user={user}
            onViewFinance={() => {
              if (navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: 'Finance' });
            }}
          />
          <LearningGoalHost user={user} />
          <FreeLockOverlayHost
            freeLocked={isFreePortalLocked(user) && !hasMeetAccessClient(subscription?.subscription)}
            onUnlocked={handleUnlocked}
          />
          <FreeSurveyModal
            visible={Boolean(user.role === 'student' && user.needsFreeSurvey && !surveyDismissed)}
            onDone={() => {
              setSurveyDismissed(true);
              void refreshUser();
            }}
          />
        </>
      ) : null}
      <MainStackScreens isStudent={user.role === 'student'} />
      {!examRoomActive && !practiceSessionActive ? (
        <FloatingNavigationMenu onSignOut={handleSignOut} />
      ) : null}
      {!examRoomActive
        && !practiceSessionActive
        && !focusMode
        && stackRouteName !== 'Conversation'
        && stackRouteName !== 'Call'
        && activeTab !== 'Support'
        && user.role === 'teacher' ? (
        <FloatingSupportButton />
      ) : null}
      {!examRoomActive && !practiceSessionActive && !focusMode && stackRouteName && stackRouteName !== 'MainTabs' && stackRouteName !== 'Conversation' && stackRouteName !== 'Call' && stackRouteName !== 'CertPrepPlayer' ? (
        <PersistentTabBar
          role={user.role}
          activeTab={activeTab}
          unreadConversationCount={unreadConversationCount}
          todayScheduleCount={todayScheduleCount}
          freeMenu={isFreePortalMenu(user)}
          freeLocked={isFreePortalLocked(user)}
        />
      ) : null}
      {focusMode && !practiceSessionActive && stackRouteName !== 'DailyPractice' && activeTab !== 'DailyPractice' ? (
        <Pressable
          onPress={() => {
            triggerMobileHaptic('light');
            setMobileFocusMode(false);
          }}
          style={({ pressed }) => [
            styles.focusExitPill,
            { top: insets.top + 8 },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Thoát chế độ tập trung"
        >
          <Minimize2 size={15} color="#047857" />
          <Text style={styles.focusExitText}>Thoát tập trung</Text>
        </Pressable>
      ) : null}
      <NotificationOverlayHost />
      <QuickAiOverlayHost user={user} />
      <MobilePopupBanner role={user?.role || 'student'} />
      <StreakHonorPopup user={user} />
      <Modal
        visible={Boolean(incomingCall)}
        transparent
        animationType="fade"
        onRequestClose={() => dismissIncomingCall(false)}
      >
        <View style={styles.incomingCallBackdrop}>
          <View style={styles.incomingCallCard}>
            <View style={styles.incomingCallIcon}>
              <Phone size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.incomingCallTitle}>Cuộc gọi đến</Text>
            <Text style={styles.incomingCallName}>{incomingCall?.callerName}</Text>
            <Text style={styles.incomingCallSubtitle}>đang gọi thoại cho bạn</Text>
            <View style={styles.incomingCallActions}>
              <Pressable
                onPress={() => dismissIncomingCall(false)}
                style={[styles.incomingCallButton, styles.rejectCallButton]}
                accessibilityRole="button"
                accessibilityLabel="Từ chối cuộc gọi"
              >
                <PhoneOff size={20} color="#FFFFFF" />
                <Text style={styles.incomingCallButtonText}>Từ chối</Text>
              </Pressable>
              <Pressable
                onPress={() => dismissIncomingCall(true)}
                style={[styles.incomingCallButton, styles.acceptCallButton]}
                accessibilityRole="button"
                accessibilityLabel="Nghe máy"
              >
                <Phone size={20} color="#FFFFFF" />
                <Text style={styles.incomingCallButtonText}>Nghe máy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  ) : (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}

function NavTabContent({
  name,
  label,
  Icon,
  selected,
  isHome,
  badgeCount = 0,
  locked = false,
  isBrandStudent = false,
  roomyLabel = false,
}: {
  name: string;
  label: string;
  Icon: LucideIcon;
  selected: boolean;
  isHome: boolean;
  badgeCount?: number;
  locked?: boolean;
  isBrandStudent?: boolean;
  roomyLabel?: boolean;
}) {
  const tone = TAB_ICON_TONES[name] || colors.muted;
  return (
    <View
      style={[
        styles.navItem,
        isHome ? styles.navItemHome : styles.navItemCard,
        !isHome && selected && (isBrandStudent ? styles.navItemActiveBrand : styles.navItemActive),
      ]}
      accessibilityLabel={isHome ? label : undefined}
    >
      <View
        style={[
          styles.navTile,
          isHome
            ? (isBrandStudent ? styles.navTileHomeBrand : styles.navTileHome)
            : selected
              ? (isBrandStudent ? styles.navTileActiveBrand : styles.navTileActive)
              : {
                borderColor: `${tone}26`,
                backgroundImage: `linear-gradient(135deg, ${tone}14 0%, #FFFFFF 100%)`,
              },
        ]}
      >
        <Icon
          size={isHome ? 28 : 20}
          color={isHome || selected ? '#FFFFFF' : tone}
          strokeWidth={isHome || selected ? 2.5 : 2}
        />
        {locked ? (
          <View style={styles.navLockBadge}>
            <Lock size={10} color="#FBBF24" strokeWidth={2.5} />
          </View>
        ) : badgeCount > 0 ? (
          <Text style={[styles.persistentTabBadge, isBrandStudent && styles.persistentTabBadgeBrand]}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
            ) : null}
          </View>
      {isHome ? null : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.navLabel,
            roomyLabel && styles.navLabelRoomy,
            selected && (isBrandStudent ? styles.navLabelActiveBrand : styles.navLabelActive),
          ]}
        >
          {label}
        </Text>
      )}
        </View>
  );
}

type StudentBarTabItem = {
  name: keyof MainTabsParamList;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  matchTabs: string[];
};

function getStudentFiveTabItems(freeMenu: boolean): StudentBarTabItem[] {
  return [
    {
      name: 'Schedule',
      label: 'Lịch học',
      shortLabel: 'Lịch học',
      icon: CalendarDays,
      matchTabs: ['Schedule'],
    },
    {
      name: 'DailyPractice',
      label: 'Học tập',
      shortLabel: 'Học tập',
      icon: Gamepad2,
      matchTabs: ['CourseVideos', 'DailyPractice', 'StudentLearning', 'CertPrepCatalog', 'CertPrepLevel'],
    },
    {
      name: 'Home',
      label: 'Trang chủ',
      shortLabel: 'Trang chủ',
      icon: House,
      matchTabs: ['Home'],
    },
    {
      name: 'Messages',
      label: 'Trao đổi',
      shortLabel: 'Trao đổi',
      icon: MessageCircle,
      matchTabs: ['Messages', 'Feed', 'Conversation'],
    },
    {
      name: 'Profile',
      label: 'Hồ sơ',
      shortLabel: 'Hồ sơ',
      icon: UserRound,
      matchTabs: ['Profile', 'Tuition', 'Evaluations'],
    },
  ];
}

const TabBarGlassBackdrop = React.memo(function TabBarGlassBackdrop() {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.navigationGlassBackground}>
        <View style={[styles.navigationGlassTint, styles.navigationGlassTintAndroid]} />
      </View>
    );
  }
  return (
    <BlurView intensity={60} tint="light" style={styles.navigationGlassBackground}>
      <View style={styles.navigationGlassTint} />
    </BlurView>
  );
});

const StudentFiveTabBar = React.memo(function StudentFiveTabBar({
  activeTab,
  unreadConversationCount,
  todayScheduleCount,
  freeMenu = false,
  freeLocked = false,
  isBrandStudent = false,
  onSelect,
}: {
  activeTab: string;
  unreadConversationCount: number;
  todayScheduleCount: number;
  freeMenu?: boolean;
  freeLocked?: boolean;
  isBrandStudent?: boolean;
  onSelect: (screen: keyof MainTabsParamList) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [visibility, setVisible] = useNavigationBarVisibility();
  const centeredWebBar = Platform.OS === 'web' && windowWidth >= 1024;
  const barWidth = 760;
  const barSideInset = centeredWebBar ? (windowWidth - barWidth) / 2 : 0;
  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => setVisible(true));
    return unsubscribe;
  }, [setVisible]);

  const items = useMemo(() => getStudentFiveTabItems(freeMenu), [freeMenu]);
  const barHeight = 96 + insets.bottom;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.persistentTabBar,
        centeredWebBar && {
          left: barSideInset,
          right: barSideInset,
          width: barWidth,
        },
        {
          height: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight] }),
          paddingTop: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.lg] }),
          paddingBottom: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(insets.bottom, spacing.sm)] }),
          opacity: visibility,
          transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [barHeight, 0] }) }],
        },
      ]}
    >
      <TabBarGlassBackdrop />
      {items.map(({ name, label, shortLabel, icon: Icon, matchTabs }) => {
        const selected = matchTabs.includes(activeTab);
        const locked = freeLocked && FREE_LOCKED_DESTINATIONS.has(name);
        const badgeCount = name === 'Messages'
          ? unreadConversationCount
          : name === 'Schedule' ? todayScheduleCount : 0;
        return (
          <Pressable
            key={name}
            onPress={() => {
              if (locked) {
                DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
                return;
              }
              onSelect(name);
            }}
            style={styles.persistentTabItem}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <NavTabContent
              name={name}
              label={shortLabel}
              Icon={Icon}
              selected={selected}
              isHome={name === 'Home'}
              badgeCount={badgeCount}
              locked={locked}
              isBrandStudent={isBrandStudent}
              roomyLabel
            />
          </Pressable>
        );
      })}
    </Animated.View>
  );
});

const PersistentTabBar = React.memo(function PersistentTabBar({
  role,
  activeTab,
  unreadConversationCount,
  todayScheduleCount,
  freeMenu = false,
  freeLocked = false,
}: {
  role: 'student' | 'teacher';
  activeTab: string;
  unreadConversationCount: number;
  todayScheduleCount: number;
  freeMenu?: boolean;
  freeLocked?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isTeacher = role === 'teacher';
  const { user } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !freeMenu && !isFreePortalMenu(user));
  const [visibility, setVisible] = useNavigationBarVisibility();
  const centeredWebBar = Platform.OS === 'web' && windowWidth >= 1024;
  const barWidth = 760;
  const barSideInset = centeredWebBar ? (windowWidth - barWidth) / 2 : 0;
  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => setVisible(true));
    return unsubscribe;
  }, [setVisible]);

  const selectStudentTab = useCallback((name: keyof MainTabsParamList) => {
    navigationRef.navigate('MainTabs', { screen: name });
  }, []);

  if (!isTeacher) {
    return (
      <StudentFiveTabBar
        activeTab={activeTab}
        unreadConversationCount={unreadConversationCount}
        todayScheduleCount={todayScheduleCount}
        freeMenu={freeMenu}
        freeLocked={freeLocked}
        isBrandStudent={isBrandStudent}
        onSelect={selectStudentTab}
      />
    );
  }
  const items = isTeacher ? [
    { name: 'Schedule' as const, label: 'Lịch dạy', shortLabel: 'Lịch', icon: CalendarDays },
    { name: 'Messages' as const, label: 'Hộp thư', shortLabel: 'Tin nhắn', icon: MessageCircle },
    { name: 'Feed' as const, label: 'Bảng tin', shortLabel: 'Bảng tin', icon: Newspaper },
    { name: 'Home' as const, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: House },
    { name: 'Finance' as const, label: 'Tài chính', shortLabel: 'Tài chính', icon: DollarSign },
    { name: 'Support' as const, label: 'Support hỗ trợ', shortLabel: 'Hỗ trợ', icon: Headphones },
    { name: 'Profile' as const, label: 'Hồ sơ', shortLabel: 'Hồ sơ', icon: UserRound },
  ] : [];
  const orderedItems = items;
  const barHeight = 96 + insets.bottom;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.persistentTabBar,
        centeredWebBar && {
          left: barSideInset,
          right: barSideInset,
          width: barWidth,
        },
        {
          height: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight] }),
          paddingTop: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.lg] }),
          paddingBottom: visibility.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(insets.bottom, spacing.sm)] }),
          opacity: visibility,
          transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [barHeight, 0] }) }],
        },
      ]}
    >
      <TabBarGlassBackdrop />
      {orderedItems.map(({ name, label, shortLabel, icon: Icon }) => {
        const selected = name === activeTab;
        const locked = (!isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(name));
        const badgeCount = name === 'Messages'
          ? unreadConversationCount
          : name === 'Schedule' ? todayScheduleCount : 0;
        return (
          <Pressable
            key={name}
            onPress={() => {
              if (locked) {
                DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
                return;
              }
              navigationRef.navigate('MainTabs', { screen: name });
            }}
            style={styles.persistentTabItem}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <NavTabContent
              name={name}
              label={shortLabel}
              Icon={Icon}
              selected={selected}
              isHome={name === 'Home'}
              badgeCount={badgeCount}
              locked={locked}
              isBrandStudent={isBrandStudent}
            />
          </Pressable>
        );
      })}
    </Animated.View>
  );
});

type MenuDestination = 'Home' | 'Schedule' | 'Students' | 'Messages' | 'CourseVideos' | 'Feed'
  | 'Profile' | 'Assignments' | 'Materials' | 'StudentExam'
  | 'StudentLearning' | 'Evaluations' | 'News' | 'CenterInfo' | 'SoftwareLinks'
  | 'Tuition' | 'TeacherQuizzes' | 'TeacherTraining' | 'TeacherFinance' | 'Support' | 'DailyPractice' | 'StudentCourses';

type MenuEntry = { label: string; destination: MenuDestination; icon: LucideIcon };
type MenuSection = { label: string; items: MenuEntry[] };

const DrawerMenuRow = React.memo(function DrawerMenuRow({
  label,
  destination,
  icon: Icon,
  selected,
  itemLocked,
  isBrandStudent,
  onSelect,
}: {
  label: string;
  destination: MenuDestination;
  icon: LucideIcon;
  selected: boolean;
  itemLocked: boolean;
  isBrandStudent: boolean;
  onSelect: (destination: MenuDestination) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(destination)}
      style={({ pressed }) => [
        styles.drawerItem,
        selected && (isBrandStudent ? styles.drawerItemActiveBrand : styles.drawerItemActive),
        pressed && styles.drawerItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View style={[styles.drawerItemIcon, selected && (isBrandStudent ? styles.drawerItemIconActiveBrand : styles.drawerItemIconActive)]}>
        <Icon size={18} color={selected ? '#FFFFFF' : '#A8B6CC'} strokeWidth={2} />
      </View>
      <Text style={[styles.drawerItemText, selected && styles.drawerItemTextActive]}>{label}</Text>
      {itemLocked ? <Lock size={14} color="#FBBF24" /> : selected ? (
        <View style={[styles.drawerItemSelectedMark, isBrandStudent && styles.drawerItemSelectedMarkBrand]} />
      ) : null}
    </Pressable>
  );
});

const FloatingNavigationMenu = React.memo(function FloatingNavigationMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user, subscription } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [hasRenderedDrawer, setHasRenderedDrawer] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const menuMountedRef = useRef(false);
  menuMountedRef.current = menuMounted;
  const drawerWidth = Math.min(windowWidth * 0.82, 280);
  const drawerTranslateX = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isTeacher = user?.role === 'teacher';
  const freeMenu = isFreePortalMenu(user);
  const isBrandStudent = !isTeacher && !freeMenu;
  const freeLocked = isFreePortalLocked(user) && !hasMeetAccessClient(subscription?.subscription);
  const feedPostLocked = !isTeacher && !hasFeedPostAccess({
    role: user?.role,
    user,
    subscription: subscription?.subscription,
  });
  const [activeDestination, setActiveDestination] = useState<MenuDestination | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const menuSections = useMemo<MenuSection[]>(() => (
    isTeacher
      ? [
        {
          label: 'KHÔNG GIAN LÀM VIỆC',
          items: [
            { label: 'Tổng quan', destination: 'Home', icon: LayoutDashboard },
      { label: 'Hộp thư', destination: 'Messages', icon: MessageCircle },
            { label: 'Quản lý học viên', destination: 'Students', icon: Users },
      { label: 'Lịch dạy & điểm danh', destination: 'Schedule', icon: CalendarDays },
          ],
        },
        {
          label: 'QUẢN LÝ ĐÀO TẠO',
          items: [
            { label: 'Bài tập & kiểm tra', destination: 'TeacherQuizzes', icon: CheckSquare },
      { label: 'Khóa đào tạo', destination: 'TeacherTraining', icon: BookOpen },
            { label: 'Tài chính', destination: 'TeacherFinance', icon: DollarSign },
          ],
        },
        {
          label: 'THÔNG TIN',
          items: [
      { label: 'Bảng tin', destination: 'Feed', icon: Radio },
      { label: 'Tin tức', destination: 'News', icon: Newspaper },
            { label: 'Hỗ trợ', destination: 'Support', icon: Headphones },
      { label: 'Thông tin Trung tâm', destination: 'CenterInfo', icon: FileText },
          ],
        },
    ]
    : [
        {
          label: 'KHÔNG GIAN HỌC TẬP',
          items: [
            { label: 'Tổng quan', destination: 'Home', icon: House },
            ...(freeMenu ? [{ label: 'Danh mục khóa học', destination: 'StudentCourses' as const, icon: Layers }] : []),
            { label: 'Luyện tập', destination: 'DailyPractice', icon: Gamepad2 },
      { label: 'Hộp thư', destination: 'Messages', icon: MessageCircle },
            ...(!freeMenu ? [{ label: 'Lịch học', destination: 'Schedule' as const, icon: CalendarDays }] : []),
            { label: 'Bài tập và tài nguyên', destination: 'Assignments', icon: FileBox },
      { label: 'Phòng thi', destination: 'StudentExam', icon: GraduationCap },
          ],
        },
        {
          label: 'THÔNG TIN & HỖ TRỢ',
          items: [
            { label: 'Bảng tin', destination: 'Feed' as const, icon: Radio },
            ...(!freeMenu ? [
              { label: 'Tin tức', destination: 'News' as const, icon: Newspaper },
              { label: 'Đánh giá giảng viên', destination: 'Evaluations' as const, icon: Star },
              { label: 'Liên hệ Trung tâm', destination: 'CenterInfo' as const, icon: Building2 },
            ] : []),
            { label: 'Hỗ trợ', destination: 'Support', icon: Headphones },
          ],
        },
      ]
  ), [freeMenu, isTeacher]);

  const menuItems = useMemo(() => menuSections.flatMap((section) => section.items), [menuSections]);

  // Làm nóng cấu trúc drawer ngầm sau khi app khởi động ổn định để bấm Menu phản hồi ngay lập tức.
  useEffect(() => {
    if (hasRenderedDrawer) return undefined;
    const warmTimer = setTimeout(() => setHasRenderedDrawer(true), 450);
    return () => clearTimeout(warmTimer);
  }, [hasRenderedDrawer]);

  const animateDrawerOpen = useCallback(() => {
    drawerTranslateX.stopAnimation();
    backdropOpacity.stopAnimation();
    drawerTranslateX.setValue(-drawerWidth);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: 0,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [backdropOpacity, drawerTranslateX, drawerWidth]);

  const openMenu = useCallback(() => {
    if (!hasRenderedDrawer) {
      setHasRenderedDrawer(true);
      setMenuMounted(true);
      requestAnimationFrame(animateDrawerOpen);
      return;
    }
    setMenuMounted(true);
    animateDrawerOpen();
  }, [animateDrawerOpen, hasRenderedDrawer]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(MOBILE_OPEN_MENU_EVENT, openMenu);
    return () => subscription.remove();
  }, [openMenu]);

  const closeMenuImmediate = useCallback(() => {
    drawerTranslateX.stopAnimation();
    backdropOpacity.stopAnimation();
    drawerTranslateX.setValue(-drawerWidth);
    backdropOpacity.setValue(0);
    setMenuMounted(false);
  }, [backdropOpacity, drawerTranslateX, drawerWidth]);

  const closeMenu = useCallback(() => {
    if (!menuMountedRef.current) return;
    drawerTranslateX.stopAnimation();
    backdropOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: -drawerWidth,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(({ finished }) => {
      if (finished) setMenuMounted(false);
    });
  }, [backdropOpacity, drawerTranslateX, drawerWidth]);

  useEffect(() => {
    if (!menuMounted || Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
  }, [closeMenu, menuMounted]);

  useEffect(() => {
    let active = true;
    getMobileSoundEnabled()
      .then((enabled) => { if (active) setSoundEnabled(enabled); })
      .catch(() => undefined);
    const unsubscribe = subscribeToMobileSoundPreference(setSoundEnabled);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const updateActiveDestination = () => {
      const currentRoute = navigationRef.getCurrentRoute()?.name;
      const activeItem = menuItems.find((item) => item.destination === currentRoute);
      const activeAlias = isTeacher && currentRoute === 'Assignments'
        ? 'TeacherQuizzes'
        : currentRoute === 'Conversation' || currentRoute === 'CallHistory'
          ? 'Messages'
          : currentRoute === 'Profile'
            ? 'Profile'
            : null;
      const next = activeItem?.destination || activeAlias;
      setActiveDestination((prev) => (prev === next ? prev : next));
    };
    updateActiveDestination();
    return navigationRef.addListener('state', updateActiveDestination);
  }, [isTeacher, menuItems]);

  const openDestination = useCallback((destination: MenuDestination) => {
    closeMenuImmediate();
    if (!isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(destination)) {
      DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
      return;
    }
    if (destination === 'Students') {
      navigationRef.navigate('Students');
      return;
    }
    if (destination === 'Support') {
      if (isTeacher) {
        navigationRef.navigate('MainTabs', { screen: 'Support' });
      } else {
        navigationRef.navigate('Support');
      }
      return;
    }
    if (['Home', 'Schedule', 'Messages', 'CourseVideos', 'Feed', 'Profile', 'DailyPractice'].includes(destination)) {
      navigationRef.navigate('MainTabs', { screen: destination as keyof MainTabsParamList });
      return;
    }
    if (destination === 'Assignments') navigationRef.navigate('Assignments');
    else if (destination === 'StudentCourses') navigationRef.navigate('StudentCourses');
    else if (destination === 'Materials') navigationRef.navigate('Materials');
    else if (destination === 'StudentExam') navigationRef.navigate('StudentExam');
    else if (destination === 'StudentLearning') navigationRef.navigate('StudentLearning');
    else if (destination === 'Evaluations') navigationRef.navigate('Evaluations');
    else if (destination === 'News') navigationRef.navigate('News');
    else if (destination === 'CenterInfo') navigationRef.navigate('CenterInfo');
    else if (destination === 'SoftwareLinks') navigationRef.navigate('SoftwareLinks');
    else if (destination === 'Tuition') navigationRef.navigate('Tuition');
    else if (destination === 'TeacherQuizzes') navigationRef.navigate('TeacherQuizzes');
    else if (destination === 'TeacherTraining') navigationRef.navigate('TeacherTraining');
    else if (destination === 'TeacherFinance') navigationRef.navigate('TeacherFinance');
  }, [closeMenuImmediate, freeLocked, isTeacher]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      void setMobileSoundEnabled(next).catch((error: unknown) => {
        setSoundEnabled(current);
        Alert.alert('Không thể đổi âm thanh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      });
      return next;
    });
  }, []);

  if (!hasRenderedDrawer) return null;

  return (
    <View
      pointerEvents={menuMounted ? 'auto' : 'none'}
      accessibilityViewIsModal={menuMounted}
      accessibilityElementsHidden={!menuMounted}
      importantForAccessibility={menuMounted ? 'yes' : 'no-hide-descendants'}
      style={[styles.drawerOverlayRoot, !menuMounted && styles.drawerOverlayHidden]}
    >
        <View style={styles.drawerOverlay}>
        <Animated.View style={[styles.drawerBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.drawerDismiss} onPress={closeMenu} accessibilityLabel="Đóng danh mục" />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawer,
            styles.drawerFastSurface,
            {
              width: drawerWidth,
              paddingTop: insets.top + spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
        >
            <View style={styles.drawerHeader}>
            <View style={styles.drawerProfileCard}>
              <View style={styles.drawerProfileTop}>
                <EditableMobileAvatar size={46} name={user?.name} showBadge />
              <View style={styles.drawerIdentity}>
                <Text numberOfLines={1} style={styles.drawerName}>{user?.name || 'Tài khoản'}</Text>
                  <View style={[styles.drawerRoleBadge, isTeacher && styles.drawerRoleBadgeTeacher]}>
                    <Text style={[styles.drawerRole, isTeacher && styles.drawerRoleTeacher]}>
                      {isTeacher ? 'GIẢNG VIÊN' : 'HỌC VIÊN'}
                    </Text>
              </View>
            </View>
              </View>
              {!isTeacher ? <SubscriptionStatusCard compact variant="drawer" /> : null}
            </View>
          </View>
          <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerItems} showsVerticalScrollIndicator={false}>
            {menuSections.map((section) => (
              <View key={section.label} style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>{section.label}</Text>
                <View style={styles.drawerSectionItems}>
                  {section.items.map(({ label, destination, icon }) => {
                    const selected = activeDestination === destination;
                    const itemLocked = (!isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(destination)) || (destination === 'Feed' && feedPostLocked);
                    return (
                      <DrawerMenuRow
                  key={destination}
                        label={label}
                        destination={destination}
                        icon={icon}
                        selected={selected}
                        itemLocked={itemLocked}
                        isBrandStudent={isBrandStudent}
                        onSelect={openDestination}
                      />
                    );
                  })}
                </View>
              </View>
              ))}
            </ScrollView>
            <View style={styles.drawerFooter}>
            <View style={[styles.drawerItem, { justifyContent: 'space-between' }]}>
              <Text style={styles.drawerItemText}>Ngôn ngữ</Text>
              <LanguageSwitcher variant="pill" theme="dark" />
            </View>
            <Pressable
              onPress={() => openDestination('Profile')}
              style={[styles.drawerItem, activeDestination === 'Profile' && (isBrandStudent ? styles.drawerItemActiveBrand : styles.drawerItemActive)]}
              accessibilityRole="button"
              accessibilityState={{ selected: activeDestination === 'Profile' }}
            >
              <View style={[styles.drawerItemIcon, activeDestination === 'Profile' && (isBrandStudent ? styles.drawerItemIconActiveBrand : styles.drawerItemIconActive)]}>
                <UserRound size={18} color={activeDestination === 'Profile' ? '#FFFFFF' : '#A8B6CC'} />
              </View>
              <Text style={[styles.drawerItemText, activeDestination === 'Profile' && styles.drawerItemTextActive]}>Hồ sơ</Text>
              {activeDestination === 'Profile' ? (
                <View style={[styles.drawerItemSelectedMark, isBrandStudent && styles.drawerItemSelectedMarkBrand]} />
              ) : null}
              </Pressable>
            <Pressable onPress={() => { closeMenuImmediate(); onSignOut(); }} style={styles.drawerItem} accessibilityRole="button" accessibilityLabel="Đăng xuất">
              <View style={styles.drawerItemIcon}><LogOut size={18} color="#34D399" /></View>
              <Text style={[styles.drawerItemText, styles.drawerLogoutText]}>Đăng xuất</Text>
              </Pressable>
            <Pressable onPress={toggleSound} style={styles.drawerItem} accessibilityRole="button" accessibilityLabel={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'} accessibilityState={{ checked: soundEnabled }}>
              <View style={styles.drawerItemIcon}>
                {soundEnabled ? <Volume2 size={18} color="#A8B6CC" /> : <VolumeX size={18} color="#A8B6CC" />}
            </View>
              <Text style={styles.drawerItemText}>{soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}</Text>
            </Pressable>
          </View>
        </Animated.View>
        </View>
    </View>
  );
});

const FloatingSupportButton = React.memo(function FloatingSupportButton() {
  const { user, subscription } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const freeMenu = isFreePortalMenu(user);
  const isGreenTone = isTeacher || freeMenu;
  const freeLocked = isFreePortalLocked(user) && !hasMeetAccessClient(subscription?.subscription);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [hovered, setHovered] = useState(false);
  const buttonSize = 52;
  const headerBottom = insets.top + 58;
  const bottomNavigationHeight = 96 + insets.bottom;
  const minTop = headerBottom + 8;
  const maxTop = Math.max(minTop, windowHeight - bottomNavigationHeight - buttonSize - 8);
  const topAnim = useRef(new Animated.Value((minTop + maxTop) / 2)).current;
  const currentTopRef = useRef((minTop + maxTop) / 2);

  useEffect(() => {
    const clamped = Math.max(minTop, Math.min(maxTop, currentTopRef.current));
    currentTopRef.current = clamped;
    topAnim.setValue(clamped);
  }, [maxTop, minTop, topAnim]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => {
      const nextTop = Math.max(minTop, Math.min(maxTop, gesture.moveY - buttonSize / 2));
      currentTopRef.current = nextTop;
      topAnim.setValue(nextTop);
    },
  }), [buttonSize, maxTop, minTop, topAnim]);

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.floatingSupportHandle, { top: topAnim }]}>
      <Pressable
        onPress={() => {
          if (freeLocked) {
            DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
            return;
          }
          if (user?.role === 'teacher') {
            navigationRef.navigate('MainTabs', { screen: 'Support' });
          } else {
            navigationRef.navigate('Support');
          }
        }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.floatingSupportButton,
          isGreenTone && styles.floatingSupportButtonGreen,
          Platform.OS === 'web' && { opacity: pressed || hovered ? 1 : 0.58 },
          pressed && styles.floatingSupportButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mở hỗ trợ"
      >
        <View style={[styles.floatingSupportIcon, !isGreenTone && styles.floatingSupportIconBrand]}>
          <Headphones size={22} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <View style={styles.floatingSupportLabel}>
          <Text style={styles.floatingSupportLabelText}>Hỗ trợ</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const MainTabs = React.memo(function MainTabs() {
  const { user, subscription } = useAuth();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { focusMode } = useMobileFocusMode();
  const practiceSessionActive = useMobilePracticeSessionActive();
  const hideTabBar = practiceSessionActive || focusMode;
  const isTeacher = user?.role === 'teacher';
  const freeMenu = isFreePortalMenu(user);
  const isBrandStudent = !isTeacher && !freeMenu;
  const freeLocked = isFreePortalLocked(user) && !hasMeetAccessClient(subscription?.subscription);
  const feedPostLocked = !isTeacher && !hasFeedPostAccess({
    role: user?.role,
    user,
    subscription: subscription?.subscription,
  });
  const centeredWebBar = Platform.OS === 'web' && windowWidth >= 1024;
  const tabBarWidth = 760;
  const [navigationBarVisibility, setNavigationBarVisible] = useNavigationBarVisibility();
  useFocusEffect(useCallback(() => {
    setNavigationBarVisible(true);
  }, [setNavigationBarVisible]));
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [todayScheduleCount, setTodayScheduleCount] = useState(0);
  const [newFinanceTransactionCount, setNewFinanceTransactionCount] = useState(0);
  useEffect(() => {
    DeviceEventEmitter.emit('mobile:tab-badge-messages', unreadConversationCount);
  }, [unreadConversationCount]);
  useEffect(() => {
    DeviceEventEmitter.emit('mobile:tab-badge-schedule', todayScheduleCount);
  }, [todayScheduleCount]);
  const financeSnapshotKey = user?.id ? `mobile:seen-finance-transactions:${user.id}` : '';
  const teacherTabPositions: Record<string, number> = {
    Schedule: 0,
    Messages: 1,
    Feed: 2,
    Home: 3,
    Finance: 4,
    Support: 5,
    Profile: 6,
  };
  const refreshTabBadges = useCallback(async () => {
    if (!user) {
      setUnreadConversationCount(0);
      setTodayScheduleCount(0);
      return;
    }

    const [conversationsResult, schedulesResult, financeResult] = await Promise.allSettled([
      freeLocked ? Promise.resolve([]) : messageService.conversations(user.role, user),
      freeMenu ? Promise.resolve([]) : scheduleService.list(user.role),
      isTeacher ? teacherFinanceService.overview(user) : Promise.resolve(null),
    ]);

    if (conversationsResult.status === 'fulfilled') {
      setUnreadConversationCount(conversationsResult.value.filter((conversation) => conversation.unread > 0).length);
    } else {
      console.error('Không thể cập nhật huy hiệu tin nhắn:', conversationsResult.reason);
    }

    if (schedulesResult.status === 'fulfilled') {
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
      const todayKey = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
      setTodayScheduleCount(schedulesResult.value.filter((item) => (
        item.date === todayKey && item.status !== 'cancelled'
      )).length);
    } else {
      console.error('Không thể cập nhật huy hiệu lịch:', schedulesResult.reason);
    }

    if (financeResult.status === 'fulfilled' && isTeacher && financeResult.value && financeSnapshotKey) {
      const confirmedIds = [...new Set(
        financeResult.value.transactions
          .filter((transaction) => transaction.status === 'confirmed')
          .map((transaction) => transaction.id),
      )];
      try {
        const storedSnapshot = await AsyncStorage.getItem(financeSnapshotKey);
        if (storedSnapshot === null) {
          await AsyncStorage.setItem(financeSnapshotKey, JSON.stringify(confirmedIds));
          setNewFinanceTransactionCount(0);
        } else {
          const seenIds: unknown = JSON.parse(storedSnapshot);
          if (!Array.isArray(seenIds) || !seenIds.every((id) => typeof id === 'string')) {
            throw new Error('Dữ liệu giao dịch tài chính đã xem không hợp lệ.');
          }
          const seen = new Set(seenIds);
          setNewFinanceTransactionCount(confirmedIds.filter((id) => !seen.has(id)).length);
        }
      } catch (error) {
        console.error('Không thể cập nhật huy hiệu giao dịch tài chính:', error);
      }
    } else if (financeResult.status === 'rejected') {
      console.error('Không thể tải giao dịch để cập nhật huy hiệu tài chính:', financeResult.reason);
    }
  }, [financeSnapshotKey, isTeacher, user]);

  const markFinanceTransactionsViewed = useCallback(async () => {
    if (!user || !isTeacher || !financeSnapshotKey) return;
    try {
      const overview = await teacherFinanceService.overview(user);
      const confirmedIds = [...new Set(
        overview.transactions
          .filter((transaction) => transaction.status === 'confirmed')
          .map((transaction) => transaction.id),
      )];
      await AsyncStorage.setItem(financeSnapshotKey, JSON.stringify(confirmedIds));
      setNewFinanceTransactionCount(0);
    } catch (error) {
      console.error('Không thể đánh dấu giao dịch tài chính đã xem:', error);
    }
  }, [financeSnapshotKey, isTeacher, user]);

  const didInitialBadgeFocusRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!didInitialBadgeFocusRef.current) {
      didInitialBadgeFocusRef.current = true;
      void refreshTabBadges();
      return;
    }
    void refreshTabBadges();
  }, [refreshTabBadges]));

  useEffect(() => {
    let badgeTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (badgeTimer) clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => {
        badgeTimer = null;
        void refreshTabBadges();
      }, 350);
    };
    const refreshEvents = [
      SOCKET_EVENTS.MESSAGE_RECEIVED,
      SOCKET_EVENTS.MESSAGE_SENT_ACK,
      SOCKET_EVENTS.READ_ACK,
      'mobile:message-read',
      SOCKET_EVENTS.SCHEDULE_NEW,
      SOCKET_EVENTS.SCHEDULE_UPDATED,
      SOCKET_EVENTS.SCHEDULE_CANCELLED,
      SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM,
      SOCKET_EVENTS.ATTENDANCE_DISPUTED,
      SOCKET_EVENTS.ATTENDANCE_CONFIRMED,
      SOCKET_EVENTS.ATTENDANCE_REJECTED,
      SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED,
      SOCKET_EVENTS.FINANCE_TRANSACTION,
      SOCKET_EVENTS.NOTIFICATION,
      SOCKET_EVENTS.CONTACT_UPDATED,
      SOCKET_EVENTS.DATA_REFRESH,
      SOCKET_EVENTS.FREE_PORTAL_UNLOCKED,
      SOCKET_EVENTS.FREE_PORTAL_LOCKED,
      SOCKET_EVENTS.SUBSCRIPTION_UPDATED,
      'mobile:free-portal-unlocked',
    ];
    const subscriptions = refreshEvents.map((eventName) => DeviceEventEmitter.addListener(eventName, refresh));
    const financeViewedSubscription = DeviceEventEmitter.addListener('mobile:finance-viewed', () => {
      void markFinanceTransactionsViewed();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void refreshTabBadges();
      }
    }, 60000);
    return () => {
      if (badgeTimer) clearTimeout(badgeTimer);
      subscriptions.forEach((subscription) => subscription.remove());
      financeViewedSubscription.remove();
      clearInterval(interval);
    };
  }, [markFinanceTransactionsViewed, refreshTabBadges]);

  const renderStudentTabBar = useCallback((tabProps: BottomTabBarProps) => {
    if (hideTabBar) return null;
    const currentRoute = tabProps.state.routes[tabProps.state.index]?.name || 'Home';
    return (
      <StudentFiveTabBar
        activeTab={currentRoute}
        unreadConversationCount={unreadConversationCount}
        todayScheduleCount={todayScheduleCount}
        freeMenu={freeMenu}
        freeLocked={freeLocked}
        isBrandStudent={isBrandStudent}
        onSelect={(screen) => tabProps.navigation.navigate(screen)}
      />
    );
  }, [hideTabBar, unreadConversationCount, todayScheduleCount, freeMenu, freeLocked, isBrandStudent]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={!isTeacher ? renderStudentTabBar : undefined}
      screenListeners={({ route }) => ({
        tabPress: (e) => {
          const locked = !isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(route.name);
          if (locked) {
            e.preventDefault();
            DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
          }
        },
      })}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: hideTabBar
          ? { display: 'none' as const }
          : {
            ...(centeredWebBar ? {
              width: tabBarWidth,
              maxWidth: '100%',
              alignSelf: 'center' as const,
            } : {}),
            position: 'absolute' as const,
            left: centeredWebBar ? (windowWidth - tabBarWidth) / 2 : 10,
            right: centeredWebBar ? (windowWidth - tabBarWidth) / 2 : 10,
            bottom: centeredWebBar ? 12 : Math.max(insets.bottom, 8),
            backgroundColor: 'transparent',
            borderTopColor: 'rgba(255,255,255,0.96)',
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: 'rgba(255,255,255,0.8)',
            borderRadius: 24,
            height: navigationBarVisibility.interpolate({ inputRange: [0, 1], outputRange: [0, 96 + insets.bottom] }),
            paddingTop: navigationBarVisibility.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.md] }),
            paddingBottom: navigationBarVisibility.interpolate({
              inputRange: [0, 1],
              outputRange: [0, spacing.sm],
            }),
            boxShadow: droplet.navBar,
            opacity: navigationBarVisibility,
            transform: [{
              translateY: navigationBarVisibility.interpolate({
                inputRange: [0, 1],
                outputRange: [96 + insets.bottom, 0],
              }),
            }],
          },
        tabBarIconStyle: { width: '100%', height: 64 },
        tabBarAccessibilityLabel: navTabLabel(route.name, isTeacher, language),
        tabBarButton: (props) => {
          const locked = !isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(route.name);
            return (
            <PlatformPressable
              {...props}
              onPress={(e) => {
                if (locked) {
                  e.preventDefault?.();
                  DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
                  return;
                }
                props.onPress?.(e);
              }}
            />
          );
        },
        tabBarBackground: () => <TabBarGlassBackdrop />,
        tabBarItemStyle: isTeacher
          ? {
            position: 'absolute',
            left: `${(teacherTabPositions[route.name] ?? 0) * (100 / 7)}%`,
            width: `${100 / 7}%`,
            height: '100%',
          }
          : undefined,
        tabBarIcon: ({ focused }) => {
          const badgeCount = route.name === 'Schedule'
            ? todayScheduleCount
            : route.name === 'Messages'
              ? unreadConversationCount
              : route.name === 'Finance' ? newFinanceTransactionCount : 0;
          const locked = !isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(route.name);
          return (
            <NavTabContent
              name={route.name}
              label={navTabLabel(route.name, isTeacher, language)}
              Icon={TAB_ICONS[route.name] || FileText}
              selected={focused}
              isHome={route.name === 'Home'}
              badgeCount={badgeCount}
              locked={locked}
              isBrandStudent={isBrandStudent}
            />
          );
        },
      })}
    >
      {
        isTeacher ? (
          <>
            <Tab.Screen
              name="Schedule"
              component={ScheduleScreen}
              options={{
                title: translateText('Lịch dạy', language),
              }}
            />
            <Tab.Screen
              name="Feed"
              component={FeedScreen}
              options={{ title: translateText('Bảng tin', language) }}
            />
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: translateText('Tổng quan', language) }} />
            <Tab.Screen
              name="Finance"
              component={TeacherFinanceScreen}
              options={{
                title: translateText('Tài chính', language),
              }}
            />
            <Tab.Screen
              name="Messages"
              component={MessagesScreen}
              options={{
                title: translateText('Tin nhắn', language),
              }}
            />
            <Tab.Screen name="Support" component={SupportEntryScreen} options={{ title: translateText('Hỗ trợ', language) }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: translateText('Hồ sơ', language) }} />
        </>
      ) : (
        <>
            <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: translateText('Lịch học', language) }} />
            <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: translateText('Trao đổi', language) }} />
            <Tab.Screen name="Feed" component={FeedScreen} options={{ title: translateText('Bảng tin', language) }} />
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: translateText('Trang chủ', language) }} />
            <Tab.Screen name="DailyPractice" component={DailyPracticeScreen} options={{ title: translateText('Luyện tập', language) }} />
            <Tab.Screen name="CourseVideos" component={DailyPracticeScreen} options={{ title: translateText('Học tập', language) }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: translateText('Hồ sơ', language) }} />
        </>
      )}
    </Tab.Navigator >
  );
});

function useNavigationBarVisibility() {
  const visibility = useRef(new Animated.Value(1)).current;
  const visibleRef = useRef(true);
  const setVisible = useCallback((visible: boolean) => {
    if (visibleRef.current === visible) return;
    visibleRef.current = visible;
    animateChrome(visibility, visible);
  }, [visibility]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, setVisible);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setVisible(true);
    });
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [setVisible]);
  return [visibility, setVisible] as const;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  focusExitPill: { position: 'absolute', right: 14, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: '#A7F3D0', backgroundColor: 'rgba(255,255,255,0.96)', shadowColor: '#047857', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  focusExitText: { color: '#047857', fontSize: 12, fontWeight: '800' },
  incomingCallBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  incomingCallCard: { width: '100%', maxWidth: 360, alignItems: 'center', padding: spacing.xl, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  incomingCallIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#16A34A', marginBottom: spacing.md },
  incomingCallTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  incomingCallName: { color: colors.ink, fontSize: typography.title, fontWeight: '700', marginTop: spacing.sm },
  incomingCallSubtitle: { color: colors.muted, fontSize: typography.body, marginTop: spacing.xs },
  incomingCallActions: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.xl },
  incomingCallButton: { minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  rejectCallButton: { backgroundColor: '#059669' },
  acceptCallButton: { backgroundColor: '#16A34A' },
  incomingCallButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },
  persistentTabBar: { position: 'absolute', zIndex: 15, left: 6, right: 6, bottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingHorizontal: 2, paddingTop: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.65)', boxShadow: droplet.navBar },
  navigationGlassBackground: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  navigationGlassTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.65)', backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(241,245,249,0.66) 100%)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 24 },
  navigationGlassTintAndroid: { backgroundColor: 'rgba(255,255,255,0.95)' },
  persistentTabItem: { flex: 1, minWidth: 0, height: 64, alignItems: 'stretch', justifyContent: 'flex-start' },
  navItem: { alignSelf: 'stretch', marginHorizontal: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 0, paddingVertical: 3, borderWidth: 1, borderColor: 'transparent', borderRadius: 16 },
  navItemCard: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.45)', boxShadow: droplet.button },
  navItemActive: { borderColor: 'rgba(167,243,208,0.8)', backgroundColor: 'rgba(236,253,245,0.8)', backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(236,253,245,0.8) 100%)', boxShadow: droplet.navItemActive },
  navItemActiveBrand: { borderColor: 'rgba(167,243,208,0.8)', backgroundColor: 'rgba(236,253,245,0.8)', backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(236,253,245,0.8) 100%)', boxShadow: droplet.navItemActive },
  navTile: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderBottomWidth: 3, borderBottomColor: '#CBD5E1', borderRadius: 14, backgroundColor: '#FFFFFF' },
  navTileActive: { borderColor: '#059669', borderBottomColor: '#047857', borderBottomWidth: 3, backgroundColor: '#10B981' },
  navTileActiveBrand: { borderColor: '#059669', borderBottomColor: '#065F46', borderBottomWidth: 3, backgroundColor: '#10B981' },
  navItemHome: { gap: 0, paddingVertical: 0 },
  navTileHome: { width: 56, height: 56, borderWidth: 3, borderBottomWidth: 5, borderColor: '#FFFFFF', borderBottomColor: '#047857', borderRadius: 28, backgroundColor: '#10B981', backgroundImage: 'linear-gradient(160deg, #34D399 0%, #059669 55%, #047857 100%)', boxShadow: droplet.navHome },
  navTileHomeBrand: { width: 56, height: 56, borderWidth: 3, borderBottomWidth: 5, borderColor: '#FFFFFF', borderBottomColor: '#065F46', borderRadius: 28, backgroundColor: '#10B981', backgroundImage: 'linear-gradient(160deg, #34D399 0%, #10B981 55%, #059669 100%)', boxShadow: droplet.navHomeBrand },
  navLabel: { maxWidth: '100%', color: colors.muted, fontSize: 8.5, lineHeight: 11.5, letterSpacing: -0.3, fontWeight: '700', textAlign: 'center' },
  navLabelRoomy: { fontSize: 10.5, lineHeight: 13, letterSpacing: -0.1 },
  navLabelActive: { color: '#047857', fontWeight: '900' },
  navLabelActiveBrand: { color: '#059669', fontWeight: '900' },
  persistentTabBadge: { position: 'absolute', top: -7, right: -9, minWidth: 18, height: 18, paddingHorizontal: 4, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.brand, color: '#FFFFFF', fontSize: 10, lineHeight: 18, fontWeight: '700', textAlign: 'center', textAlignVertical: 'center' },
  persistentTabBadgeBrand: { backgroundColor: '#059669' },
  navLockBadge: { position: 'absolute', top: -6, right: -6, width: 17, height: 17, borderRadius: 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  floatingSupportHandle: { position: 'absolute', right: 0, zIndex: 19 },
  floatingSupportButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, paddingLeft: 4, paddingRight: 14, borderWidth: 2, borderRightWidth: 0, borderColor: '#F59E0B', borderTopLeftRadius: 999, borderBottomLeftRadius: 999, backgroundColor: '#FFF8EB', backgroundImage: 'linear-gradient(145deg, #FFF8EB 0%, #FFFFFF 100%)', boxShadow: 'inset 2px 2px 5px rgba(120, 53, 15, 0.16), inset -2px -2px 5px rgba(255, 255, 255, 0.98), 0px 2px 5px rgba(15, 23, 42, 0.08)' },
  floatingSupportButtonGreen: { borderColor: '#10B981', backgroundColor: '#FFFFFF', backgroundImage: 'none' },
  floatingSupportButtonPressed: { transform: [{ translateY: 1 }], boxShadow: 'inset 3px 3px 8px rgba(120, 53, 15, 0.24), inset -2px -2px 5px rgba(255, 255, 255, 0.88)' },
  floatingSupportLabel: { paddingHorizontal: 2 },
  floatingSupportLabelText: { color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  floatingSupportIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.brand, boxShadow: 'inset 2px 2px 4px rgba(4, 120, 87, 0.28), inset -1px -1px 3px rgba(255, 255, 255, 0.2)' },
  floatingSupportIconBrand: { backgroundColor: '#059669', boxShadow: 'inset 2px 2px 4px rgba(4, 120, 87, 0.28), inset -1px -1px 3px rgba(255, 255, 255, 0.2)' } as never,
  drawerOverlayRoot: { ...StyleSheet.absoluteFill, zIndex: 90 },
  drawerOverlayHidden: { display: 'none' },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2, 6, 23, 0.64)' },
  drawerDismiss: { ...StyleSheet.absoluteFill },
  drawer: { width: '82%', maxWidth: 280, height: '100%', backgroundColor: 'rgba(13, 21, 36, 0.9)', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRightColor: 'rgba(103,232,249,0.45)', borderTopRightRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden', shadowColor: '#22D3EE', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 3, height: 0 }, elevation: 18 },
  drawerFastSurface: { backgroundColor: 'rgba(11, 18, 32, 0.96)' },
  drawerGlassBackground: { ...StyleSheet.absoluteFill, borderTopRightRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  drawerGlassTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 15, 28, 0.52)', borderTopRightRadius: 26, borderBottomRightRadius: 26 },
  drawerHeader: { paddingBottom: spacing.md },
  drawerProfileCard: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  drawerProfileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  drawerAvatar: { width: 46, height: 46, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 23, backgroundColor: '#334155' },
  drawerAvatarImage: { width: 46, height: 46, borderRadius: 23 },
  drawerIdentity: { flex: 1, minWidth: 0, gap: 6 },
  drawerName: { color: '#F8FAFC', fontSize: typography.small, fontWeight: '800' },
  drawerRoleBadge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(96, 165, 250, 0.12)' },
  drawerRoleBadgeTeacher: { backgroundColor: 'rgba(251, 191, 36, 0.12)' },
  drawerRole: { color: '#93C5FD', fontSize: typography.micro, fontWeight: '700' },
  drawerRoleTeacher: { color: '#FCD34D' },
  drawerScroll: { flex: 1 },
  drawerItems: { paddingTop: spacing.xs, paddingBottom: spacing.md, gap: spacing.md },
  drawerSection: { gap: spacing.xs },
  drawerSectionLabel: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs, color: '#94A3B8', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  drawerSectionItems: { gap: 4 },
  drawerItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 12, borderWidth: 1, borderColor: 'transparent', borderRadius: 14 },
  drawerItemActive: { borderColor: 'rgba(52, 211, 153, 0.4)', borderBottomWidth: 3, borderBottomColor: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.16)' },
  drawerItemActiveBrand: { borderColor: 'rgba(52, 211, 153, 0.4)', borderBottomWidth: 3, borderBottomColor: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.16)' },
  drawerItemPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  drawerItemIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  drawerItemIconActive: { backgroundColor: '#10B981' },
  drawerItemIconActiveBrand: { backgroundColor: '#10B981' },
  drawerItemText: { flex: 1, color: '#D5DCE7', fontSize: typography.body, fontWeight: '700' },
  drawerLogoutText: { color: '#34D399' },
  drawerItemTextActive: { color: '#FFFFFF', fontWeight: '900' },
  drawerItemSelectedMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  drawerItemSelectedMarkBrand: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  drawerFooter: { paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.24)', gap: 4 },
  homeArcButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    borderRadius: 29,
    backgroundColor: colors.brand,
    shadowColor: '#047857',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
});
