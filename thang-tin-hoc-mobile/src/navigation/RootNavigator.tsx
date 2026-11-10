import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, DeviceEventEmitter, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import {
  addMobileNotificationReceivedListener,
  addMobileNotificationResponseReceivedListener,
  clearMobileLastNotificationResponseAsync,
  getMobileLastNotificationResponseAsync,
  type MobileNotificationResponse,
} from '../services/mobilePushNotifications';
import {
  BookOpen, Building2, CalendarDays, CheckSquare, FileBox, FileText, Gamepad2, GraduationCap,
  DollarSign, Headphones, House, LayoutDashboard, Lock, LogOut, Menu, MessageCircle, Newspaper, Phone, PhoneOff, Radio, Search, Star, UserRound, Users, Volume2, VolumeX, WalletCards, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../app/AuthContext';
import { emit, SOCKET_EVENTS } from '../services/socketService';
import { colors, droplet, radius, spacing, typography } from '../theme/tokens';
import { getMobileSoundEnabled, setMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { messageService, notificationService, scheduleService, teacherFinanceService } from '../services/mockService';
import { LoginScreen } from '../screens/LoginScreen';
import { EditableMobileAvatar } from '../components/EditableMobileAvatar';
import { SubscriptionExpiredScreen, SubscriptionStatusCard } from '../components/subscription/SubscriptionRenew';
import { HomeScreen } from '../screens/HomeScreen';
import { CallScreen } from '../screens/CallScreen';
import { CallHistoryScreen } from '../screens/CallHistoryScreen';
import {
  AssignmentsScreen, AttendanceScreen, GradesScreen, MaterialsScreen, StudentResourcesScreen,
  NotificationsScreen, ProfileScreen, ScheduleScreen, StudentsScreen,
} from '../screens/FeatureScreens';
import { ConversationScreen, MessagesScreen } from '../screens/MessageScreens';
import { CourseVideosScreen } from '../screens/CourseVideosScreen';
import {
  CenterInfoScreen, EvaluationsScreen, FeedScreen, LearningLessonScreen, MobileMenuScreen,
  NewsDetailScreen, NewsScreen, SoftwareLinksScreen, StudentExamScreen, StudentLearningScreen,
  TeacherQuizzesScreen, TeacherTrainingScreen, TuitionScreen,
} from '../screens/ParityScreens';
import { TeacherFinanceScreen } from '../screens/TeacherFinanceScreen';
import { SupportEntryScreen } from '../screens/SupportEntryScreen';
import {
  CertPrepCatalogScreen, CertPrepLevelScreen, CertPrepPlayerScreen, CertPrepResultScreen,
} from '../screens/CertPrepScreens';
import { DailyPracticeScreen } from '../screens/DailyPracticeScreen';
import { OfflineBanner } from '../components/OfflineBanner';
import { MobileSoundEffects } from '../components/MobileSoundEffects';
import { PinLockGate } from '../components/pinLock/PinLockGate';
import { TeacherPaymentNoticeModal } from '../components/TeacherPaymentNoticeModal';
import { LearningGoalHost } from '../components/LearningGoalModal';
import { FreeFeatureLockModal, FreeSurveyModal, isFreePortalLocked, isFreePortalMenu } from '../components/FreePortalModals';
import { MobilePopupBanner } from '../components/MobilePopupBanner';
import { noteStudyActivity } from '../services/studyActivity';
import { notePinActivity, pinUserKey } from '../services/pinLock';
import { MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, animateChrome } from '../components/ui';
import type { AppStackParamList, MainTabsParamList } from './types';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();
const MOBILE_OPEN_FREE_LOCK_MODAL_EVENT = 'mobile:open-free-lock-modal';
const FREE_LOCKED_DESTINATIONS = new Set<string>(['Messages', 'Assignments', 'StudentExam', 'Support']);

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
    CourseVideos: 'Bài giảng',
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

function navTabLabel(name: string, isTeacher: boolean) {
  return NAV_TAB_LABELS[isTeacher ? 'teacher' : 'student'][name] || name;
}

type IncomingCallPrompt = {
  callId: string;
  conversationId: string;
  callerId: string;
  callerRole: string;
  callerName: string;
};

export function RootNavigator() {
  const { user, isRestoringSession, signOut, subscription, refreshUser, refreshSubscription } = useAuth();
  const [notificationOverlayVisible, setNotificationOverlayVisible] = useState(false);
  const [freeLockModalVisible, setFreeLockModalVisible] = useState(false);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const unreadNotificationCountRef = useRef(0);
  const handledReadNotificationIds = useRef(new Set<string>());
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
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
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:open-notifications', () => setNotificationOverlayVisible(true));
    const lockSub = DeviceEventEmitter.addListener(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT, () => setFreeLockModalVisible(true));
    return () => {
      subscription.remove();
      lockSub.remove();
    };
  }, []);
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
    const data = pendingPushResponse.notification.request.content.data;
    if (!data) {
      navigationRef.navigate('NotificationCenter');
      setPendingPushResponse(null);
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
      } else {
        navigationRef.navigate('NotificationCenter');
      }
    } else {
      navigationRef.navigate('NotificationCenter');
    }
    setPendingPushResponse(null);
    void clearMobileLastNotificationResponseAsync().catch((error: unknown) => {
      console.warn('Không thể xóa trạng thái mở thông báo đẩy.', error);
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
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refreshCount();
      }, 120);
    };
    const decrementForNotification = (event: { id?: string }) => {
      if (!event?.id || handledReadNotificationIds.current.has(event.id)) return;
      handledReadNotificationIds.current.add(event.id);
      unreadNotificationCountRef.current = Math.max(0, unreadNotificationCountRef.current - 1);
      DeviceEventEmitter.emit('mobile:notification-count-changed', unreadNotificationCountRef.current);
      scheduleRefresh();
    };
    const clearUnreadCount = () => {
      unreadNotificationCountRef.current = 0;
      DeviceEventEmitter.emit('mobile:notification-count-changed', 0);
      scheduleRefresh();
    };
    const subscriptions = [
      DeviceEventEmitter.addListener('mobile:notification-count-refresh', scheduleRefresh),
      DeviceEventEmitter.addListener('mobile:notification-read', decrementForNotification),
      DeviceEventEmitter.addListener('mobile:notifications-mark-all-read', clearUnreadCount),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, scheduleRefresh),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.CONNECTED, scheduleRefresh),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') scheduleRefresh();
      }),
    ];
    publishCount(0);
    scheduleRefresh();
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [isRestoringSession, user?.id, user?.role, user?.previewMode]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:open-search', () => setSearchOverlayVisible(true));
    return () => subscription.remove();
  }, []);
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
          StudentLearning: 'CourseVideos',
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
  if (isRestoringSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.brand} />
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
      <PinLockGate
        userKey={pinUserKey(user)}
        userName={user.name}
        onSignOut={() => {
          void signOut().catch((error: unknown) => {
            Alert.alert('Đăng xuất thất bại', error instanceof Error ? error.message : 'Không thể đăng xuất.');
          });
        }}
      />
      <TeacherPaymentNoticeModal
        user={user}
        onViewFinance={() => {
          if (navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: 'Finance' });
        }}
      />
      <LearningGoalHost user={user} />
      <FreeFeatureLockModal
        visible={freeLockModalVisible}
        onClose={() => setFreeLockModalVisible(false)}
        onUnlocked={() => {
          void refreshUser();
          void refreshSubscription();
        }}
      />
      <FreeSurveyModal
        visible={Boolean(user.role === 'student' && user.needsFreeSurvey && !surveyDismissed)}
        onDone={() => {
          setSurveyDismissed(true);
          void refreshUser();
        }}
      />
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Assignments" component={user.role === 'student' ? StudentResourcesScreen : AssignmentsScreen} />
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
          {user.role === 'student' ? (
            <>
              <Stack.Screen name="Materials" component={MaterialsScreen} />
              <Stack.Screen name="Grades" component={GradesScreen} />
              <Stack.Screen name="StudentLearning" component={StudentLearningScreen} />
              <Stack.Screen name="StudentExam" component={StudentExamScreen} />
              <Stack.Screen name="LearningLesson" component={LearningLessonScreen} />
              <Stack.Screen name="Evaluations" component={EvaluationsScreen} />
              <Stack.Screen name="Tuition" component={TuitionScreen} />
              <Stack.Screen name="CertPrepCatalog" component={CertPrepCatalogScreen} />
              <Stack.Screen name="CertPrepLevel" component={CertPrepLevelScreen} />
              <Stack.Screen name="CertPrepPlayer" component={CertPrepPlayerScreen} />
              <Stack.Screen name="CertPrepResult" component={CertPrepResultScreen} />
              <Stack.Screen name="DailyPractice" component={DailyPracticeScreen} />
              <Stack.Screen name="Support" component={SupportEntryScreen} />
            </>
          ) : null}
          {user.role === 'teacher' ? (
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
      {!examRoomActive ? (
        <FloatingNavigationMenu
          onSignOut={() => {
            void signOut().catch((error: unknown) => {
              Alert.alert('Đăng xuất thất bại', error instanceof Error ? error.message : 'Không thể đăng xuất.');
            });
          }}
        />
      ) : null}
      {!examRoomActive
        && stackRouteName !== 'Conversation'
        && stackRouteName !== 'Call'
        && activeTab !== 'Support'
        && (user.role === 'student' || user.role === 'teacher') ? (
        <FloatingSupportButton />
      ) : null}
      {!examRoomActive && stackRouteName && stackRouteName !== 'MainTabs' && stackRouteName !== 'Conversation' && stackRouteName !== 'Call' ? (
        <PersistentTabBar
          role={user.role}
          activeTab={activeTab}
          unreadConversationCount={unreadConversationCount}
          todayScheduleCount={todayScheduleCount}
          freeMenu={isFreePortalMenu(user)}
          freeLocked={isFreePortalLocked(user)}
        />
      ) : null}
      {notificationOverlayVisible ? (
        <NotificationsScreen
          overlay
          onClose={() => setNotificationOverlayVisible(false)}
        />
      ) : null}
      {searchOverlayVisible ? <GlobalSearchOverlay onClose={() => setSearchOverlayVisible(false)} /> : null}
      <MobilePopupBanner role={user?.role || 'student'} />
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
    </Stack.Navigator>
  );
}

function GlobalSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.searchOverlay}>
        <Pressable style={styles.searchOverlayBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng tìm kiếm" />
        <View style={styles.searchOverlayCard}>
          <View style={styles.searchOverlayHeader}>
            <Text style={styles.searchOverlayTitle}>Tìm kiếm</Text>
            <Pressable onPress={onClose} style={styles.searchOverlayClose} accessibilityRole="button" accessibilityLabel="Đóng tìm kiếm">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.searchOverlayInput}>
            <Search size={18} color={colors.muted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm bất cứ gì"
              placeholderTextColor={colors.muted}
              style={styles.searchOverlayTextInput}
              accessibilityLabel="Tìm bất cứ gì"
              returnKeyType="done"
              onSubmitEditing={onClose}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Xóa nội dung tìm kiếm">
                <X size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
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
}: {
  name: string;
  label: string;
  Icon: LucideIcon;
  selected: boolean;
  isHome: boolean;
  badgeCount?: number;
  locked?: boolean;
}) {
  const tone = TAB_ICON_TONES[name] || colors.muted;
  return (
    <View
      style={[
        styles.navItem,
        isHome ? styles.navItemHome : styles.navItemCard,
        !isHome && selected && styles.navItemActive,
      ]}
      accessibilityLabel={isHome ? label : undefined}
    >
      <View
        style={[
          styles.navTile,
          isHome
            ? styles.navTileHome
            : selected
              ? styles.navTileActive
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
        {badgeCount > 0 ? (
          <Text style={styles.persistentTabBadge}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        ) : locked ? (
          <View style={styles.navLockBadge}>
            <Lock size={10} color="#FBBF24" strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
      {isHome ? null : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.navLabel, selected && styles.navLabelActive]}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

function PersistentTabBar({
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
  const [visibility, setVisible] = useNavigationBarVisibility();
  const centeredWebBar = Platform.OS === 'web' && windowWidth >= 1024;
  const barWidth = 760;
  const barSideInset = centeredWebBar ? (windowWidth - barWidth) / 2 : 0;
  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => setVisible(true));
    return unsubscribe;
  }, [setVisible]);
  const items = isTeacher
    ? [
      { name: 'Schedule' as const, label: 'Lịch dạy', shortLabel: 'Lịch', icon: CalendarDays },
      { name: 'Messages' as const, label: 'Hộp thư', shortLabel: 'Tin nhắn', icon: MessageCircle },
      { name: 'Feed' as const, label: 'Bảng tin', shortLabel: 'Bảng tin', icon: Newspaper },
      { name: 'Home' as const, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: House },
      { name: 'Finance' as const, label: 'Tài chính', shortLabel: 'Tài chính', icon: DollarSign },
      { name: 'Support' as const, label: 'Support hỗ trợ', shortLabel: 'Hỗ trợ', icon: Headphones },
      { name: 'Profile' as const, label: 'Hồ sơ', shortLabel: 'Hồ sơ', icon: UserRound },
    ]
    : freeMenu
      ? [
        { name: 'Messages' as const, label: 'Hộp thư', shortLabel: 'Hộp thư', icon: MessageCircle },
        { name: 'DailyPractice' as const, label: 'Luyện tập', shortLabel: 'Luyện tập', icon: Gamepad2 },
        { name: 'Home' as const, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: House },
        { name: 'CourseVideos' as const, label: 'Bài giảng', shortLabel: 'Bài giảng', icon: BookOpen },
        { name: 'Profile' as const, label: 'Hồ sơ', shortLabel: 'Hồ sơ', icon: UserRound },
      ]
      : [
        { name: 'Schedule' as const, label: 'Lịch học', shortLabel: 'Lịch học', icon: CalendarDays },
        { name: 'Messages' as const, label: 'Hộp thư', shortLabel: 'Hộp thư', icon: MessageCircle },
        { name: 'Feed' as const, label: 'Bảng tin', shortLabel: 'Bảng tin', icon: Newspaper },
        { name: 'Home' as const, label: 'Tổng quan', shortLabel: 'Tổng quan', icon: House },
        { name: 'DailyPractice' as const, label: 'Luyện tập', shortLabel: 'Luyện tập', icon: Gamepad2 },
        { name: 'CourseVideos' as const, label: 'Bài giảng', shortLabel: 'Bài giảng', icon: BookOpen },
        { name: 'Profile' as const, label: 'Hồ sơ', shortLabel: 'Hồ sơ', icon: UserRound },
      ];
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
      <BlurView
        intensity={Platform.OS === 'android' ? 75 : 60}
        tint="light"
        style={styles.navigationGlassBackground}
      >
        <View style={styles.navigationGlassTint} />
      </BlurView>
      {orderedItems.map(({ name, label, shortLabel, icon: Icon }) => {
        const selected = name === activeTab;
        const locked = !isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(name);
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
            />
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

type MenuDestination = 'Home' | 'Schedule' | 'Students' | 'Messages' | 'CourseVideos' | 'Feed'
  | 'Profile' | 'Assignments' | 'Materials' | 'StudentExam'
  | 'StudentLearning' | 'Evaluations' | 'News' | 'CenterInfo' | 'SoftwareLinks'
  | 'Tuition' | 'TeacherQuizzes' | 'TeacherTraining' | 'TeacherFinance' | 'Support' | 'DailyPractice';

type MenuEntry = { label: string; destination: MenuDestination; icon: LucideIcon };
type MenuSection = { label: string; items: MenuEntry[] };

function FloatingNavigationMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [menuMounted, setMenuMounted] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [handleHovered, setHandleHovered] = useState(false);
  const isTeacher = user?.role === 'teacher';
  const freeMenu = isFreePortalMenu(user);
  const freeLocked = isFreePortalLocked(user);
  const [activeDestination, setActiveDestination] = useState<MenuDestination | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const drawerWidth = Math.min(windowWidth * 0.82, 280);
  const handleHeight = 48;
  const headerBottom = insets.top + 58;
  const bottomNavigationHeight = 96 + insets.bottom;
  const minMenuTop = headerBottom + 8;
  const maxMenuTop = Math.max(minMenuTop, windowHeight - bottomNavigationHeight - handleHeight - 8);
  const [menuTop, setMenuTop] = useState((minMenuTop + maxMenuTop) / 2);
  useEffect(() => {
    setMenuTop((currentTop) => Math.max(minMenuTop, Math.min(maxMenuTop, currentTop)));
  }, [maxMenuTop, minMenuTop]);
  const menuSections: MenuSection[] = isTeacher
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
          { label: 'Thông tin Trung tâm', destination: 'CenterInfo', icon: FileText }
        ],
      },
    ]
    : [
      {
        label: 'KHÔNG GIAN HỌC TẬP',
        items: [
          { label: 'Tổng quan', destination: 'Home', icon: House },
          { label: 'Luyện tập', destination: 'DailyPractice', icon: Gamepad2 },
          { label: 'Bài giảng', destination: 'CourseVideos', icon: BookOpen },
          { label: 'Hộp thư', destination: 'Messages', icon: MessageCircle },
          ...(!freeMenu ? [{ label: 'Lịch học', destination: 'Schedule' as const, icon: CalendarDays }] : []),
          { label: 'Bài tập và tài nguyên', destination: 'Assignments', icon: FileBox },
          { label: 'Phòng thi', destination: 'StudentExam', icon: GraduationCap },
        ],
      },
      {
        label: 'THÔNG TIN & HỖ TRỢ',
        items: [
          ...(!freeMenu ? [
            { label: 'Bảng tin', destination: 'Feed' as const, icon: Radio },
            { label: 'Tin tức', destination: 'News' as const, icon: Newspaper },
            { label: 'Đánh giá giảng viên', destination: 'Evaluations' as const, icon: Star },
            { label: 'Liên hệ Trung tâm', destination: 'CenterInfo' as const, icon: Building2 },
          ] : []),
          { label: 'Hỗ trợ', destination: 'Support', icon: Headphones },
        ],
      },
    ];
  const menuItems = menuSections.flatMap((section) => section.items);
  const openMenu = () => {
    drawerTranslateX.stopAnimation();
    backdropOpacity.stopAnimation();
    drawerTranslateX.setValue(-drawerWidth);
    backdropOpacity.setValue(0);
    setMenuMounted(true);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(drawerTranslateX, {
          toValue: 0,
          duration: 280,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  };
  const closeMenu = () => {
    if (!menuMounted) return;
    drawerTranslateX.stopAnimation();
    backdropOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(drawerTranslateX, {
        toValue: -drawerWidth,
        duration: 280,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(({ finished }) => {
      if (finished) setMenuMounted(false);
    });
  };
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
      setActiveDestination(activeItem?.destination || activeAlias);
    };
    updateActiveDestination();
    return navigationRef.addListener('state', updateActiveDestination);
  }, [isTeacher]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => {
      setMenuTop(Math.max(minMenuTop, Math.min(maxMenuTop, gesture.moveY - handleHeight / 2)));
    },
  }), [handleHeight, maxMenuTop, minMenuTop]);

  const openDestination = (destination: MenuDestination) => {
    closeMenu();
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
    if (['Home', 'Schedule', 'Messages', 'CourseVideos', 'Feed', 'Profile'].includes(destination)) {
      navigationRef.navigate('MainTabs', { screen: destination as keyof MainTabsParamList });
      return;
    }
    if (destination === 'Assignments') navigationRef.navigate('Assignments');
    else if (destination === 'Materials') navigationRef.navigate('Materials');
    else if (destination === 'StudentExam') navigationRef.navigate('StudentExam');
    else if (destination === 'StudentLearning') navigationRef.navigate('StudentLearning');
    else if (destination === 'DailyPractice') navigationRef.navigate('DailyPractice');
    else if (destination === 'Evaluations') navigationRef.navigate('Evaluations');
    else if (destination === 'News') navigationRef.navigate('News');
    else if (destination === 'CenterInfo') navigationRef.navigate('CenterInfo');
    else if (destination === 'SoftwareLinks') navigationRef.navigate('SoftwareLinks');
    else if (destination === 'Tuition') navigationRef.navigate('Tuition');
    else if (destination === 'TeacherQuizzes') navigationRef.navigate('TeacherQuizzes');
    else if (destination === 'TeacherTraining') navigationRef.navigate('TeacherTraining');
    else if (destination === 'TeacherFinance') navigationRef.navigate('TeacherFinance');
  };

  const toggleSound = () => {
    void setMobileSoundEnabled(!soundEnabled)
      .then(() => setSoundEnabled(!soundEnabled))
      .catch((error: unknown) => {
        Alert.alert('Không thể đổi âm thanh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      });
  };

  return (
    <>
      <View {...panResponder.panHandlers} style={[styles.floatingMenuHandle, { top: menuTop }]}>
        <Pressable
          onPress={openMenu}
          onHoverIn={() => setHandleHovered(true)}
          onHoverOut={() => setHandleHovered(false)}
          style={({ pressed }) => [
            styles.floatingMenuButton,
            { opacity: pressed || handleHovered ? 0.96 : 0.22 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mở danh mục điều hướng"
        >
          <Menu size={21} color="#FFFFFF" />
        </Pressable>
      </View>
      <Modal visible={menuMounted} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.drawerOverlay}>
          <Animated.View style={[styles.drawerBackdrop, { opacity: backdropOpacity }]}>
            <Pressable style={styles.drawerDismiss} onPress={closeMenu} accessibilityLabel="Đóng danh mục" />
          </Animated.View>
          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                paddingTop: insets.top + spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                transform: [{ translateX: drawerTranslateX }],
              },
            ]}
          >
            <BlurView intensity={72} tint="dark" pointerEvents="none" style={styles.drawerGlassBackground}>
              <View style={styles.drawerGlassTint} />
            </BlurView>
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
                    {section.items.map(({ label, destination, icon: Icon }) => {
                      const selected = activeDestination === destination;
                      const itemLocked = !isTeacher && freeLocked && FREE_LOCKED_DESTINATIONS.has(destination);
                      return (
                        <Pressable
                          key={destination}
                          onPress={() => openDestination(destination)}
                          style={({ pressed }) => [
                            styles.drawerItem,
                            selected && styles.drawerItemActive,
                            pressed && styles.drawerItemPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityState={{ selected }}
                        >
                          <View style={[styles.drawerItemIcon, selected && styles.drawerItemIconActive]}>
                            <Icon size={18} color={selected ? '#FFFFFF' : '#A8B6CC'} strokeWidth={2} />
                          </View>
                          <Text style={[styles.drawerItemText, selected && styles.drawerItemTextActive]}>{label}</Text>
                          {itemLocked ? <Lock size={14} color="#FBBF24" /> : selected ? <View style={styles.drawerItemSelectedMark} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.drawerFooter}>
              <Pressable
                onPress={() => openDestination('Profile')}
                style={[styles.drawerItem, activeDestination === 'Profile' && styles.drawerItemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: activeDestination === 'Profile' }}
              >
                <View style={[styles.drawerItemIcon, activeDestination === 'Profile' && styles.drawerItemIconActive]}>
                  <UserRound size={18} color={activeDestination === 'Profile' ? '#FFFFFF' : '#A8B6CC'} />
                </View>
                <Text style={[styles.drawerItemText, activeDestination === 'Profile' && styles.drawerItemTextActive]}>Hồ sơ</Text>
              </Pressable>
              <Pressable onPress={() => { closeMenu(); onSignOut(); }} style={styles.drawerItem} accessibilityRole="button" accessibilityLabel="Đăng xuất">
                <View style={styles.drawerItemIcon}><LogOut size={18} color="#FCA5A5" /></View>
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
      </Modal>
    </>
  );
}

function FloatingSupportButton() {
  const { user } = useAuth();
  const freeLocked = isFreePortalLocked(user);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [hovered, setHovered] = useState(false);
  const buttonSize = 52;
  const headerBottom = insets.top + 58;
  const bottomNavigationHeight = 96 + insets.bottom;
  const minTop = headerBottom + 8;
  const maxTop = Math.max(minTop, windowHeight - bottomNavigationHeight - buttonSize - 8);
  const [top, setTop] = useState((minTop + maxTop) / 2);

  useEffect(() => {
    setTop((currentTop) => Math.max(minTop, Math.min(maxTop, currentTop)));
  }, [maxTop, minTop]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => {
      setTop(Math.max(minTop, Math.min(maxTop, gesture.moveY - buttonSize / 2)));
    },
  }), [buttonSize, maxTop, minTop]);

  return (
    <View {...panResponder.panHandlers} style={[styles.floatingSupportHandle, { top }]}>
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
          Platform.OS === 'web' && { opacity: pressed || hovered ? 1 : 0.58 },
          pressed && styles.floatingSupportButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mở hỗ trợ"
      >
        <View style={styles.floatingSupportIcon}>
          <Headphones size={22} color="#FFFFFF" strokeWidth={2.5} />
        </View>
        <View style={styles.floatingSupportLabel}>
          <Text style={styles.floatingSupportLabelText}>Hỗ trợ</Text>
        </View>
      </Pressable>
    </View>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isTeacher = user?.role === 'teacher';
  const freeMenu = isFreePortalMenu(user);
  const freeLocked = isFreePortalLocked(user);
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

  useFocusEffect(useCallback(() => {
    void refreshTabBadges();
  }, [refreshTabBadges]));

  useEffect(() => {
    const refresh = () => { void refreshTabBadges(); };
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
    ];
    const subscriptions = refreshEvents.map((eventName) => DeviceEventEmitter.addListener(eventName, refresh));
    const financeViewedSubscription = DeviceEventEmitter.addListener('mobile:finance-viewed', () => {
      void markFinanceTransactionsViewed();
    });
    const interval = setInterval(refresh, 30000);
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      financeViewedSubscription.remove();
      clearInterval(interval);
    };
  }, [markFinanceTransactionsViewed, refreshTabBadges]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
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
        tabBarAccessibilityLabel: navTabLabel(route.name, isTeacher),
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'android' ? 75 : 60}
            tint="light"
            style={styles.navigationGlassBackground}
          >
            <View style={styles.navigationGlassTint} />
          </BlurView>
        ),
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
              label={navTabLabel(route.name, isTeacher)}
              Icon={TAB_ICONS[route.name] || FileText}
              selected={focused}
              isHome={route.name === 'Home'}
              badgeCount={badgeCount}
              locked={locked}
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
                title: 'Lịch dạy',
              }}
            />
            <Tab.Screen
              name="Feed"
              component={FeedScreen}
              options={{ title: 'Bảng tin' }}
            />
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Tổng quan' }} />
            <Tab.Screen
              name="Finance"
              component={TeacherFinanceScreen}
              options={{
                title: 'Tài chính',
              }}
            />
            <Tab.Screen
              name="Messages"
              component={MessagesScreen}
              options={{
                title: 'Tin nhắn',
              }}
            />
            <Tab.Screen name="Support" component={SupportEntryScreen} options={{ title: 'Hỗ trợ' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Hồ sơ' }} />
          </>
        ) : freeMenu ? (
          <>
            <Tab.Screen
              name="Messages"
              component={MessagesScreen}
              options={{
                title: 'Tin nhắn',
              }}
              listeners={{
                tabPress: (e) => {
                  if (freeLocked) {
                    e.preventDefault();
                    DeviceEventEmitter.emit(MOBILE_OPEN_FREE_LOCK_MODAL_EVENT);
                  }
                },
              }}
            />
            <Tab.Screen
              name="DailyPractice"
              component={DailyPracticeScreen}
              options={{ title: 'Luyện tập' }}
            />
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
            <Tab.Screen name="CourseVideos" component={CourseVideosScreen} options={{ title: 'Bài giảng' }} />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Hồ sơ' }}
            />
          </>
        ) : (
          <>
            <Tab.Screen
              name="Schedule"
              component={ScheduleScreen}
              options={{
                title: 'Lịch học',
              }}
            />
            <Tab.Screen
              name="Messages"
              component={MessagesScreen}
              options={{
                title: 'Tin nhắn',
              }}
            />
            <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Bảng tin' }} />
            <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
            <Tab.Screen name="DailyPractice" component={DailyPracticeScreen} options={{ title: 'Luyện tập' }} />
            <Tab.Screen name="CourseVideos" component={CourseVideosScreen} options={{ title: 'Bài giảng' }} />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Hồ sơ' }}
            />
          </>
        )}
    </Tab.Navigator >
  );
}

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
  searchOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  searchOverlayBackdrop: { ...StyleSheet.absoluteFill },
  searchOverlayCard: { width: '100%', maxWidth: 440, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  searchOverlayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  searchOverlayTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  searchOverlayClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchOverlayInput: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.canvas },
  searchOverlayTextInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: typography.body, paddingVertical: spacing.sm },
  incomingCallBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  incomingCallCard: { width: '100%', maxWidth: 360, alignItems: 'center', padding: spacing.xl, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  incomingCallIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#16A34A', marginBottom: spacing.md },
  incomingCallTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  incomingCallName: { color: colors.ink, fontSize: typography.title, fontWeight: '700', marginTop: spacing.sm },
  incomingCallSubtitle: { color: colors.muted, fontSize: typography.body, marginTop: spacing.xs },
  incomingCallActions: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.xl },
  incomingCallButton: { minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  rejectCallButton: { backgroundColor: '#DC2626' },
  acceptCallButton: { backgroundColor: '#16A34A' },
  incomingCallButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },
  persistentTabBar: { position: 'absolute', zIndex: 15, left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingHorizontal: 6, paddingTop: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.65)', boxShadow: droplet.navBar },
  navigationGlassBackground: { ...StyleSheet.absoluteFill, borderRadius: 24, overflow: 'hidden' },
  navigationGlassTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.65)', backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(241,245,249,0.66) 100%)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 24 },
  persistentTabItem: { flex: 1, minWidth: 0, height: 64, alignItems: 'stretch', justifyContent: 'flex-start' },
  navItem: { alignSelf: 'stretch', marginHorizontal: 3, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 3, borderWidth: 1, borderColor: 'transparent', borderRadius: 16 },
  navItemCard: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.45)', boxShadow: droplet.button },
  navItemActive: { borderColor: 'rgba(167,243,208,0.8)', backgroundColor: 'rgba(236,253,245,0.8)', backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(236,253,245,0.8) 100%)', boxShadow: droplet.navItemActive },
  navTile: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderBottomWidth: 3, borderBottomColor: '#CBD5E1', borderRadius: 14, backgroundColor: '#FFFFFF' },
  navTileActive: { borderColor: '#059669', borderBottomColor: '#047857', borderBottomWidth: 3, backgroundColor: '#10B981' },
  navItemHome: { gap: 0, paddingVertical: 0 },
  navTileHome: { width: 56, height: 56, borderWidth: 3, borderBottomWidth: 5, borderColor: '#FFFFFF', borderBottomColor: '#047857', borderRadius: 28, backgroundColor: '#10B981', backgroundImage: 'linear-gradient(160deg, #34D399 0%, #059669 55%, #047857 100%)', boxShadow: droplet.navHome },
  navLabel: { maxWidth: '100%', color: colors.muted, fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  navLabelActive: { color: '#047857', fontWeight: '900' },
  persistentTabBadge: { position: 'absolute', top: -7, right: -9, minWidth: 18, height: 18, paddingHorizontal: 4, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.brand, color: '#FFFFFF', fontSize: 10, lineHeight: 18, fontWeight: '700', textAlign: 'center', textAlignVertical: 'center' },
  navLockBadge: { position: 'absolute', top: -6, right: -6, width: 17, height: 17, borderRadius: 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  floatingMenuHandle: { position: 'absolute', left: 0, zIndex: 20 },
  floatingMenuButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: '#111827', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 2, height: 2 }, elevation: 6 },
  floatingSupportHandle: { position: 'absolute', right: 0, zIndex: 19 },
  floatingSupportButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, paddingLeft: 4, paddingRight: 14, borderWidth: 2, borderRightWidth: 0, borderColor: '#F59E0B', borderTopLeftRadius: 999, borderBottomLeftRadius: 999, backgroundColor: '#FFF8EB', backgroundImage: 'linear-gradient(145deg, #FFF8EB 0%, #FFFFFF 100%)', boxShadow: 'inset 2px 2px 5px rgba(120, 53, 15, 0.16), inset -2px -2px 5px rgba(255, 255, 255, 0.98), 0px 2px 5px rgba(15, 23, 42, 0.08)' },
  floatingSupportButtonPressed: { transform: [{ translateY: 1 }], boxShadow: 'inset 3px 3px 8px rgba(120, 53, 15, 0.24), inset -2px -2px 5px rgba(255, 255, 255, 0.88)' },
  floatingSupportLabel: { paddingHorizontal: 2 },
  floatingSupportLabelText: { color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  floatingSupportIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.brand, boxShadow: 'inset 2px 2px 4px rgba(4, 120, 87, 0.28), inset -1px -1px 3px rgba(255, 255, 255, 0.2)' },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2, 6, 23, 0.64)' },
  drawerDismiss: { ...StyleSheet.absoluteFill },
  drawer: { width: '82%', maxWidth: 280, height: '100%', backgroundColor: 'rgba(13, 21, 36, 0.9)', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRightColor: 'rgba(103,232,249,0.45)', borderTopRightRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden', shadowColor: '#22D3EE', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 3, height: 0 }, elevation: 18 },
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
  drawerSectionLabel: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xs, color: '#8797B0', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  drawerSectionItems: { gap: 3 },
  drawerItem: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: 'transparent', borderRadius: 14 },
  drawerItemActive: { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.12)', shadowColor: '#FFFFFF', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  drawerItemPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  drawerItemIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  drawerItemIconActive: { backgroundColor: colors.brand },
  drawerItemText: { flex: 1, color: '#D5DCE7', fontSize: typography.caption, fontWeight: '600' },
  drawerLogoutText: { color: '#FCA5A5' },
  drawerItemTextActive: { color: '#FFFFFF', fontWeight: '800' },
  drawerItemSelectedMark: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  drawerFooter: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.24)', gap: 2 },
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
