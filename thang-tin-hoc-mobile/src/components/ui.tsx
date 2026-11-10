import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  DeviceEventEmitter,
  Easing,
  Image,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ImageSourcePropType,
  type TextStyle,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Bell, ChevronLeft, ChevronRight, CircleAlert, Inbox, Search, type LucideIcon } from 'lucide-react-native';
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, droplet, radius, spacing, typography } from '../theme/tokens';
import type { Assignment, ScheduleItem } from '../types';
import { getWebLogoUrl } from '../services/webSettingsApi';
import type { AppStackParamList } from '../navigation/types';
import { useAuth } from '../app/AuthContext';
import { hasRealCourseEnrollment } from './FreePortalModals';

const BRANDING_HEADER_VISIBILITY_EVENT = 'mobile:branding-header-visibility';
export const MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT = 'mobile:navigation-bar-visibility';
const BRANDING_HEADER_HEIGHT = 58;

const SCROLL_TOGGLE_DISTANCE = 12;
/** Trang chỉ dài hơn màn hình chưa tới chiều cao header + thanh dưới thì giữ nguyên, tránh ẩn/hiện qua lại. */
const MIN_OVERFLOW_TO_HIDE_CHROME = 180;
const CHROME_ANIMATION_MS = 260;

/** Header và thanh điều hướng dưới dùng chung một nhịp chuyển động để ẩn/hiện cùng lúc. */
export function animateChrome(value: Animated.Value, visible: boolean) {
  Animated.timing(value, {
    toValue: visible ? 1 : 0,
    duration: CHROME_ANIMATION_MS,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  }).start();
}

function emitChromeVisibility(visible: boolean) {
  DeviceEventEmitter.emit(BRANDING_HEADER_VISIBILITY_EVENT, visible);
  DeviceEventEmitter.emit(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, visible);
}

/** Cuộn xuống thì ẩn header và thanh dưới, cuộn lên mới hiện; đáy trang không tự hiện lại. */
export function useBrandingHeaderScrollHandler() {
  const previousScrollOffset = useRef(0);
  const previousViewportHeight = useRef(0);
  const directionTravel = useRef(0);
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offsetY = Math.max(0, contentOffset.y);
    const offsetDelta = offsetY - previousScrollOffset.current;
    previousScrollOffset.current = offsetY;
    const viewportChanged = Math.abs(layoutMeasurement.height - previousViewportHeight.current) > 1;
    previousViewportHeight.current = layoutMeasurement.height;
    if (offsetY <= 8 || contentSize.height - layoutMeasurement.height < MIN_OVERFLOW_TO_HIDE_CHROME) {
      directionTravel.current = 0;
      emitChromeVisibility(true);
      return;
    }
    // Header co giãn làm vùng cuộn đổi chiều cao và kéo vị trí cuộn theo; không coi đó là người dùng cuộn.
    if (viewportChanged) {
      directionTravel.current = 0;
      return;
    }
    if (!offsetDelta) return;
    if (Math.sign(offsetDelta) !== Math.sign(directionTravel.current)) directionTravel.current = 0;
    directionTravel.current += offsetDelta;
    if (directionTravel.current > SCROLL_TOGGLE_DISTANCE) emitChromeVisibility(false);
    else if (directionTravel.current < -SCROLL_TOGGLE_DISTANCE) emitChromeVisibility(true);
  }, []);
}

export function AppScreen({
  children,
  scroll = true,
  contentStyle,
  refreshControl,
  scrollViewRef,
  hideBrandingTopBar = false,
}: React.PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshControl?: React.ReactElement;
  scrollViewRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
  hideBrandingTopBar?: boolean;
}>) {
  const handleScroll = useBrandingHeaderScrollHandler();

  useFocusEffect(useCallback(() => {
    DeviceEventEmitter.emit(BRANDING_HEADER_VISIBILITY_EVENT, true);
    DeviceEventEmitter.emit(MOBILE_NAVIGATION_BAR_VISIBILITY_EVENT, true);
  }, []));

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {!hideBrandingTopBar ? <BrandingTopBar /> : null}
      {scroll ? (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.screenContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          onScrollEndDrag={handleScroll}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

function BrandingTopBar() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const auth = useAuth();
  const isFreeStudent =
    auth?.user?.role === 'student'
    && (auth?.user?.freePortal === true || String(auth?.user?.course || '').toLowerCase().includes('miễn phí'))
    && !hasRealCourseEnrollment(auth?.user);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const headerProgress = useRef(new Animated.Value(1)).current;
  const headerVisible = useRef(true);

  const setHeaderVisible = useCallback((visible: boolean) => {
    if (headerVisible.current === visible) return;
    headerVisible.current = visible;
    animateChrome(headerProgress, visible);
  }, [headerProgress]);

  useEffect(() => {
    if (!isFocused) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      BRANDING_HEADER_VISIBILITY_EVENT,
      setHeaderVisible,
    );
    setHeaderVisible(true);
    return () => subscription.remove();
  }, [isFocused, setHeaderVisible]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('mobile:notification-count-changed', (count: number) => {
      setUnreadCount(Number.isInteger(count) ? Math.max(0, count) : 0);
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    DeviceEventEmitter.emit('mobile:notification-count-refresh');
    getWebLogoUrl()
      .then((url) => {
        if (active) {
          setLogoUrl(url);
          setLogoLoadFailed(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLogoLoadFailed(true);
          console.error('Không thể tải logo thương hiệu từ cài đặt web.', error);
        }
      });
    return () => {
      active = false;
    };
  }, []));

  return (
    <Animated.View
      style={[
        styles.brandingTopBarContainer,
        {
          height: headerProgress.interpolate({ inputRange: [0, 1], outputRange: [0, BRANDING_HEADER_HEIGHT] }),
          opacity: headerProgress,
          transform: [{ translateY: headerProgress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
        },
      ]}
    >
      <BlurView intensity={Platform.OS === 'android' ? 65 : 48} tint="light" style={styles.brandingTopBar}>
        <Pressable
          onPress={() => DeviceEventEmitter.emit('mobile:open-search')}
          style={styles.topBarAction}
          accessibilityRole="button"
          accessibilityLabel="Mở tìm kiếm"
        >
          <Search size={20} color={colors.muted} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          style={styles.brandingHomeCentered}
          accessibilityRole="button"
          accessibilityLabel="Về trang tổng quan"
        >
          {isFreeStudent ? (
            <Image
              source={require('../../assets/logo.webp')}
              style={styles.brandingLogo}
              resizeMode="contain"
              accessibilityLabel="Logo DewSkill"
            />
          ) : (logoUrl && !logoLoadFailed ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.brandingLogo}
              resizeMode="contain"
              accessibilityLabel="Logo Thắng Tin Học LMS"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <Image
              source={require('../../assets/logo-lms.png')}
              style={styles.brandingLogo}
              resizeMode="contain"
              accessibilityLabel="Logo Thắng Tin Học LMS"
            />
          ))}
        </Pressable>
        <Pressable
          onPress={() => DeviceEventEmitter.emit('mobile:open-notifications')}
          style={styles.topBarAction}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Mở thông báo, ${unreadCount} chưa đọc` : 'Mở thông báo'}
        >
          <View style={styles.notificationBell}>
            <Bell size={20} color={colors.muted} />
            {unreadCount > 0 ? (
              <View style={styles.notificationUnreadBadge}>
                <Text style={styles.notificationUnreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
  containerStyle,
  icon: Icon,
  compact = true,
  showBackButton = true,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  containerStyle?: ViewStyle;
  icon?: LucideIcon;
  compact?: boolean;
  showBackButton?: boolean;
  centered?: boolean;
}) {
  const navigation = useNavigation();
  const route = useRoute();
  const parentNavigation = navigation.getParent();
  const isMainTab = ['Home', 'Schedule', 'Messages', 'CourseVideos', 'Feed', 'Notifications', 'Profile'].includes(route.name);
  const canGoBack = !isMainTab && (navigation.canGoBack() || Boolean(parentNavigation?.canGoBack()));
  const handleBack = showBackButton ? onBack || (canGoBack ? () => {
    if (navigation.canGoBack()) navigation.goBack();
    else parentNavigation?.goBack();
  } : undefined) : undefined;

  if (isMainTab) return null;

  return (
    <BlurView
      intensity={Platform.OS === 'android' ? 55 : 38}
      tint="light"
      style={[styles.header, Icon ? styles.headerWithIcon : null, compact ? styles.headerCompact : null, centered ? styles.headerCentered : null, containerStyle]}
    >
      {Icon ? <View style={styles.headerIcon}><Icon size={19} color={colors.brand} /></View> : null}
      {handleBack ? (
        <Pressable onPress={handleBack} style={[styles.headerAction, compact ? styles.headerActionCompact : null]} accessibilityRole="button" accessibilityLabel="Quay lại">
          <ChevronLeft size={compact ? 20 : 22} color={compact ? colors.surface : colors.ink} />
        </Pressable>
      ) : null}
      <View style={[
        styles.headerText,
        Icon ? styles.headerTextWithIcon : null,
        centered ? styles.headerTextCentered : null,
        centered && right ? styles.headerTextCenteredWithRight : null,
      ]}>
        <Text style={[styles.headerTitle, Icon ? styles.headerTitleWithIcon : null, compact ? styles.headerTitleCompact : null, centered ? styles.headerTitleCentered : null]}>{title}</Text>
        {subtitle ? <Text style={[styles.headerSubtitle, compact ? styles.headerSubtitleCompact : null, centered ? styles.headerSubtitleCentered : null]}>{subtitle}</Text> : null}
      </View>
      {right}
    </BlurView>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const badgePalette: Record<string, { backgroundColor: string; color: string }> = {
  'Đang học': { backgroundColor: colors.greenSoft, color: colors.green },
  'Hoàn thành': { backgroundColor: colors.blueSoft, color: colors.blue },
  'Đạt': { backgroundColor: colors.greenSoft, color: colors.green },
  'Chưa đạt': { backgroundColor: colors.redSoft, color: colors.red },
  'Đã nộp': { backgroundColor: colors.greenSoft, color: colors.green },
  'Chưa làm': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Quá hạn': { backgroundColor: colors.redSoft, color: colors.red },
  'Cần chấm': { backgroundColor: colors.purpleSoft, color: colors.purple },
  'Cần hỗ trợ': { backgroundColor: colors.redSoft, color: colors.red },
  'Thôi học': { backgroundColor: colors.redSoft, color: colors.red },
  'Đã chấm': { backgroundColor: colors.greenSoft, color: colors.green },
  'Đã nhận': { backgroundColor: colors.greenSoft, color: colors.green },
  'Chưa nhận': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Tốt': { backgroundColor: colors.greenSoft, color: colors.green },
  'Có mặt': { backgroundColor: colors.greenSoft, color: colors.green },
  'Điểm danh': { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  'Đã điểm danh': { backgroundColor: colors.greenSoft, color: colors.green },
  'Đã điểm danh bù': { backgroundColor: colors.greenSoft, color: colors.green },
  'Đã xác nhận': { backgroundColor: colors.greenSoft, color: colors.green },
  'Vắng': { backgroundColor: colors.redSoft, color: colors.red },
  'Đi trễ': { backgroundColor: colors.goldSoft, color: '#9A6C0A' },
  'Có phép': { backgroundColor: colors.blueSoft, color: colors.blue },
  upcoming: { backgroundColor: colors.brandSoft, color: colors.brandDark },
  completed: { backgroundColor: colors.greenSoft, color: colors.green },
  cancelled: { backgroundColor: colors.redSoft, color: colors.red },
};

export function StatusBadge({ label, compact = false }: { label: string; compact?: boolean }) {
  const palette = badgePalette[label] || { backgroundColor: colors.canvas, color: colors.muted };
  const displayLabel = ({
    upcoming: 'Sắp tới',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  } as Record<string, string>)[label] || label;
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: palette.backgroundColor }]} accessibilityLabel={`Trạng thái: ${displayLabel}`}>
      <Text numberOfLines={1} style={[styles.badgeText, compact && styles.badgeTextCompact, { color: palette.color }]}>{displayLabel}</Text>
    </View>
  );
}

export function Avatar({ name, color = colors.brandSoft, size = 48, imageUri, imageSource }: { name: string; color?: string; size?: number; imageUri?: string; imageSource?: ImageSourcePropType }) {
  const initials = name.split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      {imageSource || imageUri
        ? <Image source={imageSource || { uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.avatarText, { fontSize: Math.max(13, size * 0.3) }]}>{initials}</Text>}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
}) {
  const secondary = variant === 'secondary';
  const quiet = variant === 'quiet';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        quiet && styles.buttonQuiet,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={secondary || quiet ? colors.brand : '#FFFFFF'} /> : (
        <Text style={[styles.buttonText, (secondary || quiet) && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Tìm kiếm',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Search size={18} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        blurOnSubmit
      />
    </View>
  );
}

export function FormField({
  label,
  inputStyle,
  ...props
}: TextInputProps & { label: string; inputStyle?: TextStyle }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, inputStyle]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card style={styles.stateCard}>
      <View style={styles.stateIcon}><Inbox size={22} color={colors.brand} /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
    </Card>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <Card style={styles.stateCard}>
      <View style={[styles.stateIcon, { backgroundColor: colors.redSoft }]}><CircleAlert size={22} color={colors.red} /></View>
      <Text style={styles.stateTitle}>Chưa thể tải nội dung</Text>
      <Text style={styles.stateMessage}>{message || 'Đây là trạng thái lỗi minh họa trong bản demo.'}</Text>
      <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
    </Card>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Đang tải" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonLines}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      accessibilityLabel={`Tiến độ ${value}%`}
    >
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

export function ScheduleCard({ item }: { item: ScheduleItem }) {
  return (
    <Card style={styles.scheduleCard}>
      <View style={[styles.scheduleRail, { backgroundColor: item.color }]} />
      <View style={styles.scheduleBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardEyebrow}>{item.dateLabel} · {item.time}</Text>
          <StatusBadge label={item.status} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.bodyMuted}>{item.person}  ·  {item.location}</Text>
      </View>
    </Card>
  );
}

export function AssignmentCard({ item }: { item: Assignment }) {
  return (
    <Card style={styles.listCard}>
      <View style={styles.assignmentIcon}><Text style={styles.assignmentIconText}>Aa</Text></View>
      <View style={styles.listCardBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardEyebrow}>{item.subject}</Text>
          <StatusBadge label={item.status} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.bodyMuted}>{item.teacher}  ·  {item.deadline}</Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Card>
  );
}

export function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  destructive = false,
  borderless = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  borderless?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, borderless && styles.menuRowBorderless]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, destructive && { color: colors.red }]}>{title}</Text>
        {subtitle ? <Text style={styles.bodyMuted}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  body: { color: colors.ink, fontSize: typography.body, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  brandingTopBarContainer: { overflow: 'hidden' },
  brandingTopBar: { position: 'relative', minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: 'rgba(255,255,255,0.72)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.9)', shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: 'hidden' },
  brandingHomeCentered: { position: 'absolute', left: '50%', top: '50%', width: 168, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.98)', borderRadius: 16, backgroundColor: '#FFFFFF', backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #F3F6FB 100%)', boxShadow: droplet.logo, transform: [{ translateX: -84 }, { translateY: -24 }] },
  brandingLogo: { width: 140, height: 42 },
  brandingFallback: { color: colors.brandDark, fontSize: typography.small, fontWeight: '800' },
  topBarAction: { zIndex: 1, width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.72)', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  notificationBell: { position: 'relative' },
  notificationUnreadBadge: { position: 'absolute', top: -7, right: -9, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.surface, borderRadius: 9, backgroundColor: colors.brand },
  notificationUnreadBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  fill: { flex: 1 },
  screenContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)', borderRadius: 18, shadowColor: '#0F172A', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: 'hidden' },
  headerCentered: { justifyContent: 'center' },
  headerCompact: { minHeight: 48, gap: spacing.sm, paddingVertical: spacing.xs },
  headerWithIcon: { minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.76)' },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  headerText: { flex: 1 },
  headerTextCentered: { position: 'absolute', left: spacing.xl, right: spacing.xl, alignItems: 'center' },
  headerTextCenteredWithRight: { left: 44, right: 44 },
  headerTextWithIcon: { gap: 2 },
  headerTitle: { color: colors.ink, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  headerTitleCentered: { width: '100%', textAlign: 'center' },
  headerTitleWithIcon: { fontSize: typography.body, letterSpacing: 0 },
  headerTitleCompact: { fontSize: typography.heading, lineHeight: 22, letterSpacing: -0.2 },
  headerSubtitle: { color: colors.muted, fontSize: typography.small, marginTop: 3 },
  headerSubtitleCentered: { textAlign: 'center' },
  headerSubtitleCompact: { fontSize: typography.caption, lineHeight: 16, marginTop: 1 },
  headerAction: { width: 44, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  headerActionCompact: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brand },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '700' },
  sectionAction: { color: colors.brand, fontSize: typography.small, fontWeight: '700' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', minHeight: 28, justifyContent: 'center' },
  badgeText: { fontSize: typography.caption, fontWeight: '700' },
  badgeCompact: { minHeight: 22, maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3 },
  badgeTextCompact: { fontSize: 9, lineHeight: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brandDark, fontWeight: '800' },
  button: { minHeight: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.brand, boxShadow: droplet.button },
  buttonSecondary: { backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#C6E8E6' },
  buttonQuiet: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: typography.body },
  buttonTextSecondary: { color: colors.brandDark },
  pressed: { boxShadow: droplet.buttonPressed, transform: [{ scale: 0.99 }] },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.lg },
  searchInput: { flex: 1, color: colors.ink, fontSize: typography.body, paddingVertical: spacing.md },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.lg, fontSize: typography.body },
  stateCard: { alignItems: 'center', paddingVertical: spacing.xxxl },
  stateIcon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.heading, textAlign: 'center' },
  stateMessage: { color: colors.muted, fontSize: typography.small, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  skeletonCard: { height: 84, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  skeletonCircle: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: '#EAF0F1' },
  skeletonLines: { flex: 1, gap: spacing.sm },
  skeletonLine: { height: 11, borderRadius: radius.pill, backgroundColor: '#EAF0F1', width: '75%' },
  skeletonShort: { width: '45%', height: 9 },
  progressTrack: { height: 8, backgroundColor: '#E9EFF0', borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand },
  scheduleCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', gap: 0 },
  scheduleRail: { width: 5 },
  scheduleBody: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  cardEyebrow: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', flexShrink: 1 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  bodyMuted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listCardBody: { flex: 1, gap: spacing.xs },
  assignmentIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  assignmentIconText: { fontSize: typography.small, fontWeight: '800', color: colors.brandDark },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.line },
  menuRowBorderless: { borderBottomWidth: 0 },
  menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '600' },
});
