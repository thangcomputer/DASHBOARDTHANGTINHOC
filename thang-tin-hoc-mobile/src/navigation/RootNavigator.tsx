import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, DeviceEventEmitter, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import {
  Bell, BookOpen, Building2, CalendarDays, CheckSquare, Clapperboard, FileBox, FileText, GraduationCap,
  House, LogOut, Menu, MessageCircle, Newspaper, Phone, PhoneOff, Radio, Search, Star, UserRound, Users, Volume2, VolumeX, WalletCards, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../app/AuthContext';
import { emit, SOCKET_EVENTS } from '../services/socketService';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { getMobileSoundEnabled, setMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { LoginScreen } from '../screens/LoginScreen';
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
  NewsDetailScreen, NewsScreen, SoftwareLinksScreen, StudentExamScreen, StudentLearningScreen, TeacherFinanceScreen,
  TeacherQuizzesScreen, TeacherTrainingScreen, TuitionScreen,
} from '../screens/ParityScreens';
import {
  CertPrepCatalogScreen, CertPrepLevelScreen, CertPrepPlayerScreen, CertPrepResultScreen,
} from '../screens/CertPrepScreens';
import {
  LessonPracticeCatalogScreen, LessonPracticeUnitsScreen, LessonPracticePlayerScreen,
} from '../screens/LessonPracticeScreens';
import { OfflineBanner } from '../components/OfflineBanner';
import type { AppStackParamList, MainTabsParamList } from './types';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

type IncomingCallPrompt = {
  callId: string;
  conversationId: string;
  callerId: string;
  callerRole: string;
  callerName: string;
};

export function RootNavigator() {
  const { user, isRestoringSession, signOut } = useAuth();
  const [notificationOverlayVisible, setNotificationOverlayVisible] = useState(false);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPrompt | null>(null);
  const [examRoomActive, setExamRoomActive] = useState(false);
  const [stackRouteName, setStackRouteName] = useState<string | undefined>(() => {
    if (!navigationRef.isReady()) return undefined;
    const state = navigationRef.getRootState();
    return state?.routes[state.index ?? 0]?.name;
  });
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:open-notifications', () => setNotificationOverlayVisible(true));
    return () => subscription.remove();
  }, []);
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
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.CALL_INCOMING, (event: {
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
    });
    return () => subscription.remove();
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
      setStackRouteName(state?.routes[state.index ?? 0]?.name);
    });
    return unsubscribe;
  }, []);
  if (isRestoringSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return user ? (
    <View style={styles.root}>
      <OfflineBanner />
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
              <Stack.Screen name="LessonPracticeCatalog" component={LessonPracticeCatalogScreen} />
              <Stack.Screen name="LessonPracticeUnits" component={LessonPracticeUnitsScreen} />
              <Stack.Screen name="LessonPracticePlayer" component={LessonPracticePlayerScreen} />
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
      {!examRoomActive && stackRouteName && stackRouteName !== 'MainTabs' && stackRouteName !== 'Conversation' && stackRouteName !== 'Call' ? <PersistentTabBar role={user.role} /> : null}
      {notificationOverlayVisible ? (
        <NotificationsScreen
          overlay
          onClose={() => setNotificationOverlayVisible(false)}
        />
      ) : null}
      {searchOverlayVisible ? <GlobalSearchOverlay onClose={() => setSearchOverlayVisible(false)} /> : null}
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

function PersistentTabBar({ role }: { role: 'student' | 'teacher' }) {
  const insets = useSafeAreaInsets();
  const isTeacher = role === 'teacher';
  const [activeTab, setActiveTab] = useState<string>('Home');
  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => {
      if (!navigationRef.isReady()) return;
      const state = navigationRef.getRootState();
      const mainTabsRoute = state?.routes.find((r) => r.name === 'MainTabs');
      const tabState = mainTabsRoute?.state;
      if (tabState) {
        const currentTab = tabState.routes[tabState.index ?? 0]?.name ?? 'Home';
        setActiveTab(currentTab);
      }
    });
    return unsubscribe;
  }, []);
  const items = isTeacher
    ? [
      { name: 'Home' as const, label: 'Tổng quan', icon: House },
      { name: 'Schedule' as const, label: 'Lịch dạy', icon: CalendarDays },
      { name: 'Students' as const, label: 'Học viên', icon: Users },
      { name: 'Messages' as const, label: 'Hộp thư', icon: MessageCircle },
      { name: 'Profile' as const, label: 'Hồ sơ', icon: UserRound },
    ]
    : [
      { name: 'Schedule' as const, label: 'Lịch học', icon: CalendarDays },
      { name: 'Messages' as const, label: 'Hộp thư', icon: MessageCircle },
      { name: 'Home' as const, label: 'Trang chủ', icon: House },
      { name: 'CourseVideos' as const, label: 'Luyện tập kỹ năng', icon: Clapperboard },
      { name: 'Profile' as const, label: 'Cá nhân', icon: UserRound },
    ];
  const tabOrder = ['Schedule', 'Messages', 'Home', 'Students', 'CourseVideos', 'Profile'];
  const orderedItems = [...items].sort((left, right) => tabOrder.indexOf(left.name) - tabOrder.indexOf(right.name));
  const barHeight = 76 + insets.bottom;
  return (
    <View style={[styles.persistentTabBar, { height: barHeight, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d="M0 30 H145 C145 13 169 0 200 0 C231 0 255 13 255 30 H400 V100 H0 Z" fill={colors.brandSoft} />
        <Path d="M151 30 C151 11 173 2 200 2 C227 2 249 11 249 30 Z" fill={colors.redSoft} />
      </Svg>
      {orderedItems.map(({ name, label, icon: Icon }) => {
        const selected = name === activeTab;
        return (
          <Pressable
            key={name}
            onPress={() => navigationRef.navigate('MainTabs', { screen: name })}
            style={[styles.persistentTabItem, selected && name === 'Home' && styles.persistentHomeItem]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {selected && name === 'Home' ? (
              <View style={styles.homeArcButton}><House size={23} color="#FFFFFF" strokeWidth={2.5} /></View>
            ) : (
              <Icon size={22} color={selected ? colors.brand : colors.muted} strokeWidth={2.2} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type MenuDestination = 'Home' | 'Schedule' | 'Students' | 'Messages' | 'CourseVideos' | 'Feed'
  | 'Profile' | 'NotificationCenter' | 'Assignments' | 'Materials' | 'StudentExam'
  | 'StudentLearning' | 'Evaluations' | 'News' | 'CenterInfo' | 'SoftwareLinks'
  | 'Tuition' | 'TeacherQuizzes' | 'TeacherTraining' | 'TeacherFinance';

type MenuEntry = { label: string; destination: MenuDestination; icon: LucideIcon };

function FloatingNavigationMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const isTeacher = user?.role === 'teacher';
  const [activeDestination, setActiveDestination] = useState<MenuDestination | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const handleHeight = 48;
  const headerBottom = insets.top + 58;
  const bottomNavigationHeight = 76 + insets.bottom;
  const minMenuTop = headerBottom + 8;
  const maxMenuTop = Math.max(minMenuTop, windowHeight - bottomNavigationHeight - handleHeight - 8);
  const [menuTop, setMenuTop] = useState((minMenuTop + maxMenuTop) / 2);
  useEffect(() => {
    setMenuTop((currentTop) => Math.max(minMenuTop, Math.min(maxMenuTop, currentTop)));
  }, [maxMenuTop, minMenuTop]);
  const menuItems: MenuEntry[] = isTeacher
    ? [
      { label: 'Tổng quan', destination: 'Home', icon: House },
      { label: 'Hộp thư', destination: 'Messages', icon: MessageCircle },
      { label: 'Học viên', destination: 'Students', icon: Users },
      { label: 'Lịch dạy & điểm danh', destination: 'Schedule', icon: CalendarDays },
      { label: 'Bài tập & kiểm tra', destination: 'Assignments', icon: CheckSquare },
      { label: 'Trắc nghiệm', destination: 'TeacherQuizzes', icon: GraduationCap },
      { label: 'Khóa đào tạo', destination: 'TeacherTraining', icon: BookOpen },
      { label: 'Tài chính', destination: 'TeacherFinance', icon: WalletCards },
      { label: 'Bảng tin', destination: 'Feed', icon: Radio },
      { label: 'Tin tức', destination: 'News', icon: Newspaper },
      { label: 'Thông báo', destination: 'NotificationCenter', icon: Bell },
      { label: 'Thông tin Trung tâm', destination: 'CenterInfo', icon: FileText },
    ]
    : [
      { label: 'Tổng quan', destination: 'Home', icon: House },
      { label: 'Hộp thư', destination: 'Messages', icon: MessageCircle },
      { label: 'Luyện tập kỹ năng', destination: 'CourseVideos', icon: Clapperboard },
      { label: 'Lịch học', destination: 'Schedule', icon: CalendarDays },
      { label: 'Bài tập và tài nguyên', destination: 'Assignments', icon: FileBox },
      { label: 'Phòng thi', destination: 'StudentExam', icon: GraduationCap },
      { label: 'Bảng tin', destination: 'Feed', icon: Radio },
      { label: 'Tin tức', destination: 'News', icon: Newspaper },
      { label: 'Đánh giá giảng viên', destination: 'Evaluations', icon: Star },
      { label: 'Thông tin học phí', destination: 'Tuition', icon: WalletCards },
      { label: 'Liên hệ Trung tâm', destination: 'CenterInfo', icon: Building2 },
    ];
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
      const activeAlias = currentRoute === 'Notifications'
        ? 'NotificationCenter'
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
    setMenuVisible(false);
    if (['Home', 'Schedule', 'Students', 'Messages', 'CourseVideos', 'Profile'].includes(destination)) {
      navigationRef.navigate('MainTabs', { screen: destination as keyof MainTabsParamList });
      return;
    }
    if (destination === 'Feed') navigationRef.navigate('Feed');
    else if (destination === 'NotificationCenter') navigationRef.navigate('NotificationCenter');
    else if (destination === 'Assignments') navigationRef.navigate('Assignments');
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
          onPress={() => setMenuVisible(true)}
          onHoverIn={() => setHandleHovered(true)}
          onHoverOut={() => setHandleHovered(false)}
          style={({ pressed }) => [
            styles.floatingMenuButton,
            { opacity: pressed || handleHovered ? 0.96 : 0.34 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mở danh mục điều hướng"
        >
          <Menu size={21} color="#FFFFFF" />
        </Pressable>
      </View>
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerDismiss} onPress={() => setMenuVisible(false)} accessibilityLabel="Đóng danh mục" />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                {user?.avatar
                  ? <Image source={getMobileImageSource(resolveMobilePublicUrl(user.avatar))} style={styles.drawerAvatarImage} />
                  : <UserRound size={22} color="#FFFFFF" />}
              </View>
              <View style={styles.drawerIdentity}>
                <Text numberOfLines={1} style={styles.drawerName}>{user?.name || 'Tài khoản'}</Text>
                <Text style={styles.drawerRole}>{isTeacher ? 'GIẢNG VIÊN' : 'HỌC VIÊN'}</Text>
              </View>
              <Pressable onPress={() => setMenuVisible(false)} style={styles.drawerClose} accessibilityRole="button" accessibilityLabel="Đóng menu">
                <X size={19} color="#CBD5E1" />
              </Pressable>
            </View>
            <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerItems}>
              {menuItems.map(({ label, destination, icon: Icon }) => (
                <Pressable
                  key={destination}
                  onPress={() => openDestination(destination)}
                  style={({ pressed }) => [
                    styles.drawerItem,
                    activeDestination === destination && styles.drawerItemActive,
                    pressed && styles.drawerItemPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeDestination === destination }}
                >
                  <Icon size={17} color={activeDestination === destination ? '#FFFFFF' : '#C7D2FE'} />
                  <Text style={[styles.drawerItemText, activeDestination === destination && styles.drawerItemTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.drawerFooter}>
              <Pressable
                onPress={() => openDestination('Profile')}
                style={[styles.drawerItem, activeDestination === 'Profile' && styles.drawerItemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: activeDestination === 'Profile' }}
              >
                <UserRound size={17} color={activeDestination === 'Profile' ? '#FFFFFF' : '#C7D2FE'} />
                <Text style={[styles.drawerItemText, activeDestination === 'Profile' && styles.drawerItemTextActive]}>Hồ sơ</Text>
              </Pressable>
              <Pressable onPress={() => { setMenuVisible(false); onSignOut(); }} style={styles.drawerItem} accessibilityRole="button">
                <LogOut size={17} color="#C7D2FE" />
                <Text style={styles.drawerItemText}>Đăng xuất</Text>
              </Pressable>
              <Pressable onPress={toggleSound} style={styles.drawerItem} accessibilityRole="button" accessibilityState={{ checked: !soundEnabled }}>
                {soundEnabled ? <Volume2 size={17} color="#C7D2FE" /> : <VolumeX size={17} color="#C7D2FE" />}
                <Text style={styles.drawerItemText}>{soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isTeacher = user?.role === 'teacher';
  const teacherTabPositions: Record<string, number> = {
    Schedule: 0,
    Messages: 1,
    Home: 2,
    Students: 3,
    Profile: 4,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          height: 76 + insets.bottom,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          elevation: 0,
        },
        tabBarBackground: () => (
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 400 100"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
          >
            <Path d="M0 30 H145 C145 13 169 0 200 0 C231 0 255 13 255 30 H400 V100 H0 Z" fill={colors.brandSoft} />
            <Path d="M151 30 C151 11 173 2 200 2 C227 2 249 11 249 30 Z" fill={colors.redSoft} />
          </Svg>
        ),
        tabBarItemStyle: isTeacher
          ? {
            position: 'absolute',
            left: `${(teacherTabPositions[route.name] ?? 0) * 20}%`,
            width: '20%',
            height: '100%',
            ...(route.name === 'Home' ? { transform: [{ translateY: -12 }] } : {}),
          }
          : route.name === 'Home'
            ? { transform: [{ translateY: -12 }] }
            : undefined,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return (
              <View style={styles.homeArcButton}>
                <House size={23} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            );
          }
          const common = { size: size - 2, color, strokeWidth: 2.2 };
          switch (route.name) {
            case 'Schedule': return <CalendarDays {...common} />;
            case 'Messages': return <MessageCircle {...common} />;
            case 'CourseVideos': return <Clapperboard {...common} />;
            case 'Profile': return <UserRound {...common} />;
            case 'Students': return <Users {...common} />;
            default: return <FileText {...common} />;
          }
        },
      })}
    >
      {isTeacher ? (
        <>
          <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Tổng quan' }} />
          <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Lịch dạy' }} />
          <Tab.Screen name="Students" component={StudentsScreen} options={{ title: 'Học viên' }} />
          <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Tin nhắn' }} />
        </>
      ) : (
        <>
          <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Lịch học' }} />
          <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: 'Tin nhắn' }} />
          <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
          <Tab.Screen name="CourseVideos" component={CourseVideosScreen} options={{ title: 'Luyện tập kỹ năng' }} />
        </>
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: isTeacher ? 'Hồ sơ' : 'Cá nhân' }} />
    </Tab.Navigator>
  );
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
  incomingCallButton: { minWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 999 },
  rejectCallButton: { backgroundColor: '#DC2626' },
  acceptCallButton: { backgroundColor: '#16A34A' },
  incomingCallButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },
  persistentTabBar: { position: 'absolute', zIndex: 15, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: spacing.md },
  persistentTabItem: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  persistentHomeItem: { transform: [{ translateY: -12 }] },
  floatingMenuHandle: { position: 'absolute', right: 0, zIndex: 20 },
  floatingMenuButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: '#111827', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: -2, height: 2 }, elevation: 6 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(2, 6, 23, 0.58)' },
  drawerDismiss: { ...StyleSheet.absoluteFill },
  drawer: { width: '82%', maxWidth: 320, height: '100%', backgroundColor: '#111827', paddingTop: spacing.xl, paddingBottom: spacing.md },
  drawerHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.2)' },
  drawerAvatar: { width: 38, height: 38, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: '#334155' },
  drawerAvatarImage: { width: 38, height: 38, borderRadius: 19 },
  drawerIdentity: { flex: 1, minWidth: 0, gap: 4 },
  drawerName: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '800' },
  drawerRole: { color: '#A5B4FC', fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.8 },
  drawerClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  drawerScroll: { flex: 1 },
  drawerItems: { paddingVertical: spacing.sm, gap: 2 },
  drawerItem: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148, 163, 184, 0.14)' },
  drawerItemActive: { borderBottomWidth: 0, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)' },
  drawerItemPressed: { borderRadius: radius.md, backgroundColor: 'rgba(148, 163, 184, 0.2)' },
  drawerItemText: { color: '#E2E8F0', fontSize: typography.caption, fontWeight: '600' },
  drawerItemTextActive: { color: '#FFFFFF', fontWeight: '800' },
  drawerFooter: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.2)' },
  homeArcButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    borderRadius: 29,
    backgroundColor: colors.brand,
    shadowColor: '#7F1D1D',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
});
